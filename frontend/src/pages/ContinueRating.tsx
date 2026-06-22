// =============================================================================
// frontend/src/pages/ContinueRating.tsx
//
// "Continue Rating" — Tinder-style one-at-a-time flow for rating every unrated
// movie and TV show in the user's library.
//
// Behaviour:
//   - Asks the server for `?unrated=true` so we only get rows with NULL
//     `rating` (no client-side paging over the full library).
//   - Lazy-loads the TMDB details for the current card only; once that
//     resolves, prefetches the next one in the background.
//   - Single "Previous" button restores either a rated card (rating still on
//     the library row) or a skipped card (Tinder-style skip puts it at the
//     end of the queue; Previous pops it back).
//   - Compact phone layout: poster is a small top banner, content scrolls
//     and the rating bar sticks to the bottom so it's always reachable.
//   - Fade + 4px translate transition when swapping cards.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  Tv,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  libraryApi,
  LibraryItem,
  mediaApi,
  TmdbMovieDetails,
  TmdbShowDetails,
} from "../lib/api";
import { mediaPath } from "../lib/media";
import { invalidateCached } from "../lib/tmdbCache";
import { Skeleton } from "../components/Skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MediaDetails = TmdbMovieDetails | TmdbShowDetails;

interface RateCard {
  library: LibraryItem;
  details: MediaDetails;
}

type CardSlot =
  | { kind: "loading"; library: LibraryItem }
  | { kind: "ready"; card: RateCard }
  | { kind: "error"; library: LibraryItem; message: string };

const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isShow(d: MediaDetails): d is TmdbShowDetails {
  return d.media_type === "tv";
}

/** Every `CardSlot` variant carries the underlying `LibraryItem`. */
function libraryOf(slot: CardSlot): LibraryItem {
  return slot.kind === "ready" ? slot.card.library : slot.library;
}

