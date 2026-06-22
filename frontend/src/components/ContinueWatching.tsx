import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Loader2, Play, Tv } from "lucide-react";
import {
  episodeApi,
  libraryApi,
  LibraryItem,
  mediaApi,
  TmdbEpisode,
  TmdbShowDetails,
} from "../lib/api";
import { mediaPath } from "../lib/media";
import { parallelMap } from "../lib/tmdbCache";

interface ContinueWatchingProps {
  /** Called whenever a card is dismissed/advanced so the parent can re-fetch. */
  onChange?: () => void;
}

interface ContinueWatchingCard {
  library: LibraryItem;
  show: TmdbShowDetails;
  seasonNumber: number;
  episodeNumber: number;
  episode: TmdbEpisode | null;
}

/**
 * Pick the next episode the user should watch for a given library row.
 * Returns null if there are no more episodes (show is fully watched).
 */
function pickNextEpisode(
  library: LibraryItem,
  show: TmdbShowDetails,
): { seasonNumber: number; episodeNumber: number } | null {
  if (show.number_of_episodes > 0 && library.episodes_watched >= show.number_of_episodes) {
    return null;
  }

  const realSeasons = show.seasons
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const startSeason = library.current_season ?? realSeasons[0]?.season_number ?? 1;
  const startEpisode = (library.current_episode ?? 0) + 1;

  for (const season of realSeasons) {
    if (season.season_number < startSeason) continue;

    const firstEp = season.season_number === startSeason ? startEpisode : 1;
    if (firstEp <= season.episode_count) {
      return { seasonNumber: season.season_number, episodeNumber: firstEp };
    }
  }

  return null;
}

/**
 * Optimistic library row update after marking an episode watched.
 * Mirrors what `updateEpisodesWatched` does on the server.
 */
function bumpLibraryAfterWatch(lib: LibraryItem, seasonNumber: number, episodeNumber: number): LibraryItem {
  // Heuristic for "next episode":
  //   - same season, episode + 1, unless we're at the season's episode_count
  // We deliberately keep this optimistic and let the next library refresh
  // (triggered by `onChange`) reconcile any drift.
  return {
    ...lib,
    episodes_watched: lib.episodes_watched + 1,
    current_season: seasonNumber,
    current_episode: episodeNumber,
  };
}

