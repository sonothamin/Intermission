import type { MediaType } from "./api";

export function mediaPath(type: MediaType, tmdbId: number): string {
  return type === "movie" ? `/dashboard/movie/${tmdbId}` : `/dashboard/show/${tmdbId}`;
}

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function isMovie(type: MediaType): boolean {
  return type === "movie";
}

export function isTv(type: MediaType): boolean {
  return type === "tv";
}

/**
 * Visual style variants for `mediaTypeBadge`. Keep these in sync with the
 * surfaces where badges appear.
 *   - `soft`:    low-opacity tint used in dense lists (Dashboard, Library, Watchlist rows)
 *   - `solid`:   higher-opacity chip used on hero/poster overlays
 *   - `overlay`: translucent backdrop-blur chip used on hover overlays
 */
export type MediaTypeBadgeVariant = "soft" | "solid" | "overlay";

export interface MediaTypeBadge {
  className: string;
  label: string;
}

const BADGE_BASE =
  "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded";

const BADGE_STYLES: Record<
  MediaType,
  Record<MediaTypeBadgeVariant, string>
> = {
  movie: {
    soft: "bg-blue-500/10 text-blue-400",
    solid: "bg-blue-500/20 text-blue-400",
    overlay: "bg-blue-500/80 text-white",
  },
  tv: {
    soft: "bg-purple-500/10 text-purple-400",
    solid: "bg-purple-500/20 text-purple-400",
    overlay: "bg-purple-500/80 text-white",
  },
};

const BADGE_LABELS: Record<MediaType, string> = {
  movie: "Movie",
  tv: "TV",
};

/**
 * Returns the className (combined with the standard badge base) and display
 * label for a media-type chip. Centralizes the movie-blue / tv-purple colour
 * scheme so call sites stay declarative.
 */
export function mediaTypeBadge(
  type: MediaType,
  variant: MediaTypeBadgeVariant = "soft",
): MediaTypeBadge {
  return {
    className: `${BADGE_BASE} ${BADGE_STYLES[type][variant]}`,
    label: BADGE_LABELS[type],
  };
}

/**
 * Break a duration in minutes into days / hours / minutes components. Returns
 * `null` for non-positive inputs so callers can render their own placeholder.
 */
export function breakdownRuntime(minutes: number | null | undefined): { days: number; hours: number; minutes: number } | null {
  if (!minutes || minutes < 0) return null;
  const total = Math.round(minutes);
  return {
    days: Math.floor(total / 1440),
    hours: Math.floor((total % 1440) / 60),
    minutes: total % 60,
  };
}

/**
 * Format a duration in minutes as `"Xd Yh Zm"`. Zero-valued units are kept so
 * the caller can rely on a stable shape (e.g. `"0d 0h 30m"` for half-hour totals).
 */
export function formatRuntimeLong(minutes: number | null | undefined): string {
  const parts = breakdownRuntime(minutes);
  if (!parts) return "0d 0h 0m";
  return `${parts.days}d ${parts.hours}h ${parts.minutes}m`;
}

/**
 * Convert a 2-letter ISO country code (e.g. `"US"`) to its flag emoji
 * (e.g. `"🇺🇸"`). Returns the input unchanged when it isn't a 2-letter code.
 */
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return countryCode;
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