async function loadDetailsFor(lib: LibraryItem): Promise<MediaDetails> {
  const res =
    lib.media_type === "movie"
      ? await mediaApi.getMovie(lib.tmdb_id)
      : await mediaApi.getShow(lib.tmdb_id);
  return res.media;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContinueRating: React.FC = () => {
  const [slots, setSlots] = useState<CardSlot[] | null>(null);
  const [history, setHistory] = useState<CardSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetching, setPrefetching] = useState(false);

  // One lazy hydration runs at a time. We keep a ref so the prefetch loop
  // can short-circuit if the user advanced past the card it was about to
  // load.
  const hydratingIndex = useRef<number | null>(null);

  // -------------------------------------------------------------------------
  // Initial fetch
  // -------------------------------------------------------------------------

  const fetchUnrated = useCallback(async () => {
    setSlots(null);
    setHistory([]);
    setError(null);
    try {
      const res = await libraryApi.list({ unrated: true, page: 1, limit: 100 });
      if (res.data.length === 0) {
        setSlots([]);
        return;
      }
      // Build a slot per row — all start as "loading" so we can show
      // something instantly, then lazy-hydrate one at a time.
      const initial: CardSlot[] = res.data.map((lib) => ({
        kind: "loading",
        library: lib,
      }));
      setSlots(initial);
    } catch (err) {
      console.error("Failed to load unrated library", err);
      setError("Couldn't load your library. Please try again.");
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    fetchUnrated();
  }, [fetchUnrated]);

  // -------------------------------------------------------------------------
  // Lazy hydration: details for slot `i` resolve into a "ready" slot.
  // -------------------------------------------------------------------------

  const hydrateSlot = useCallback(
    async (index: number) => {
      if (!slots) return;
      const slot = slots[index];
      if (!slot || slot.kind !== "loading") return;
      if (hydratingIndex.current === index) return; // already in flight

      hydratingIndex.current = index;
      try {
        const details = await loadDetailsFor(slot.library);
        setSlots((prev) => {
          if (!prev) return prev;
          // Bail if the slot has been removed/swapped underneath us.
          if (index >= prev.length) return prev;
          const current = prev[index];
          if (!current || libraryOf(current).id !== slot.library.id) return prev;
          const next = prev.slice();
          next[index] = {
            kind: "ready",
            card: { library: slot.library, details },
          } satisfies CardSlot;
          return next;
        });
      } catch (err) {
        console.error("Failed to load details for rating card", slot.library.tmdb_id, err);
        setSlots((prev) => {
          if (!prev) return prev;
          if (index >= prev.length) return prev;
          const current = prev[index];
          if (!current || libraryOf(current).id !== slot.library.id) return prev;
          const next = prev.slice();
          next[index] = {
            kind: "error",
            library: slot.library,
            message: "Couldn't load details.",
          } satisfies CardSlot;
          return next;
        });
      } finally {
        hydratingIndex.current = null;
      }
    },
    [slots],
  );

  // Kick off hydration for the head and the next couple of cards so the user
  // rarely sees a skeleton.
  useEffect(() => {
    if (!slots) return;
    const targets: number[] = [];
    if (slots.length > 0) targets.push(0);
    if (slots.length > 1) targets.push(1);
    if (slots.length > 2) targets.push(2);
    let cancelled = false;
    setPrefetching(true);
    (async () => {
      for (const i of targets) {
        if (cancelled) return;
        if (!slots[i] || slots[i].kind !== "loading") continue;
        await hydrateSlot(i);
      }
      if (!cancelled) setPrefetching(false);
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally key on the slot list identity; the inner function
    // guards itself against stale closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const current = slots && slots.length > 0 ? slots[0] : null;

  const goBack = useCallback(() => {
    setSlots((prev) => {
      if (!prev || prev.length === 0) return prev;
      setHistory((h) => {
        if (h.length === 0) return h;
        const [tail, ...rest] = h;
        // Tail goes back to the front of the queue.
        const next = prev.slice();
        next.unshift(tail);
        return rest;
      });
      return prev; // history setter is the source of truth
    });
  }, []);

  const skip = useCallback(() => {
    setSlots((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [head, ...rest] = prev;
      // Skipped items go to the back of the queue (Tinder-style "see again
      // later") so the user can churn through the unrated set without
      // permanently losing a card.
      return [...rest, head];
    });
  }, []);

  const submitRating = useCallback(
    async (slot: CardSlot, value: number) => {
      if (slot.kind !== "ready") return;
      setSubmitting(true);
      const lib = slot.card.library;
      try {
        await libraryApi.update(lib.id, { rating: value });
        // Invalidate any cached media details for this item so a revisit
        // (e.g. clicking the title) sees the new rating.
        invalidateCached(`media-details:${lib.media_type === "movie" ? "movie" : "tv"}:${lib.tmdb_id}:en-US`);
        setSlots((prev) => (prev && prev.length > 0 ? prev.slice(1) : prev));
        // We don't push the rated card onto history — the rating has been
        // committed to the server, so "undoing" it would need a separate
        // PATCH. Skipped cards are still reversible through history.
      } catch (err) {
        console.error("Failed to save rating", err);
        toast.error("Couldn't save that rating — please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  // Keyboard support: ← Previous, → Skip, 1-9/0 rate. We also track the
  // currently held number key so the matching rating button can light up
  // even when the user's focus is elsewhere on the page.
  const [keypadValue, setKeypadValue] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submitting || !current) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (current.kind === "ready" && /^[0-9]$/.test(e.key)) {
        const n = e.key === "0" ? 10 : parseInt(e.key, 10);
        e.preventDefault();
        setKeypadValue(n);
        // Clear the highlight on the next frame so the button visually
        // flashes before the card swaps to the next item.
        window.setTimeout(() => setKeypadValue(null), 120);
        submitRating(current, n);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, submitting, skip, goBack, submitRating]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const remaining = slots?.length ?? 0;
  const totalSeen = history.length + (slots && slots.length > 0 ? 1 : 0);

  // Initial / error / empty states are rendered before any slot exists.
  if (slots === null && !error) {
    return <RatingLoadingState message="Loading your unrated library…" />;
  }

  if (error) {
    return (
      <div className="dense-card p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchUnrated}
          className="px-4 py-2 rounded-md bg-[#10b981] text-white font-medium hover:bg-[#0ea271] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Continue Rating</h1>
            <p className="text-theme-secondary text-sm">Rate the unrated items in your library.</p>
          </div>
        </header>
        <div className="dense-card p-10 flex flex-col items-center justify-center text-center">
          <Check className="w-12 h-12 text-[#10b981] mb-4" />
          <h2 className="text-xl font-semibold text-theme-primary">You're all caught up!</h2>
          <p className="text-theme-secondary mt-2 max-w-md">
            Everything in your library has a rating.
            {history.length > 0 &&
              ` You went back through ${history.length} item${history.length === 1 ? "" : "s"} this session.`}
          </p>
          <div className="flex gap-3 mt-6">
            <Link
              to="/library"
              className="px-4 py-2 rounded-md bg-theme-secondary border border-theme text-theme-primary font-medium hover:bg-theme-tertiary transition-colors"
            >
              Back to Library
            </Link>
            <button
              onClick={() => {
                setHistory([]);
                fetchUnrated();
              }}
              className="px-4 py-2 rounded-md bg-[#10b981] text-white font-medium hover:bg-[#0ea271] transition-colors"
            >
              Re-scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Continue Rating</h1>
          <p className="text-theme-secondary text-sm">
            {remaining} unrated item{remaining === 1 ? "" : "s"} left
            {totalSeen > 0 && ` · ${totalSeen} seen this session`}
            {prefetching && remaining > 1 && " · warming up next card"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={goBack}
            disabled={history.length === 0 || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-theme-secondary border border-theme text-sm text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-theme-tertiary transition-colors"
            title="Previous (←)"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={skip}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-theme-secondary border border-theme text-sm text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-theme-tertiary transition-colors"
            title="Skip (→)"
          >
            Skip
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <RatingCardView
        // `key` is keyed off the library row id so React remounts the card
        // on swap, which restarts the fade-in transition.
        key={libraryOf(current).id}
        slot={current}
        submitting={submitting}
        onRate={(v) => submitRating(current, v)}
        onSkip={skip}
        canGoBack={history.length > 0}
        onBack={goBack}
        keypadValue={keypadValue}
      />

      <p className="text-xs text-theme-muted text-center">
        Tip: use <kbd className="px-1 py-0.5 rounded bg-theme-tertiary border border-theme">←</kbd> /
        <kbd className="px-1 py-0.5 rounded bg-theme-tertiary border border-theme ml-1">→</kbd> to
        navigate, <kbd className="px-1 py-0.5 rounded bg-theme-tertiary border border-theme ml-1">1</kbd>–
        <kbd className="px-1 py-0.5 rounded bg-theme-tertiary border border-theme">0</kbd> to rate.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Loading state (initial fetch only — card-level loading uses a skeleton).
// ---------------------------------------------------------------------------

const RatingLoadingState: React.FC<{ message: string }> = ({ message }) => (
  <div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold tracking-tight">Continue Rating</h1>
      <p className="text-theme-secondary text-sm">{message}</p>
    </header>
    <div className="dense-card p-0 overflow-hidden flex flex-col md:flex-row">
      <Skeleton className="w-full md:w-72 lg:w-80 flex-shrink-0 aspect-[3/1] md:aspect-auto md:h-[28rem] rounded-none" />
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-10" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="grid grid-cols-10 gap-1 pt-4">
          {RATING_VALUES.map((n) => (
            <Skeleton key={n} className="h-10" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Card view — handles loading / ready / error slot kinds.
// ---------------------------------------------------------------------------

interface RatingCardViewProps {
  slot: CardSlot;
  submitting: boolean;
  onRate: (value: number) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  keypadValue: number | null;
}

const RatingCardView: React.FC<RatingCardViewProps> = ({
  slot,
  submitting,
  onRate,
  onSkip,
  onBack,
  canGoBack,
  keypadValue,
}) => {
  // Fade-in transition on every card mount.
  return (
    <div className="rating-card-fade">
      {slot.kind === "loading" && <RatingCardSkeleton library={slot.library} />}
      {slot.kind === "error" && <RatingCardError library={slot.library} message={slot.message} />}
      {slot.kind === "ready" && (
        <RatingCardReady
          card={slot.card}
          submitting={submitting}
          onRate={onRate}
          onSkip={onSkip}
          onBack={onBack}
          canGoBack={canGoBack}
          keypadValue={keypadValue}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Skeleton card — used while TMDB details for the current row resolve.
// ---------------------------------------------------------------------------

const RatingCardSkeleton: React.FC<{ library: LibraryItem }> = ({ library }) => (
  <div className="dense-card p-0 overflow-hidden flex flex-col md:flex-row">
    <Skeleton className="w-full md:w-72 lg:w-80 flex-shrink-0 aspect-[3/1] md:aspect-auto md:h-[28rem] rounded-none" />
    <div className="flex-1 p-6 space-y-4 min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded ${
            library.media_type === "movie"
              ? "bg-blue-500/80 text-white"
              : "bg-purple-500/80 text-white"
          }`}
        >
          {library.media_type === "movie" ? "Movie" : "TV"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-10" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <div className="grid grid-cols-10 gap-1 pt-4 border-t border-theme">
        {RATING_VALUES.map((n) => (
          <Skeleton key={n} className="h-10" />
        ))}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Error card — shown when TMDB details fail to load for a row.
// ---------------------------------------------------------------------------

const RatingCardError: React.FC<{ library: LibraryItem; message: string }> = ({
  library,
  message,
}) => (
  <div className="dense-card p-6 text-center">
    <p className="text-theme-secondary mb-2">
      {message} <span className="text-theme-primary font-medium">{library.title}</span>.
    </p>
    <p className="text-xs text-theme-muted">
      Use Skip to move past this item, or Previous to go back.
    </p>
  </div>
);

// ---------------------------------------------------------------------------
// Ready card — full UI. Compact on phones, full split on md+.
// ---------------------------------------------------------------------------

const RatingCardReady: React.FC<{
  card: RateCard;
  submitting: boolean;
  onRate: (value: number) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  keypadValue: number | null;
}> = ({ card, submitting, onRate, onSkip, onBack, canGoBack, keypadValue }) => {
  const { library, details } = card;
  const isTvShow = isShow(details);
  const overview = (details.overview ?? "").trim() || "No description available.";
  const year = details.release_year ?? library.release_year ?? null;
  const runtime = details.runtime_minutes ?? library.runtime_minutes ?? null;
  const genres = details.genres?.length ? details.genres : library.genres;

  return (
    <div className="dense-card p-0 overflow-hidden flex flex-col md:flex-row md:max-h-[calc(100vh-12rem)]">
      {/* Poster + title row:
            - On phones: a small fixed-width square poster on the left, with
              the title, year and media badge inline to its right. Keeps the
              card narrow vertically so the description can sit on the next
              line without pushing the rating bar off-screen.
            - On md+: reverts to the full vertical poster column. */}
      <div className="flex items-start gap-3 p-4 md:p-0 md:contents">
        <div className="relative w-24 flex-shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-theme-tertiary md:w-72 lg:w-80 md:flex-shrink-0 md:aspect-auto md:h-auto md:rounded-none">
          {library.poster_url || details.poster_url ? (
            <img
              src={library.poster_url ?? details.poster_url ?? undefined}
              alt={library.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-8 h-8 md:w-12 md:h-12 text-theme-muted opacity-40" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 md:hidden">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={mediaPath(library.media_type, library.tmdb_id)}
              className="text-lg font-bold text-theme-primary hover:text-[#10b981] transition-colors leading-tight"
            >
              {library.title}
            </Link>
            <span
              className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                library.media_type === "movie"
                  ? "bg-blue-500/80 text-white"
                  : "bg-purple-500/80 text-white"
              }`}
            >
              {library.media_type === "movie" ? (
                <Film className="w-3 h-3" />
              ) : (
                <Tv className="w-3 h-3" />
              )}
              {library.media_type === "movie" ? "Movie" : "TV"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-theme-secondary">
            {year !== null && <span>{year}</span>}
            {runtime !== null && runtime > 0 && (
              <>
                {year !== null && <span>·</span>}
                <span>
                  {Math.floor(runtime / 60)}h {runtime % 60}m
                </span>
              </>
            )}
            {isTvShow && details.number_of_seasons > 0 && (
              <>
                {(year !== null || runtime !== null) && <span>·</span>}
                <span>
                  {details.number_of_seasons} season
                  {details.number_of_seasons === 1 ? "" : "s"}
                </span>
              </>
            )}
            {details.vote_average > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  ★ {details.vote_average.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop media-type badge — only shown at md+ where the title is
          stacked below the poster. */}
      <div className="hidden md:block absolute md:relative md:top-3 md:left-3">
        <span
          className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-1 rounded ${
            library.media_type === "movie"
              ? "bg-blue-500/80 text-white"
              : "bg-purple-500/80 text-white"
          }`}
        >
          {library.media_type === "movie" ? (
            <Film className="w-3 h-3" />
          ) : (
            <Tv className="w-3 h-3" />
          )}
          {library.media_type === "movie" ? "Movie" : "TV"}
        </span>
      </div>

      {/* Content — scrollable on phones so the rating bar is always reachable */}
      <div className="flex-1 px-4 pb-4 md:p-6 flex flex-col gap-3 md:gap-4 min-w-0 md:overflow-y-auto">
        {/* Title block — desktop only; the phone renders its own inline
            version above inside the poster row. */}
        <div className="hidden md:block">
          <Link
            to={mediaPath(library.media_type, library.tmdb_id)}
            className="text-2xl font-bold text-theme-primary hover:text-[#10b981] transition-colors block leading-tight"
          >
            {library.title}
          </Link>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-theme-secondary">
            {year !== null && <span>{year}</span>}
            {runtime !== null && runtime > 0 && (
              <>
                {year !== null && <span>·</span>}
                <span>
                  {Math.floor(runtime / 60)}h {runtime % 60}m
                </span>
              </>
            )}
            {isTvShow && details.number_of_seasons > 0 && (
              <>
                {(year !== null || runtime !== null) && <span>·</span>}
                <span>
                  {details.number_of_seasons} season
                  {details.number_of_seasons === 1 ? "" : "s"}
                </span>
              </>
            )}
            {details.vote_average > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  ★ {details.vote_average.toFixed(1)}
                </span>
              </>
            )}
          </div>
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {genres.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-theme-tertiary text-theme-secondary"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Phone-only genres row — sits below the description area on
            phones. */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 md:hidden">
            {genres.slice(0, 4).map((g) => (
              <span
                key={g}
                className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-theme-tertiary text-theme-secondary"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm text-theme-secondary leading-relaxed line-clamp-4 md:line-clamp-[10]">
          {overview}
        </p>

        {/* Sticky-style rating bar — always visible at the bottom of the
            scrollable content area on phones, inline on md+. */}
        <div className="mt-auto pt-3 md:pt-4 border-t border-theme">
          <RatingBar onRate={onRate} disabled={submitting} keypadValue={keypadValue} />
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={onBack}
              disabled={!canGoBack || submitting}
              className="flex items-center gap-1 text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <button
              onClick={onSkip}
              disabled={submitting}
              className="text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rating bar
// ---------------------------------------------------------------------------

interface RatingBarProps {
  onRate: (value: number) => void;
  disabled: boolean;
  keypadValue: number | null;
}

const RatingBar: React.FC<RatingBarProps> = ({ onRate, disabled, keypadValue }) => {
  // Local hover state gives the bar its "filling" feel without committing
  // to a rating until the user clicks. The global `keypadValue` (set by
  // number-key presses anywhere on the page) takes precedence so the
  // matching button lights up even when focus is elsewhere.
  const [hover, setHover] = useState<number | null>(null);
  const display = keypadValue ?? hover ?? 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-1.5">
        <span className="text-xs uppercase tracking-wide font-semibold text-theme-secondary">
          Your Rating
        </span>
        <span className="text-sm font-bold text-[#10b981]">
          {display > 0 ? `${display}/10` : "—"}
        </span>
      </div>
      <div
        className="grid grid-cols-10 gap-1"
        onMouseLeave={() => setHover(null)}
        role="radiogroup"
        aria-label="Rate out of ten"
      >
        {RATING_VALUES.map((n) => {
          const filled = n <= display;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={keypadValue === n}
              aria-label={`Rate ${n} out of 10`}
              disabled={disabled}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => onRate(n)}
              className={`h-10 rounded-md text-sm font-bold transition-all disabled:cursor-not-allowed ${
                filled
                  ? "bg-[#10b981] text-white shadow-sm"
                  : "bg-theme-tertiary text-theme-secondary hover:bg-theme-tertiary/70"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-theme-muted mt-1.5 px-0.5">
        <span>Hated it</span>
        <span>Loved it</span>
      </div>
    </div>
  );
};

export default ContinueRating;