export const ContinueWatching: React.FC<ContinueWatchingProps> = ({ onChange }) => {
  const [items, setItems] = useState<ContinueWatchingCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const fetchContinueWatching = useCallback(async () => {
    setLoading(true);
    try {
      const res = await libraryApi.list({ status: "watching", type: "tv", limit: 50 });
      const shows = res.data;
      if (shows.length === 0) {
        setItems([]);
        return;
      }

      // Step 1 — fan out `getShow` for every in-progress show in parallel.
      // `cachedFetch` ensures the Supabase edge function is only hit once per
      // show even if this component remounts.
      const showResults = await parallelMap(shows, 6, async (lib) => {
        try {
          const showRes = await mediaApi.getShow(lib.tmdb_id);
          const next = pickNextEpisode(lib, showRes.media);
          return next ? { lib, show: showRes.media, next } : null;
        } catch (err) {
          console.error("Failed to load continue-watching show", lib.tmdb_id, err);
          return null;
        }
      });

      // Step 2 — fan out season lookups for cards that need episode metadata,
      // also in parallel. Cards that already have what they need (or where the
      // season call fails) simply render with `episode: null`.
      const cards = await parallelMap(
        showResults.filter((r): r is { lib: LibraryItem; show: TmdbShowDetails; next: { seasonNumber: number; episodeNumber: number } } => r !== null),
        6,
        async ({ lib, show, next }) => {
          let episode: TmdbEpisode | null = null;
          try {
            const season = await mediaApi.getSeasonDetails(lib.tmdb_id, next.seasonNumber);
            episode = season.episodes.find((e) => e.episode_number === next.episodeNumber) ?? null;
          } catch {
            // Best-effort: render the show backdrop with "Episode N".
          }
          return {
            library: lib,
            show,
            seasonNumber: next.seasonNumber,
            episodeNumber: next.episodeNumber,
            episode,
          } satisfies ContinueWatchingCard;
        },
      );

      setItems(cards);
    } catch (err) {
      console.error("Failed to load Continue Watching", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContinueWatching();
  }, [fetchContinueWatching]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by roughly one card width.
    const amount = Math.max(240, el.clientWidth * 0.8);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  const handleMarkWatched = useCallback(
    async (card: ContinueWatchingCard) => {
      const key = `${card.library.tmdb_id}-${card.seasonNumber}-${card.episodeNumber}`;
      setMarking(key);
      try {
        await episodeApi.markEpisode({
          tmdb_id: card.library.tmdb_id,
          season_number: card.seasonNumber,
          episode_number: card.episodeNumber,
          watched: true,
        });

        // Optimistically advance the card locally. The server's
        // `updateEpisodesWatched` already updated `current_season`,
        // `current_episode`, and `episodes_watched` on the library row; we
        // mirror that here so the UI feels instant without a TMDB round-trip.
        const optimisticLibrary = bumpLibraryAfterWatch(
          card.library,
          card.seasonNumber,
          card.episodeNumber,
        );

        const show = card.show;
        const next = pickNextEpisode(optimisticLibrary, show);

        if (!next) {
          // Show is now fully watched — drop the card.
          setItems((prev) => prev?.filter((c) => c.library.id !== card.library.id) ?? prev);
          onChange?.();
          return;
        }

        // Only refetch the season if we crossed into a new season (or the
        // current season's episode list isn't cached). Within the same season
        // we already know the next episode's metadata isn't critical — the
        // backend TMDB cache + our local cache handle it on the next render.
        let nextEpisode: TmdbEpisode | null = null;
        const crossedSeason = next.seasonNumber !== card.seasonNumber;
        if (crossedSeason || card.episode === null) {
          try {
            const season = await mediaApi.getSeasonDetails(card.library.tmdb_id, next.seasonNumber);
            nextEpisode = season.episodes.find((e) => e.episode_number === next.episodeNumber) ?? null;
          } catch {
            // ignore
          }
        } else {
          nextEpisode = card.episode;
        }

        setItems((prev) =>
          (prev ?? []).map((c) =>
            c.library.id === card.library.id
              ? {
                  library: optimisticLibrary,
                  show,
                  seasonNumber: next.seasonNumber,
                  episodeNumber: next.episodeNumber,
                  episode: nextEpisode,
                }
              : c,
          ),
        );
        onChange?.();
      } catch (err) {
        console.error(err);
        toast.error("Failed to mark episode as watched.");
      } finally {
        setMarking(null);
      }
    },
    [onChange],
  );

  const totalRemaining = useMemo(
    () => (items ?? []).reduce((sum, c) => sum + Math.max(0, c.show.number_of_episodes - c.library.episodes_watched), 0),
    [items],
  );

  // Don't render the section at all if there's nothing to show.
  if (!loading && (items?.length ?? 0) === 0) return null;

  return (
    <section className="dense-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-theme-primary uppercase tracking-wider flex items-center gap-2">
          <Tv className="w-4 h-4 text-[#10b981]" />
          Continue Watching
          {!loading && items && items.length > 0 && (
            <span className="text-xs font-normal text-theme-muted normal-case">
              {items.length} show{items.length === 1 ? "" : "s"} · {totalRemaining} episode
              {totalRemaining === 1 ? "" : "s"} left
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="p-1.5 rounded-md bg-theme-tertiary border border-theme text-theme-secondary hover:text-theme-primary hover:border-theme-focus transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="p-1.5 rounded-md bg-theme-tertiary border border-theme text-theme-secondary hover:text-theme-primary hover:border-theme-focus transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-theme-secondary text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scroll-smooth [scrollbar-width:thin]"
        >
          {items!.map((card) => {
            const key = `${card.library.tmdb_id}-${card.seasonNumber}-${card.episodeNumber}`;
            const isMarking = marking === key;
            const progressPct =
              card.show.number_of_episodes > 0
                ? Math.min(
                    100,
                    Math.round((card.library.episodes_watched / card.show.number_of_episodes) * 100),
                  )
                : 0;
            return (
              <div
                key={card.library.id}
                className="snap-start shrink-0 w-64 sm:w-72 bg-theme-secondary border border-theme rounded-lg overflow-hidden flex flex-col"
              >
                <div className="relative aspect-video bg-theme-tertiary">
                  {card.episode?.still_url ? (
                    <img
                      src={card.episode.still_url}
                      alt={card.episode.name}
                      className="w-full h-full object-cover"
                    />
                  ) : card.show.backdrop_url ? (
                    <img
                      src={card.show.backdrop_url}
                      alt={card.show.title}
                      className="w-full h-full object-cover"
                    />
                  ) : card.library.poster_url ? (
                    <img
                      src={card.library.poster_url}
                      alt={card.show.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-theme-muted">
                      <Tv className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                    <div
                      className="h-full bg-[#10b981]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white">
                      S{card.seasonNumber} · E{card.episodeNumber}
                    </span>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="min-h-0">
                    <Link
                      to={mediaPath("tv", card.library.tmdb_id)}
                      className="text-sm font-semibold text-theme-primary hover:text-[#10b981] line-clamp-1 transition-colors"
                      title={card.show.title}
                    >
                      {card.show.title}
                    </Link>
                    <p
                      className="text-xs text-theme-secondary line-clamp-2 mt-0.5"
                      title={card.episode?.name ?? `Episode ${card.episodeNumber}`}
                    >
                      {card.episode?.name ?? `Episode ${card.episodeNumber}`}
                    </p>
                    {card.episode?.air_date && (
                      <p className="text-[11px] text-theme-muted mt-1">
                        Aired {card.episode.air_date}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-1">
                    <button
                      type="button"
                      onClick={() => handleMarkWatched(card)}
                      disabled={isMarking}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#10b981]/10 border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMarking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Mark Watched
                    </button>
                    <Link
                      to={mediaPath("tv", card.library.tmdb_id)}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-theme-tertiary border border-theme text-theme-secondary hover:text-theme-primary hover:border-theme-focus transition-colors"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
