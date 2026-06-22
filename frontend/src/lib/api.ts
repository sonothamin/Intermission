// =============================================================================
// frontend/src/lib/api.ts — Typed API client for all edge functions
// =============================================================================

import { createClient } from "@supabase/supabase-js";
import { cachedFetch } from "./tmdbCache";

// We'll proxy through Vite or use env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || "http://127.0.0.1:54321";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string || "your-publishable-key";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaType = "movie" | "tv";
export type WatchStatus = "watching" | "completed" | "on_hold" | "dropped" | "plan_to_watch" | "rewatching";

export interface SearchResult {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title?: string;
  overview?: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  release_date?: string | null;
  genres: string[];
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
  vote_average?: number;
  popularity?: number;
  user_status?: { status: WatchStatus; rating: number | null } | null;
  in_watchlist?: boolean;
}

export interface LibraryItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_year: number | null;
  genres: string[];
  origin_country: string[];
  original_language: string;
  runtime_minutes: number | null;
  content_rating: string | null;
  status: WatchStatus;
  rating: number | null;
  notes: string | null;
  times_watched: number;
  current_season: number | null;
  current_episode: number | null;
  total_seasons: number | null;
  total_episodes: number | null;
  episodes_watched: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Present only when the library list was fetched with `include=next_episode`.
   * For status=watching/rewatching TV rows, the server resolves the next-up
   * episode from its media_cache and inlines it here. null means the user
   * has finished the show or the server couldn't resolve it (cache cold —
   * the client falls back to its own fan-out).
   */
  next_episode?: NextEpisode | null;
}

