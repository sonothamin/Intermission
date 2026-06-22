import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams, Link } from "react-router-dom";
import {
  mediaApi,
  episodeApi,
  libraryApi,
  LibraryItem,
  TmdbShowDetails,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
} from "../lib/api";
import { formatRuntime } from "../lib/media";
import { MediaHero, MetaChip, RatingBadge } from "../components/MediaHero";
import { MediaActions } from "../components/MediaActions";
import { CastCrew } from "../components/CastCrew";
import { ExternalLinks } from "../components/ExternalLinks";
import {
  Loader2,
  Calendar,
  Clock,
  Tv,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Plus,
} from "lucide-react";

export const ShowDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tmdbId = parseInt(id ?? "", 10);

  const [show, setShow] = useState<TmdbShowDetails | null>(null);
  const [userEntry, setUserEntry] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [seasonData, setSeasonData] = useState<Record<number, TmdbSeasonDetails>>({});
  const [seasonLoading, setSeasonLoading] = useState<number | null>(null);
  const [seasonActionLoading, setSeasonActionLoading] = useState<number | null>(null);
  const [episodeToggleLoading, setEpisodeToggleLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId || isNaN(tmdbId)) {
      setError("Invalid show ID");
      setLoading(false);
      return;
    }

    const fetchShow = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await mediaApi.getShow(tmdbId);
        setShow(res.media);
        setUserEntry(res.user_entry);
      } catch (err) {
        console.error(err);
        setError("Show not found");
      } finally {
        setLoading(false);
      }
    };

    fetchShow();
  }, [tmdbId]);

  const toggleSeason = async (season: TmdbSeasonSummary) => {
    if (expandedSeason === season.season_number) {
      setExpandedSeason(null);
      return;
    }

    setExpandedSeason(season.season_number);

    if (!seasonData[season.season_number]) {
      setSeasonLoading(season.season_number);
      try {
        const data = await mediaApi.getSeasonDetails(tmdbId, season.season_number);
        setSeasonData((prev) => ({ ...prev, [season.season_number]: data }));
      } catch (err) {
        console.error(err);
      } finally {
        setSeasonLoading(null);
      }
    }
  };

  const handleAddEpisodeToLib = async (seasonNumber: number, episodeNumber: number) => {
    try {
      let currentEntry = userEntry;
      if (!currentEntry) {
        try {
          currentEntry = await libraryApi.add({
            tmdb_id: tmdbId,
            media_type: "tv",
            status: "watching",
          });
        } catch (addErr: any) {
          if (addErr.message === "This item is already in your library") {
            const res = await mediaApi.getShow(tmdbId);
            currentEntry = res.user_entry;
          } else {
            throw addErr;
          }
        }
        setUserEntry(currentEntry);
      }
      
      await episodeApi.markEpisode({
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        watched: true,
      });

      setSeasonData((prev) => {
        const season = prev[seasonNumber];
        if (!season) return prev;
        return {
          ...prev,
          [seasonNumber]: {
            ...season,
            episodes: season.episodes.map((ep) =>
              ep.episode_number === episodeNumber
                ? {
                    ...ep,
                    user_progress: {
                      watched: true,
                      watched_at: new Date().toISOString(),
                      rating: ep.user_progress?.rating ?? null,
                      notes: ep.user_progress?.notes ?? null,
                    },
                  }
                : ep,
            ),
          },
        };
      });
      
      const res = await mediaApi.getShow(tmdbId);
      setUserEntry(res.user_entry);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add episode to library.");
    }
  };

  const handleAddSeasonToLib = async (season: TmdbSeasonSummary) => {
    setSeasonActionLoading(season.season_number);
    try {
      let currentEntry = userEntry;
      if (!currentEntry) {
        try {
          currentEntry = await libraryApi.add({
            tmdb_id: tmdbId,
            media_type: "tv",
            status: "watching",
          });
        } catch (addErr: any) {
          if (addErr.message === "This item is already in your library") {
            const res = await mediaApi.getShow(tmdbId);
            currentEntry = res.user_entry;
          } else {
            throw addErr;
          }
        }
        setUserEntry(currentEntry);
      }

      let sDetails = seasonData[season.season_number];
      if (!sDetails) {
        setSeasonLoading(season.season_number);
        sDetails = await mediaApi.getSeasonDetails(tmdbId, season.season_number);
        setSeasonData((prev) => ({ ...prev, [season.season_number]: sDetails }));
        setSeasonLoading(null);
      }

      const episodeNumbers = sDetails.episodes.map(ep => ep.episode_number);

      await episodeApi.bulkMark({
        tmdb_id: tmdbId,
        season_number: season.season_number,
        episodes: episodeNumbers,
        watched: true,
      });

      // Always update local season cache with all episodes marked watched,
      // using sDetails which is guaranteed to be loaded by this point.
      const now = new Date().toISOString();
      setSeasonData((prev) => ({
        ...prev,
        [season.season_number]: {
          ...sDetails,
          episodes: sDetails.episodes.map((ep) => ({
            ...ep,
            user_progress: {
              watched: true,
              watched_at: now,
              rating: ep.user_progress?.rating ?? null,
              notes: ep.user_progress?.notes ?? null,
            },
          })),
        },
      }));

      const res = await mediaApi.getShow(tmdbId);
      setUserEntry(res.user_entry);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add season to library.");
    } finally {
      setSeasonActionLoading(null);
    }
  };

  /** Called by MediaActions' onAfterAdd — marks every episode in every season watched. */
  const handleAddShowToLib = async (_entry: import("../lib/api").LibraryItem) => {
    if (!show) return;
    const realSeasons = show.seasons.filter((s) => s.season_number > 0);

    // Fetch all season details in parallel
    const allSeasonDetails = await Promise.all(
      realSeasons.map((s) =>
        seasonData[s.season_number]
          ? Promise.resolve(seasonData[s.season_number])
          : mediaApi.getSeasonDetails(tmdbId, s.season_number),
      ),
    );

    // Update local cache and optimistically mark all episodes as watched
    setSeasonData((prev) => {
      const next = { ...prev };
      realSeasons.forEach((s, i) => { 
        const details = allSeasonDetails[i];
        next[s.season_number] = {
          ...details,
          episodes: details.episodes.map(ep => ({
            ...ep,
            user_progress: {
              ...ep.user_progress,
              watched: true,
              watched_at: new Date().toISOString(),
              rating: ep.user_progress?.rating ?? null,
              notes: ep.user_progress?.notes ?? null,
            }
          }))
        };
      });
      return next;
    });

    // Build multi-season payload and send a single bulk call
    const seasons = realSeasons.map((s, i) => ({
      season_number: s.season_number,
      episodes: allSeasonDetails[i].episodes.map((ep) => ep.episode_number),
    }));

    await episodeApi.bulkMarkMultiSeason({
      tmdb_id: tmdbId,
      seasons,
      watched: true,
    });

    // Refresh user entry to get updated episode count + auto-completed status
    const res = await mediaApi.getShow(tmdbId);
    setUserEntry(res.user_entry);
  };

  const handleToggleEpisode = async (
    seasonNumber: number,
    episodeNumber: number,
    currentlyWatched: boolean,
  ) => {
    const key = `${seasonNumber}-${episodeNumber}`;
    setEpisodeToggleLoading(key);
    try {
      await episodeApi.markEpisode({
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        watched: !currentlyWatched,
      });

      setSeasonData((prev) => {
        const season = prev[seasonNumber];
        if (!season) return prev;
        return {
          ...prev,
          [seasonNumber]: {
            ...season,
            episodes: season.episodes.map((ep) =>
              ep.episode_number === episodeNumber
                ? {
                    ...ep,
                    user_progress: {
                      watched: !currentlyWatched,
                      watched_at: !currentlyWatched ? new Date().toISOString() : null,
                      rating: ep.user_progress?.rating ?? null,
                      notes: ep.user_progress?.notes ?? null,
                    },
                  }
                : ep,
            ),
          },
        };
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to update episode.");
    } finally {
      setEpisodeToggleLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">{error ?? "Show not found"}</p>
        <Link to="/search" className="text-[#10b981] hover:underline text-sm">
          Back to search
        </Link>
      </div>
    );
  }

  const seasons = show.seasons.filter((s) => s.season_number > 0);

  return (
    <div>
      <MediaHero
        backdropUrl={show.backdrop_url}
        posterUrl={show.poster_url}
        title={show.title}
        tagline={show.tagline}
        mediaType="tv"
        backLabel="Back to search"
        backTo="/search"
      >
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
          {show.release_year && (
            <MetaChip>
              <Calendar className="w-3 h-3" />
              {show.release_year}
              {show.last_air_date && ` – ${show.last_air_date.slice(0, 4)}`}
            </MetaChip>
          )}
          <MetaChip>
            <Tv className="w-3 h-3" />
            {show.number_of_seasons} season{show.number_of_seasons !== 1 ? "s" : ""} ·{" "}
            {show.number_of_episodes} episodes
          </MetaChip>
          {show.runtime_minutes && (
            <MetaChip>
              <Clock className="w-3 h-3" />
              {formatRuntime(show.runtime_minutes)} / ep
            </MetaChip>
          )}
          {show.vote_average > 0 && <RatingBadge rating={show.vote_average} />}
        </div>

        <MediaActions
          tmdbId={show.tmdb_id}
          mediaType="tv"
          userEntry={userEntry}
          onUserEntryChange={setUserEntry}
          onAfterAdd={handleAddShowToLib}
        />
      </MediaHero>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {show.overview && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Overview
              </h2>
              <p className="text-theme-secondary leading-relaxed">{show.overview}</p>
            </section>
          )}

          <CastCrew cast={show.cast} crew={show.crew} />

          <section className="dense-card">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-4">
              Seasons
            </h2>
            <div className="space-y-2">
              {seasons.map((season) => {
                const isExpanded = expandedSeason === season.season_number;
                const data = seasonData[season.season_number];
                const watchedCount =
                  data?.episodes.filter((ep) => ep.user_progress?.watched).length ?? 0;

                return (
                  <div
                    key={season.season_number}
                    className="border border-theme rounded-lg overflow-hidden"
                  >
                    <div className="w-full flex items-center justify-between p-3 bg-theme-secondary hover:bg-theme-tertiary transition-colors border-b border-theme/50">
                      <button
                        onClick={() => toggleSeason(season)}
                        className="flex-1 flex items-center gap-3 text-left outline-none"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-theme-muted flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-theme-muted flex-shrink-0" />
                        )}
                        {season.poster_url ? (
                          <img
                            src={season.poster_url}
                            alt={season.name}
                            className="w-10 h-14 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-theme-tertiary rounded flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-theme-primary truncate">{season.name}</p>
                          <p className="text-xs text-theme-muted">
                            {season.episode_count} episodes
                            {data && userEntry
                              ? ` · ${watchedCount}/${season.episode_count} watched`
                              : ""}
                          </p>
                        </div>
                      </button>

                      {data && watchedCount === season.episode_count ? (
                        <span className="text-xs text-[#10b981] flex items-center gap-1 ml-2 font-medium bg-[#10b981]/10 px-2.5 py-1 border border-[#10b981]/20 rounded-md flex-shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Watched
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSeasonToLib(season);
                          }}
                          disabled={seasonActionLoading === season.season_number}
                          className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 ml-2 hover:bg-[#10b981]/10 hover:border-[#10b981]/30 hover:text-[#10b981] flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {seasonActionLoading === season.season_number ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Add Season to Lib
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-theme bg-theme-primary">
                        {seasonLoading === season.season_number ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 text-[#10b981] animate-spin" />
                          </div>
                        ) : data ? (
                          <div className="divide-y divide-[var(--border-subtle)]">
                            {data.episodes.map((ep) => {
                              const watched = ep.user_progress?.watched ?? false;
                              return (
                                <div
                                  key={ep.episode_number}
                                  className="flex items-start gap-3 p-3 hover:bg-theme-secondary transition-colors"
                                >
                                  <span className="text-xs font-mono text-theme-muted w-6 text-center mt-1 flex-shrink-0">
                                    {ep.episode_number}
                                  </span>
                                  {ep.still_url && (
                                    <img
                                      src={ep.still_url}
                                      alt={ep.name}
                                      className="w-24 h-14 object-cover rounded flex-shrink-0 hidden sm:block"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-theme-primary">
                                      {ep.episode_number}. {ep.name}
                                    </p>
                                    {ep.overview && (
                                      <p className="text-xs text-theme-muted mt-1 line-clamp-2">
                                        {ep.overview}
                                      </p>
                                    )}
                                    <div className="flex gap-3 mt-1 text-xs text-theme-muted">
                                      {ep.air_date && <span>{ep.air_date}</span>}
                                      {ep.runtime_minutes && (
                                        <span>{formatRuntime(ep.runtime_minutes)}</span>
                                      )}
                                    </div>
                                  </div>

                                  {userEntry ? (
                                    <button
                                      onClick={() =>
                                        handleToggleEpisode(
                                          season.season_number,
                                          ep.episode_number,
                                          watched,
                                        )
                                      }
                                      disabled={
                                        episodeToggleLoading ===
                                        `${season.season_number}-${ep.episode_number}`
                                      }
                                      className={`py-1 px-3 text-xs flex items-center gap-1.5 flex-shrink-0 transition-colors font-medium border rounded-md disabled:opacity-70 disabled:cursor-not-allowed ${
                                        watched
                                          ? "bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]"
                                          : "bg-theme-tertiary border-theme-focus text-theme-primary hover:bg-theme-tertiary hover:text-white"
                                      }`}
                                      title={watched ? "Mark unwatched" : "Mark watched"}
                                    >
                                      {episodeToggleLoading ===
                                      `${season.season_number}-${ep.episode_number}` ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Saving…
                                        </>
                                      ) : watched ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Watched
                                        </>
                                      ) : (
                                        "Mark Watched"
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleAddEpisodeToLib(
                                          season.season_number,
                                          ep.episode_number,
                                        )
                                      }
                                      className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1.5 ml-2 hover:bg-[#10b981]/10 hover:border-[#10b981]/30 hover:text-[#10b981] flex-shrink-0 transition-colors"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Add to Lib
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-theme-muted p-4 text-center">
                            Failed to load episodes
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {show.trailer_key && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Trailer
              </h2>
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${show.trailer_key}`}
                  title={`${show.title} trailer`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {show.genres.length > 0 && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Genres
              </h2>
              <div className="flex flex-wrap gap-2">
                {show.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-2.5 py-1 text-xs rounded-md bg-theme-tertiary border border-theme text-theme-secondary"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="dense-card space-y-3">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              {show.status && (
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-muted">Status</dt>
                  <dd className="text-theme-secondary text-right">{show.status}</dd>
                </div>
              )}
              {show.networks.length > 0 && (
                <div>
                  <dt className="text-theme-muted mb-1">Network</dt>
                  <dd className="text-theme-secondary">
                    {show.networks.map((n) => n.name).join(", ")}
                  </dd>
                </div>
              )}
              {show.first_air_date && (
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-muted">First aired</dt>
                  <dd className="text-theme-secondary text-right">{show.first_air_date}</dd>
                </div>
              )}
            </dl>
          </section>

          {(show.external_ids || show.homepage) && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Links
              </h2>
              <ExternalLinks
                externalIds={show.external_ids}
                homepage={show.homepage}
                className="flex-col items-stretch gap-2 [&>a]:justify-start"
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
