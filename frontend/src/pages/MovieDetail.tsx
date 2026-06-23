import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  mediaApi,
  LibraryItem,
  TmdbMovieDetails,
} from "../lib/api";
import { formatRuntime } from "../lib/media";
import { MediaHero, MetaChip, RatingBadge } from "../components/MediaHero";
import { MediaActions } from "../components/MediaActions";
import { CastCrew } from "../components/CastCrew";
import { MediaLoadingState } from "../components/MediaLoadingState";
import { MediaErrorState } from "../components/MediaErrorState";
import { MediaOverview } from "../components/MediaOverview";
import { MediaTrailer } from "../components/MediaTrailer";
import { MediaGenres } from "../components/MediaGenres";
import { MediaDetailsList } from "../components/MediaDetailsList";
import { MediaLinks } from "../components/MediaLinks";
import { Calendar, Clock, Globe } from "lucide-react";

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

  if (loading) return <MediaLoadingState />;
  if (error || !movie) return <MediaErrorState error={error} label="Movie" />;

  return (
    <div>
      <MediaHero
        backdropUrl={movie.backdrop_url}
        posterUrl={movie.poster_url}
        title={movie.title}
        tagline={movie.tagline}
        mediaType="movie"
        backLabel="Back to search"
        backTo="/dashboard/search"
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
          <MediaOverview overview={movie.overview} />
          <CastCrew cast={movie.cast} crew={movie.crew} />
          <MediaTrailer trailerKey={movie.trailer_key} title={movie.title} />
        </div>

        <div className="space-y-4">
          <MediaGenres genres={movie.genres} />
          <MediaDetailsList
            items={[
              { label: "Status", value: movie.status },
              { label: "Release", value: movie.release_date },
              {
                label: "Original",
                value:
                  movie.original_title !== movie.title
                    ? movie.original_title
                    : null,
              },
              {
                label: "Production",
                value:
                  movie.production_companies.length > 0
                    ? movie.production_companies.map((c) => c.name).join(", ")
                    : null,
                fullWidth: true,
              },
            ]}
          />
          <MediaLinks
            externalIds={movie.external_ids}
            homepage={movie.homepage}
          />
        </div>
      </div>
    </div>
  );
};
