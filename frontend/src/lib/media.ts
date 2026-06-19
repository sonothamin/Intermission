import type { MediaType } from "./api";

export function mediaPath(type: MediaType, tmdbId: number): string {
  return type === "movie" ? `/movie/${tmdbId}` : `/show/${tmdbId}`;
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