export interface NextEpisode {
  tmdb_id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  runtime_minutes: number | null;
  still_url: string | null;
  vote_average: number;
  season_name: string;
  episode_count_in_season: number;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  release_year: number | null;
  genres: string[];
  original_language: string;
  content_rating: string | null;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeProgress {
  id: string;
  user_id: string;
  library_id: string;
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  air_date: string | null;
  runtime_minutes: number | null;
  watched: boolean;
  watched_at: string | null;
  rating: number | null;
  notes: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface Analytics {
  period: string;
  summary: {
    total_items: number;
    movies_watched: number;
    total_movies: number;
    series_tracked: number;
    episodes_watched: number;
    total_hours_watched: number;
    movie_hours: number;
    tv_hours: number;
    avg_rating: number | null;
    rated_items: number;
    watchlist_count: number;
  };
  series_status: Record<WatchStatus, number>;
  genres: { name: string; count: number }[];
  languages: { code: string; count: number; minutes: number }[];
  countries: { code: string; count: number; minutes: number }[];
  decades: { decade: string; count: number }[];
  rating_distribution: { score: number; count: number }[];
  monthly_activity: { month: string; movies: number; episodes: number }[];
}

export interface UserProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website: string | null;
  location: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_url: string | null;
  overview: string;
}

export interface TmdbMovieDetails {
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

export interface TmdbShowDetails {
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
  runtime_minutes: number | null;
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
  tiktok_id: string | null;
  youtube_id: string | null;
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
  user_progress?: {
    watched: boolean;
    watched_at: string | null;
    rating: number | null;
    notes: string | null;
  } | null;
}

export interface TmdbSeasonDetails {
  tmdb_show_id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_url: string | null;
  episodes: TmdbEpisode[];
}

export interface UserSettings {
  id: string;
  preferred_language: string;
  preferred_region: string;
  theme: "dark" | "light" | "system";
  adult_content: boolean;
  auto_mark_watched: boolean;
  show_spoilers: boolean;
  default_list_view: "grid" | "list" | "compact";
  notifications_enabled: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

// For GET requests we build a proper URL with query params
async function getFunction<T>(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  const baseUrl = `${supabaseUrl}/functions/v1/${name}`;
  const url = new URL(baseUrl);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "apikey": supabasePublishableKey,
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url.toString(), { 
    headers,
    cache: "no-store" 
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

async function mutateFunction<T>(
  name: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  queryParams?: Record<string, string | undefined>,
): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  const baseUrl = `${supabaseUrl}/functions/v1/${name}`;
  const url = new URL(baseUrl);

  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "apikey": supabasePublishableKey,
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ---------------------------------------------------------------------------
// Search API
// ---------------------------------------------------------------------------

export const searchApi = {
  search: (
    query: string,
    opts?: { type?: "movie" | "tv" | "all"; page?: number; language?: string; adult?: boolean },
  ) =>
    getFunction<{ results: SearchResult[]; total_results: number; total_pages: number; source: string }>(
      "media-search",
      { q: query, ...opts },
    ),

  trending: (type: "movie" | "tv" | "all" = "all") =>
    getFunction<{ results: SearchResult[]; total_results: number; total_pages: number; source: string }>(
      "media-search",
      { type },
    ),
};

// ---------------------------------------------------------------------------
// Media Details API
// ---------------------------------------------------------------------------

export const mediaApi = {
  getMovie: (tmdbId: number, language?: string) =>
    cachedFetch(
      // v2: aligns with the server-side cache bump that adds cast/crew/external_ids.
      // Old sessionStorage entries (pre-fix) are ignored, forcing a fresh fetch.
      `media-details:movie:v2:${tmdbId}:${language ?? "en-US"}`,
      () => getFunction<{ media: TmdbMovieDetails; user_entry: LibraryItem | null; episode_progress: null }>(
        "media-details",
        { tmdb_id: tmdbId, type: "movie", language },
      ),
    ),

  getShow: (tmdbId: number, language?: string) =>
    cachedFetch(
      // v2: aligns with the server-side cache bump that adds cast/crew/external_ids.
      // Old sessionStorage entries (pre-fix) are ignored, forcing a fresh fetch.
      `media-details:tv:v2:${tmdbId}:${language ?? "en-US"}`,
      () => getFunction<{ media: TmdbShowDetails; user_entry: LibraryItem | null; episode_progress: EpisodeProgress[] | null }>(
        "media-details",
        { tmdb_id: tmdbId, type: "tv", language },
      ),
    ),

  getSeasonDetails: (tmdbId: number, seasonNumber: number, language?: string) =>
    cachedFetch(
      `season-details:tv:${tmdbId}:s${seasonNumber}:${language ?? "en-US"}`,
      () => getFunction<TmdbSeasonDetails>("season-details", {
        tmdb_id: tmdbId,
        season_number: seasonNumber,
        language,
      }),
    ),
};

// ---------------------------------------------------------------------------
// Library API
// ---------------------------------------------------------------------------

export const libraryApi = {
  list: (opts?: {
    status?: WatchStatus;
    type?: MediaType;
    genre?: string;
    language?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
    page?: number;
    limit?: number;
    /**
     * Pass `true` to filter to library rows where `rating IS NULL`. Used by
     * the Continue Rating page so the server returns only what we need.
     */
    unrated?: boolean;
    /**
     * Pass `"next_episode"` to inline the next-up episode for status=watching
     * TV rows directly on each LibraryItem as `next_episode`.
     * Lets the Dashboard render Continue Watching with a single call.
     */
    include?: "next_episode";
  }) =>
    getFunction<{ data: LibraryItem[]; pagination: Pagination }>("library", opts),

  add: (item: {
    tmdb_id: number;
    media_type: MediaType;
    status?: WatchStatus;
    rating?: number;
    notes?: string;
  }) => mutateFunction<LibraryItem>("library", "POST", item),

  update: (
    id: string,
    updates: Partial<{
      status: WatchStatus;
      rating: number | null;
      notes: string | null;
      times_watched: number;
      current_season: number;
      current_episode: number;
      episodes_watched: number;
      started_at: string | null;
      completed_at: string | null;
    }>,
  ) => mutateFunction<LibraryItem>("library", "PATCH", updates, { id }),

  remove: (id: string) =>
    mutateFunction<{ success: boolean }>("library", "DELETE", undefined, { id }),
};

// ---------------------------------------------------------------------------
// Episode Progress API
// ---------------------------------------------------------------------------

export const episodeApi = {
  getProgress: (tmdbId: number, seasonNumber?: number) =>
    getFunction<{ data: EpisodeProgress[] }>("episode-progress", {
      tmdb_id: tmdbId,
      season_number: seasonNumber,
    }),

  markEpisode: (opts: {
    tmdb_id: number;
    season_number: number;
    episode_number: number;
    watched?: boolean;
    rating?: number;
    notes?: string;
  }) => mutateFunction<EpisodeProgress>("episode-progress", "POST", opts),

  bulkMark: (opts: {
    tmdb_id: number;
    season_number: number;
    episodes: number[];
    watched: boolean;
  }) => mutateFunction<{ success: boolean; count: number }>("episode-progress", "POST", { ...opts, bulk: true }),

  bulkMarkMultiSeason: (opts: {
    tmdb_id: number;
    seasons: { season_number: number; episodes: number[] }[];
    watched: boolean;
  }) => mutateFunction<{ success: boolean; count: number }>("episode-progress", "POST", { ...opts, bulk: true }),

  updateEpisode: (id: string, updates: { rating?: number | null; notes?: string | null }) =>
    mutateFunction<EpisodeProgress>("episode-progress", "PATCH", updates, { id }),

  removeEpisode: (id: string) =>
    mutateFunction<{ success: boolean }>("episode-progress", "DELETE", undefined, { id }),
};

// ---------------------------------------------------------------------------
// Watchlist API
// ---------------------------------------------------------------------------

export const watchlistApi = {
  list: (opts?: {
    type?: MediaType;
    sort_by?: "priority" | "created_at" | "title" | "release_year";
    sort_dir?: "asc" | "desc";
    page?: number;
    limit?: number;
  }) => getFunction<{ data: WatchlistItem[]; pagination: Pagination }>("watchlist", opts),

  add: (item: {
    tmdb_id: number;
    media_type: MediaType;
    priority?: number;
    notes?: string;
  }) => mutateFunction<WatchlistItem>("watchlist", "POST", item),

  update: (id: string, updates: { priority?: number; notes?: string | null }) =>
    mutateFunction<WatchlistItem>("watchlist", "PATCH", updates, { id }),

  remove: (id: string) =>
    mutateFunction<{ success: boolean }>("watchlist", "DELETE", undefined, { id }),
};

// ---------------------------------------------------------------------------
// Analytics API
// ---------------------------------------------------------------------------

export const analyticsApi = {
  get: (opts?: { period?: "all" | "30d" | "90d" | "1y"; type?: MediaType }) =>
    getFunction<Analytics>("analytics", opts),
};

// ---------------------------------------------------------------------------
// Profile API
// ---------------------------------------------------------------------------

export const profileApi = {
  get: (userId?: string) =>
    getFunction<{ profile: UserProfile; stats: any; settings: UserSettings | null }>(
      "profile",
      userId ? { user_id: userId } : undefined,
    ),

  update: (updates: Partial<{
    username: string;
    display_name: string;
    bio: string | null;
    website: string | null;
    location: string | null;
    is_public: boolean;
  }>) => mutateFunction<UserProfile>("profile", "PATCH", updates),

  uploadAvatar: async (file: File): Promise<{ id: string; avatar_url: string }> => {
    const session = (await supabase.auth.getSession()).data.session;
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(`${supabaseUrl}/functions/v1/profile`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  },
};

// ---------------------------------------------------------------------------
// Settings API
// ---------------------------------------------------------------------------

export const settingsApi = {
  get: () => getFunction<UserSettings>("settings"),

  update: (updates: Partial<{
    theme: "dark" | "light" | "system";
    preferred_language: string;
    preferred_region: string;
    adult_content: boolean;
    auto_mark_watched: boolean;
    show_spoilers: boolean;
    default_list_view: "grid" | "list" | "compact";
    notifications_enabled: boolean;
  }>) => mutateFunction<UserSettings>("settings", "PATCH", updates),
};

// ---------------------------------------------------------------------------
// Scrobble API
// ---------------------------------------------------------------------------

export type ScrobbleEvent = "start" | "progress" | "complete" | "pause";

export interface ScrobblePayload {
  tmdb_id: number;
  media_type: MediaType;
  event: ScrobbleEvent;
  season_number?: number;
  episode_number?: number;
  progress_pct?: number; // 0–100
}

export const scrobbleApi = {
  send: (payload: ScrobblePayload) =>
    mutateFunction<{
      event: ScrobbleEvent;
      recorded: boolean;
      series_completed?: boolean;
      times_watched?: number;
      episodes_watched?: number;
    }>("scrobble", "POST", payload),

  startMovie: (tmdbId: number) =>
    scrobbleApi.send({ tmdb_id: tmdbId, media_type: "movie", event: "start" }),

  completeMovie: (tmdbId: number) =>
    scrobbleApi.send({ tmdb_id: tmdbId, media_type: "movie", event: "complete" }),

  completeEpisode: (tmdbId: number, season: number, episode: number) =>
    scrobbleApi.send({
      tmdb_id: tmdbId,
      media_type: "tv",
      event: "complete",
      season_number: season,
      episode_number: episode,
    }),

  progress: (tmdbId: number, type: MediaType, pct: number, opts?: { season?: number; episode?: number }) =>
    scrobbleApi.send({
      tmdb_id: tmdbId,
      media_type: type,
      event: "progress",
      progress_pct: pct,
      season_number: opts?.season,
      episode_number: opts?.episode,
    }),
};

// ---------------------------------------------------------------------------
// Account API
// ---------------------------------------------------------------------------

export interface AccountSummary {
  user_id: string;
  email: string | undefined;
  profile: UserProfile | null;
  stats: any;
  library_count: number;
  watchlist_count: number;
}

export interface ImportResult {
  format: "intermission" | "trakt" | "csv";
  library: { imported: number; updated: number; skipped: number; errors: string[] };
  watchlist: { imported: number; skipped: number; errors: string[] };
  episodes: { imported: number; skipped: number; errors: string[] };
}

export const accountApi = {
  get: () => getFunction<AccountSummary>("account"),

  export: async (): Promise<any> => {
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(`${supabaseUrl}/functions/v1/account?action=export`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }

    return await res.json();
  },

  import: async (file: File): Promise<ImportResult> => {
    const session = (await supabase.auth.getSession()).data.session;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${supabaseUrl}/functions/v1/import`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json as ImportResult;
  },

  deleteAccount: () =>
    mutateFunction<{ success: boolean; message: string }>(
      "account",
      "DELETE",
      { confirm: "DELETE MY ACCOUNT" },
    ),
};
