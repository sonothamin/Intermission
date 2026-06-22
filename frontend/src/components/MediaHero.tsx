import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Film, Star } from "lucide-react";
import { ExternalLinks } from "./ExternalLinks";
import type { TmdbExternalIds } from "../lib/api";

interface MediaHeroProps {
  backdropUrl: string | null;
  posterUrl: string | null;
  title: string;
  tagline?: string | null;
  mediaType: "movie" | "tv";
  backLabel?: string;
  backTo?: string;
  externalIds?: TmdbExternalIds | null;
  homepage?: string | null;
  children?: React.ReactNode;
}

export const MediaHero: React.FC<MediaHeroProps> = ({
  backdropUrl,
  posterUrl,
  title,
  tagline,
  mediaType,
  backLabel = "Back",
  backTo = "/search",
  externalIds,
  homepage,
  children,
}) => {
  return (
    <div className="relative -mx-4 md:-mx-6 -mt-6 mb-8">
      <div className="relative h-56 md:h-72 lg:h-80 overflow-hidden">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-theme-tertiary" />
        )}
        <div className="absolute inset-0 media-hero-overlay-t" />
        <div className="absolute inset-0 media-hero-overlay-l" />
      </div>

      <div className="absolute top-4 left-4 md:left-6 z-10">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/50 backdrop-blur-sm text-sm text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      </div>

      <div className="relative px-4 md:px-6 -mt-28 md:-mt-32 flex flex-col md:flex-row gap-6">
        <div className="w-36 md:w-44 flex-shrink-0 mx-auto md:mx-0">
          <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border border-theme bg-theme-tertiary">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-12 h-12 text-theme-muted" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 pt-2 md:pt-16 text-center md:text-left min-w-0">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                mediaType === "movie"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-purple-500/20 text-purple-400"
              }`}
            >
              {mediaType === "movie" ? "Movie" : "TV Show"}
            </span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-theme-primary mb-2">
            {title}
          </h1>
          {tagline && (
            <p className="text-theme-secondary italic text-sm md:text-base mb-4">
              {tagline}
            </p>
          )}
          <ExternalLinks
            externalIds={externalIds}
            homepage={homepage}
            className="justify-center md:justify-start mb-4"
          />
          {children}
        </div>
      </div>
    </div>
  );
};

interface MetaChipProps {
  children: React.ReactNode;
}

export const MetaChip: React.FC<MetaChipProps> = ({ children }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-theme-tertiary border border-theme text-xs text-theme-secondary">
    {children}
  </span>
);

interface RatingBadgeProps {
  rating: number;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({ rating }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
    {rating.toFixed(1)}
  </span>
);
