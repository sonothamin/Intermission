// =============================================================================
// frontend/src/pages/ContinueRating.tsx
//
// "Continue Rating" — Tinder-style one-at-a-time flow for rating every unrated
// movie and TV show in the user's library. Loads all library items where
// `rating IS NULL`, then walks through them with Previous / Next / Skip
// controls plus a 1–10 rating bar. Submitting a rating updates the library
// row via the existing `libraryApi.update` and advances the stack.
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Film,
  Loader2,
  RotateCcw,
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
import { parallelMap } from "../lib/tmdbCache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MediaDetails = TmdbMovieDetails | TmdbShowDetails;

interface RateCard {
  library: LibraryItem;
  details: MediaDetails;
}

const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pull a long-form description for a library row. Library rows don't carry
 * the TMDB overview, so we hydrate the underlying media once per item and
 * cache the result locally. This keeps the page snappy even with hundreds of
 * unrated items.
 */
async function loadDetails(lib: LibraryItem): Promise<MediaDetails> {
  const res =
    lib.media_type === "movie"
      ? await mediaApi.getMovie(lib.tmdb_id)
      : await mediaApi.getShow(lib.tmdb_id);
  return res.media;
}

function isShow(d: MediaDetails): d is TmdbShowDetails {
  return d.media_type === "tv";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ContinueRating: React.FC = () => {
  const [queue, setQueue] = useState<RateCard[] | null>(null);
  const [history, setHistory] = useState<RateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all unrated library items and hydrate their TMDB details.
  // The library list endpoint doesn't expose a `rating IS NULL` filter, so we
  // page through the full library client-side and pick the unrated rows.
  // Capped at 200 items — the rating flow is meant to clear the backlog, not
  // be a permanent analytics view.
  const fetchUnrated = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all: LibraryItem[] = [];
      const limit = 100;
      let page = 1;
      let totalPages = 1;
      do {
        const res = await libraryApi.list({ page, limit });
        all.push(...res.data);
        totalPages = res.pagination.total_pages;
        page += 1;
        if (page > 20) break; // safety: cap at 2000 rows
      } while (page <= totalPages);

      const unrated = all.filter((it) => it.rating === null);

      if (unrated.length === 0) {
        setQueue([]);
        setHistory([]);
        return;
      }

      // Hydrate TMDB details in parallel. We already cache media details via
      // `mediaApi.getMovie`/`getShow` (sessionStorage + memory), so repeat
      // visits are nearly free.
      const cards = await parallelMap(unrated, 6, async (lib) => {
        try {
          const details = await loadDetails(lib);
          return { library: lib, details } satisfies RateCard;
        } catch (err) {
          console.error("Failed to load details for rating card", lib.tmdb_id, err);
          return null;
        }
      });

      setQueue(cards.filter((c): c is RateCard => c !== null));
      setHistory([]);
    } catch (err) {
      console.error("Failed to load unrated library", err);
      setError("Couldn't load your library. Please try again.");
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnrated();
  }, [fetchUnrated]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const current = queue && queue.length > 0 ? queue[0] : null;

  const goBack = useCallback(() => {
    setQueue((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [head, ...rest] = prev;
      setHistory((h) => [...h, head]);
      return rest;
    });
  }, []);

  const skip = useCallback(() => {
    setQueue((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [head, ...rest] = prev;
      // Skipped items go to the back of the queue (Tinder style "see again
      // later" semantics) so the user can churn through the unrated set
      // without permanently losing a card.
      return [...rest, head];
    });
  }, []);

  const submitRating = useCallback(
    async (card: RateCard, value: number) => {
      setSubmitting(true);
      try {
        await libraryApi.update(card.library.id, { rating: value });
        setQueue((prev) => (prev && prev.length > 0 ? prev.slice(1) : prev));
      } catch (err) {
        console.error("Failed to save rating", err);
        toast.error("Couldn't save that rating — please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  // Keyboard support: ←/→ skip/navigate, 1-9/0 set rating.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submitting || !current) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (/^[0-9]$/.test(e.key)) {
        const n = e.key === "0" ? 10 : parseInt(e.key, 10);
        e.preventDefault();
        submitRating(current, n);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, submitting, skip, goBack, submitRating]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const remaining = queue?.length ?? 0;
  const totalSeen = (history?.length ?? 0) + (queue ? (queue.length > 0 ? 1 : 0) : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-theme-secondary">
        <Loader2 className="w-6 h-6 text-[#10b981] animate-spin mr-2" />
        Loading your unrated library…
      </div>
    );
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
            {history.length > 0 && ` You rated ${history.length} item${history.length === 1 ? "" : "s"} this session.`}
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
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Continue Rating</h1>
          <p className="text-theme-secondary text-sm">
            {remaining} unrated item{remaining === 1 ? "" : "s"} left
            {totalSeen > 0 && ` · ${totalSeen} seen this session`}
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
        card={current}
        submitting={submitting}
        onRate={(v) => submitRating(current, v)}
        onSkip={skip}
        canGoBack={history.length > 0}
        onBack={goBack}
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
// Card view
// ---------------------------------------------------------------------------

interface RatingCardViewProps {
  card: RateCard;
  submitting: boolean;
  onRate: (value: number) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
}

const RatingCardView: React.FC<RatingCardViewProps> = ({
  card,
  submitting,
  onRate,
  onSkip,
  onBack,
  canGoBack,
}) => {
  const { library, details } = card;
  const isTvShow = isShow(details);
  const overview = (details.overview ?? "").trim() || "No description available.";
  const year = details.release_year ?? library.release_year ?? null;
  const runtime = details.runtime_minutes ?? library.runtime_minutes ?? null;
  const genres = details.genres?.length ? details.genres : library.genres;

  return (
    <div className="dense-card p-0 overflow-hidden flex flex-col md:flex-row">
      {/* Poster */}
      <div className="relative w-full md:w-72 lg:w-80 flex-shrink-0 bg-theme-tertiary aspect-[2/3] md:aspect-auto">
        {library.poster_url || details.poster_url ? (
          <img
            src={library.poster_url ?? details.poster_url ?? undefined}
            alt={library.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-12 h-12 text-theme-muted opacity-40" />
          </div>
        )}
        <div className="absolute top-3 left-3">
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
      </div>

      {/* Content */}
      <div className="flex-1 p-6 flex flex-col gap-4 min-w-0">
        <div>
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
                <span>{Math.floor(runtime / 60)}h {runtime % 60}m</span>
              </>
            )}
            {isTvShow && details.number_of_seasons > 0 && (
              <>
                {(year !== null || runtime !== null) && <span>·</span>}
                <span>
                  {details.number_of_seasons} season{details.number_of_seasons === 1 ? "" : "s"}
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

        <p className="text-sm text-theme-secondary leading-relaxed line-clamp-6 md:line-clamp-[10]">
          {overview}
        </p>

        <div className="mt-auto pt-4 border-t border-theme">
          <RatingBar onRate={onRate} disabled={submitting} />
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={onBack}
              disabled={!canGoBack || submitting}
              className="flex items-center gap-1 text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Undo last
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
}

const RatingBar: React.FC<RatingBarProps> = ({ onRate, disabled }) => {
  // Local hover state gives the bar its "filling" feel without committing
  // to a rating until the user clicks.
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? 0;

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
              aria-checked={false}
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
