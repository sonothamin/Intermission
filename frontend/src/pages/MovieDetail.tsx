import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  mediaApi,
  LibraryItem,
  TmdbMovieDetails,
} from "../lib/api";
import { formatRuntime } from "../lib/media";
import { MediaHero, MetaChip, RatingBadge } from "../components/MediaHero";
import { MediaActions } from "../components/MediaActions";
import { Loader2, Calendar, Clock, Globe } from "lucide-react";

export const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tmdbId = parseInt(id ?? "", 10);

  const [movie, setMovie] = useState<TmdbMovieDetails | null>(null);
  const [userEntry, setUserEntry] = useState<LibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tmdbId || isNaN(tmdbId)) {
      setError("Invalid movie ID");
      setLoading(false);
      return;
    }

    const fetchMovie = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await mediaApi.getMovie(tmdbId);
        setMovie(res.media);
        setUserEntry(res.user_entry);
      } catch (err) {
        console.error(err);
        setError("Movie not found");
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [tmdbId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">{error ?? "Movie not found"}</p>
        <Link to="/search" className="text-[#10b981] hover:underline text-sm">
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div>
      <MediaHero
        backdropUrl={movie.backdrop_url}
        posterUrl={movie.poster_url}
        title={movie.title}
        tagline={movie.tagline}
        mediaType="movie"
        backLabel="Back to search"
        backTo="/search"
      >
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
          {movie.release_year && (
            <MetaChip>
              <Calendar className="w-3 h-3" />
              {movie.release_year}
            </MetaChip>
          )}
          {movie.runtime_minutes && (
            <MetaChip>
              <Clock className="w-3 h-3" />
              {formatRuntime(movie.runtime_minutes)}
            </MetaChip>
          )}
          {movie.vote_average > 0 && <RatingBadge rating={movie.vote_average} />}
          {movie.original_language && (
            <MetaChip>
              <Globe className="w-3 h-3" />
              {movie.original_language.toUpperCase()}
            </MetaChip>
          )}
        </div>

        <MediaActions
          tmdbId={movie.tmdb_id}
          mediaType="movie"
          userEntry={userEntry}
          onUserEntryChange={setUserEntry}
        />
      </MediaHero>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {movie.overview && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Overview
              </h2>
              <p className="text-theme-secondary leading-relaxed">{movie.overview}</p>
            </section>
          )}

          {movie.trailer_key && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Trailer
              </h2>
              <div className="aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${movie.trailer_key}`}
                  title={`${movie.title} trailer`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4">
          {movie.genres.length > 0 && (
            <section className="dense-card">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
                Genres
              </h2>
              <div className="flex flex-wrap gap-2">
                {movie.genres.map((genre) => (
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
              {movie.status && (
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-muted">Status</dt>
                  <dd className="text-theme-secondary text-right">{movie.status}</dd>
                </div>
              )}
              {movie.release_date && (
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-muted">Release</dt>
                  <dd className="text-theme-secondary text-right">{movie.release_date}</dd>
                </div>
              )}
              {movie.original_title !== movie.title && (
                <div className="flex justify-between gap-4">
                  <dt className="text-theme-muted">Original</dt>
                  <dd className="text-theme-secondary text-right">{movie.original_title}</dd>
                </div>
              )}
              {movie.production_companies.length > 0 && (
                <div>
                  <dt className="text-theme-muted mb-1">Production</dt>
                  <dd className="text-theme-secondary">
                    {movie.production_companies.map((c) => c.name).join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
};
