// =============================================================================
// _shared/tmdb.ts — TMDB API wrapper with caching
// =============================================================================

import { getAdminClient } from "./db.ts";
import { createLogger } from "./logger.ts";

const log = createLogger("tmdb");

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const CACHE_TTL_HOURS = 24;
const SEARCH_CACHE_TTL_HOURS = 1; // search results expire faster

export interface TmdbMovie {
  tmdb_id: number;
  media_type: "movie";
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  release_date: string | null;
  genres: string[];
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  runtime_minutes: number | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  tagline: string | null;
  status: string | null;
  budget: number | null;
  revenue: number | null;
  production_companies: { id: number; name: string; origin_country: string }[];
  spoken_languages: { iso_639_1: string; name: string }[];
  imdb_id: string | null;
  trailer_key: string | null;
  homepage: string | null;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
  external_ids: TmdbExternalIds;
}

export interface TmdbShow {
  tmdb_id: number;
  media_type: "tv";
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  first_air_date: string | null;
  last_air_date: string | null;
  genres: string[];
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  runtime_minutes: number | null; // average episode runtime
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  tagline: string | null;
  status: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: TmdbSeasonSummary[];
  networks: { id: number; name: string; origin_country: string }[];
  spoken_languages: { iso_639_1: string; name: string }[];
  trailer_key: string | null;
  in_production: boolean;
  homepage: string | null;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
  external_ids: TmdbExternalIds;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  original_name: string;
  character: string;
  profile_url: string | null;
  known_for_department: string;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  original_name: string;
  department: string;
  job: string;
  profile_url: string | null;
}

export interface TmdbExternalIds {
  imdb_id: string | null;
  wikidata_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
  /** TikTok handles are sometimes returned for TV people — kept for parity */
  tiktok_id: string | null;
  /** YouTube channel id, if any */
  youtube_id: string | null;
}

export interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_url: string | null;
  overview: string;
}

export interface TmdbSeason {
  tmdb_show_id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_url: string | null;
  episodes: TmdbEpisode[];
}

export interface TmdbEpisode {
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime_minutes: number | null;
  still_url: string | null;
  vote_average: number;
}

export interface TmdbSearchResult {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  release_date: string | null;
  genres: string[];
  genre_ids: number[];
  origin_country: string[];
  original_language: string;
  vote_average: number;
  popularity: number;
}

// ---------------------------------------------------------------------------
// Image URL helpers
// ---------------------------------------------------------------------------

export function posterUrl(path: string | null | undefined, size = "w500"): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null | undefined, size = "w1280"): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function stillUrl(path: string | null | undefined, size = "w300"): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

export function profileUrl(path: string | null | undefined, size = "h632"): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}

// ---------------------------------------------------------------------------
// Core TMDB fetch with auth
// ---------------------------------------------------------------------------

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY is not configured");

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMDB API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

export async function getFromCache<T>(cacheKey: string): Promise<T | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("media_cache")
    .select("data, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data) return null;

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    // Stale — delete in background, return null to trigger fresh fetch
    admin.from("media_cache").delete().eq("cache_key", cacheKey);
    return null;
  }

  return data.data as T;
}

async function setCache(cacheKey: string, data: unknown, ttlHours = CACHE_TTL_HOURS): Promise<void> {
  const admin = getAdminClient();
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

  await admin.from("media_cache").upsert(
    { cache_key: cacheKey, data, expires_at: expiresAt },
    { onConflict: "cache_key" },
  );
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
function extractTrailerKey(videos: any): string | null {
  if (!videos?.results) return null;
  const trailer = videos.results.find(
    // deno-lint-ignore no-explicit-any
    (v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official,
  ) ?? videos.results.find(
    // deno-lint-ignore no-explicit-any
    (v: any) => v.site === "YouTube" && v.type === "Trailer",
  );
  return trailer?.key ?? null;
}

// deno-lint-ignore no-explicit-any
function normalizeCast(members: any): TmdbCastMember[] {
  if (!Array.isArray(members)) return [];
  // deno-lint-ignore no-explicit-any
  return members.slice(0, 25).map((m: any) => ({
    id: m.id,
    name: m.name ?? "",
    original_name: m.original_name ?? m.name ?? "",
    character: m.character ?? "",
    profile_url: profileUrl(m.profile_path),
    known_for_department: m.known_for_department ?? "",
    order: typeof m.order === "number" ? m.order : 0,
  }));
}

// deno-lint-ignore no-explicit-any
function normalizeCrew(members: any): TmdbCrewMember[] {
  if (!Array.isArray(members)) return [];
  // deno-lint-ignore no-explicit-any
  return members.map((m: any) => ({
    id: m.id,
    name: m.name ?? "",
    original_name: m.original_name ?? m.name ?? "",
    department: m.department ?? "",
    job: m.job ?? "",
    profile_url: profileUrl(m.profile_path),
  }));
}

// deno-lint-ignore no-explicit-any
function normalizeExternalIds(raw: any): TmdbExternalIds {
  if (!raw || typeof raw !== "object") {
    return {
      imdb_id: null,
      wikidata_id: null,
      facebook_id: null,
      instagram_id: null,
      twitter_id: null,
      tiktok_id: null,
      youtube_id: null,
    };
  }
  return {
    imdb_id: raw.imdb_id ?? null,
    wikidata_id: raw.wikidata_id ?? null,
    facebook_id: raw.facebook_id ?? null,
    instagram_id: raw.instagram_id ?? null,
    twitter_id: raw.twitter_id ?? null,
    tiktok_id: raw.tiktok_id ?? null,
    youtube_id: raw.youtube_id ?? null,
  };
}

// deno-lint-ignore no-explicit-any
export function normalizeMovie(raw: any): TmdbMovie {
  return {
    tmdb_id: raw.id,
    media_type: "movie",
    title: raw.title ?? raw.original_title ?? "",
    original_title: raw.original_title ?? "",
    overview: raw.overview ?? "",
    poster_url: posterUrl(raw.poster_path),
    backdrop_url: backdropUrl(raw.backdrop_path),
    release_year: raw.release_date ? parseInt(raw.release_date.slice(0, 4)) : null,
    release_date: raw.release_date ?? null,
    genres: (raw.genres ?? []).map((g: { name: string }) => g.name),
    genre_ids: (raw.genres ?? raw.genre_ids ?? []).map((g: { id?: number } | number) =>
      typeof g === "number" ? g : g.id!
    ),
    origin_country: raw.production_countries?.map((c: { iso_3166_1: string }) => c.iso_3166_1) ??
      (raw.origin_country ?? []),
    original_language: raw.original_language ?? "",
    runtime_minutes: raw.runtime ?? null,
    vote_average: raw.vote_average ?? 0,
    vote_count: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    adult: raw.adult ?? false,
    tagline: raw.tagline ?? null,
    status: raw.status ?? null,
    budget: raw.budget ?? null,
    revenue: raw.revenue ?? null,
    production_companies: (raw.production_companies ?? []).map(
      (c: { id: number; name: string; origin_country: string }) => ({
        id: c.id,
        name: c.name,
        origin_country: c.origin_country,
      }),
    ),
    spoken_languages: (raw.spoken_languages ?? []).map(
      (l: { iso_639_1: string; name: string }) => ({ iso_639_1: l.iso_639_1, name: l.name }),
    ),
    imdb_id: raw.imdb_id ?? null,
    trailer_key: extractTrailerKey(raw.videos),
    homepage: raw.homepage ?? null,
    cast: normalizeCast(raw.credits?.cast),
    crew: normalizeCrew(raw.credits?.crew),
    external_ids: normalizeExternalIds(raw.external_ids),
  };
}

// deno-lint-ignore no-explicit-any
export function normalizeShow(raw: any): TmdbShow {
  return {
    tmdb_id: raw.id,
    media_type: "tv",
    title: raw.name ?? raw.original_name ?? "",
    original_title: raw.original_name ?? "",
    overview: raw.overview ?? "",
    poster_url: posterUrl(raw.poster_path),
    backdrop_url: backdropUrl(raw.backdrop_path),
    release_year: raw.first_air_date ? parseInt(raw.first_air_date.slice(0, 4)) : null,
    first_air_date: raw.first_air_date ?? null,
    last_air_date: raw.last_air_date ?? null,
    genres: (raw.genres ?? []).map((g: { name: string }) => g.name),
    genre_ids: (raw.genres ?? raw.genre_ids ?? []).map((g: { id?: number } | number) =>
      typeof g === "number" ? g : g.id!
    ),
    origin_country: raw.origin_country ?? [],
    original_language: raw.original_language ?? "",
    runtime_minutes: raw.episode_run_time?.[0] ?? null,
    vote_average: raw.vote_average ?? 0,
    vote_count: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    adult: raw.adult ?? false,
    tagline: raw.tagline ?? null,
    status: raw.status ?? null,
    number_of_seasons: raw.number_of_seasons ?? 0,
    number_of_episodes: raw.number_of_episodes ?? 0,
    in_production: raw.in_production ?? false,
    seasons: (raw.seasons ?? []).map(
      // deno-lint-ignore no-explicit-any
      (s: any): TmdbSeasonSummary => ({
        season_number: s.season_number,
        name: s.name ?? "",
        episode_count: s.episode_count ?? 0,
        air_date: s.air_date ?? null,
        poster_url: posterUrl(s.poster_path),
        overview: s.overview ?? "",
      }),
    ),
    networks: (raw.networks ?? []).map(
      (n: { id: number; name: string; origin_country: string }) => ({
        id: n.id,
        name: n.name,
        origin_country: n.origin_country,
      }),
    ),
    spoken_languages: (raw.spoken_languages ?? []).map(
      (l: { iso_639_1: string; name: string }) => ({ iso_639_1: l.iso_639_1, name: l.name }),
    ),
    trailer_key: extractTrailerKey(raw.videos),
    homepage: raw.homepage ?? null,
    cast: normalizeCast(raw.aggregate_credits?.cast),
    crew: normalizeCrew(raw.aggregate_credits?.crew),
    external_ids: normalizeExternalIds(raw.external_ids),
  };
}

// deno-lint-ignore no-explicit-any
function normalizeSearchResult(raw: any, mediaType: "movie" | "tv"): TmdbSearchResult {
  const isMovie = mediaType === "movie";
  return {
    tmdb_id: raw.id,
    media_type: mediaType,
    title: isMovie ? (raw.title ?? raw.original_title ?? "") : (raw.name ?? raw.original_name ?? ""),
    original_title: isMovie ? (raw.original_title ?? "") : (raw.original_name ?? ""),
    overview: raw.overview ?? "",
    poster_url: posterUrl(raw.poster_path),
    backdrop_url: backdropUrl(raw.backdrop_path),
    release_year: raw.release_date || raw.first_air_date
      ? parseInt((raw.release_date ?? raw.first_air_date).slice(0, 4))
      : null,
    release_date: raw.release_date ?? raw.first_air_date ?? null,
    genres: [],
    genre_ids: raw.genre_ids ?? [],
    origin_country: raw.origin_country ?? [],
    original_language: raw.original_language ?? "",
    vote_average: raw.vote_average ?? 0,
    popularity: raw.popularity ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function searchMedia(
  query: string,
  type: "movie" | "tv" | "all",
  page = 1,
  language = "en-US",
  includeAdult = false,
): Promise<{ results: TmdbSearchResult[]; total_results: number; total_pages: number }> {
  const cacheKey = `search:${type}:${query.toLowerCase()}:${page}:${language}`;
  const cached = await getFromCache<{
    results: TmdbSearchResult[];
    total_results: number;
    total_pages: number;
  }>(cacheKey);
  if (cached) return cached;

  let results: TmdbSearchResult[] = [];
  let total_results = 0;
  let total_pages = 0;

  const params: Record<string, string> = {
    query,
    page: String(page),
    language,
    include_adult: String(includeAdult),
  };

  if (type === "all") {
    // deno-lint-ignore no-explicit-any
    const [movies, shows] = await Promise.all<any>([
      tmdbFetch("/search/movie", params),
      tmdbFetch("/search/tv", params),
    ]);

    const movieResults = (movies.results ?? []).map((r: unknown) =>
      normalizeSearchResult(r, "movie")
    );
    const showResults = (shows.results ?? []).map((r: unknown) =>
      normalizeSearchResult(r, "tv")
    );

    // Interleave by popularity
    results = [...movieResults, ...showResults].sort((a, b) => b.popularity - a.popularity);
    total_results = (movies.total_results ?? 0) + (shows.total_results ?? 0);
    total_pages = Math.max(movies.total_pages ?? 0, shows.total_pages ?? 0);
  } else {
    // deno-lint-ignore no-explicit-any
    const data = await tmdbFetch<any>(
      type === "movie" ? "/search/movie" : "/search/tv",
      params,
    );
    results = (data.results ?? []).map((r: unknown) => normalizeSearchResult(r, type));
    total_results = data.total_results ?? 0;
    total_pages = data.total_pages ?? 0;
  }

  const payload = { results, total_results, total_pages };
  await setCache(cacheKey, payload, SEARCH_CACHE_TTL_HOURS);
  return payload;
}

export async function getMovieDetails(tmdbId: number, language = "en-US"): Promise<TmdbMovie> {
  // v2: response shape now includes cast/crew/external_ids via append_to_response.
  // Bumping the prefix invalidates older media_cache rows that pre-date this fix.
  const cacheKey = `movie:v2:${tmdbId}:${language}`;
  const cached = await getFromCache<TmdbMovie>(cacheKey);
  if (cached) return cached;

  // deno-lint-ignore no-explicit-any
  const raw = await tmdbFetch<any>(`/movie/${tmdbId}`, {
    language,
    append_to_response: "videos,credits,external_ids",
  });

  const normalized = normalizeMovie(raw);
  await setCache(cacheKey, normalized);
  return normalized;
}

export async function getShowDetails(tmdbId: number, language = "en-US"): Promise<TmdbShow> {
  // v2: response shape now includes cast/crew/external_ids via append_to_response.
  // Bumping the prefix invalidates older media_cache rows that pre-date this fix.
  const cacheKey = `tv:v2:${tmdbId}:${language}`;
  const cached = await getFromCache<TmdbShow>(cacheKey);
  if (cached) return cached;

  // deno-lint-ignore no-explicit-any
  const raw = await tmdbFetch<any>(`/tv/${tmdbId}`, {
    language,
    append_to_response: "videos,credits,external_ids",
  });

  const normalized = normalizeShow(raw);
  await setCache(cacheKey, normalized);
  return normalized;
}

export async function getSeasonDetails(
  tmdbId: number,
  seasonNumber: number,
  language = "en-US",
): Promise<TmdbSeason> {
  const cacheKey = `tv:${tmdbId}:season:${seasonNumber}:${language}`;
  const cached = await getFromCache<TmdbSeason>(cacheKey);
  if (cached) return cached;

  // deno-lint-ignore no-explicit-any
  const raw = await tmdbFetch<any>(`/tv/${tmdbId}/season/${seasonNumber}`, { language });

  const normalized: TmdbSeason = {
    tmdb_show_id: tmdbId,
    season_number: raw.season_number ?? seasonNumber,
    name: raw.name ?? "",
    overview: raw.overview ?? "",
    air_date: raw.air_date ?? null,
    poster_url: posterUrl(raw.poster_path),
    // deno-lint-ignore no-explicit-any
    episodes: (raw.episodes ?? []).map((ep: any): TmdbEpisode => ({
      episode_number: ep.episode_number,
      season_number: ep.season_number,
      name: ep.name ?? "",
      overview: ep.overview ?? "",
      air_date: ep.air_date ?? null,
      runtime_minutes: ep.runtime ?? null,
      still_url: stillUrl(ep.still_path),
      vote_average: ep.vote_average ?? 0,
    })),
  };

  await setCache(cacheKey, normalized);
  return normalized;
}

export async function getTrending(
  type: "movie" | "tv" | "all",
  timeWindow: "day" | "week" = "week",
  language = "en-US",
): Promise<TmdbSearchResult[]> {
  const cacheKey = `trending:${type}:${timeWindow}:${language}`;
  const cached = await getFromCache<TmdbSearchResult[]>(cacheKey);
  if (cached) return cached;

  const mediaType = type === "all" ? "all" : type;
  // deno-lint-ignore no-explicit-any
  const raw = await tmdbFetch<any>(`/trending/${mediaType}/${timeWindow}`, { language });

  // deno-lint-ignore no-explicit-any
  const results = (raw.results ?? []).map((r: any) => {
    const mt = r.media_type ?? type;
    return normalizeSearchResult(r, mt === "tv" ? "tv" : "movie");
  });

  await setCache(cacheKey, results, 3); // trending changes fast, 3h TTL
  return results;
}
