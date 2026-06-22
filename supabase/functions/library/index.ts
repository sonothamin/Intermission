// =============================================================================
// library/index.ts — Core media tracking CRUD
//
// GET    /functions/v1/library              → list user's library (paginated)
// POST   /functions/v1/library              → add item to library
// PATCH  /functions/v1/library?id=          → update item
// DELETE /functions/v1/library?id=          → remove item
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import {
  badRequest,
  notFound,
  conflict,
  internalError,
  methodNotAllowed,
} from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/db.ts";
import { getMovieDetails, getShowDetails, getFromCache } from "../_shared/tmdb.ts";
import type { TmdbShow, TmdbSeason, TmdbEpisode } from "../_shared/tmdb.ts";
import {
  validateEnum,
  validateRating,
  validateString,
  validateTmdbId,
  validateMediaType,
  ValidationError,
} from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("library");

const VALID_STATUSES = ["watching", "completed", "on_hold", "dropped", "plan_to_watch", "rewatching"] as const;
type WatchStatus = typeof VALID_STATUSES[number];

// ---------------------------------------------------------------------------
// Next-episode hydration
// ---------------------------------------------------------------------------
//
// For ?include=next_episode we attach the next-up episode to each
// status=watching TV library row directly from the media_cache. This lets the
// Dashboard render "Continue Watching" with a single GET /library round-trip
// instead of 1 + 2N calls (library + getShow + getSeasonDetails per show).
//
// We never hit TMDB in this hot path: on cache miss we omit the field and the
// client falls back to its existing fan-out.

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

/**
 * Mirror of the client's pickNextEpisode: given the user's progress and a
 * cached TmdbShow, decide which (season, episode) the user should watch next.
 * Returns null if the show is fully watched or no candidate was found.
 */
function pickNextSeasonEpisode(
  show: TmdbShow,
  currentSeason: number | null,
  currentEpisode: number | null,
  episodesWatched: number | null,
): { seasonNumber: number; episodeNumber: number } | null {
  const watched = episodesWatched ?? 0;
  const total = show.number_of_episodes ?? 0;
  if (total > 0 && watched >= total) return null;

  // Real seasons only (season_number > 0), ascending
  const seasons = (show.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  if (seasons.length === 0) return null;

  const startSeason = currentSeason ?? seasons[0].season_number;
  const startEpisode = (currentEpisode ?? 0) + 1;

  for (const s of seasons) {
    if (s.season_number < startSeason) continue;
    if (startSeason === s.season_number && startEpisode > s.episode_count) continue;
    return {
      seasonNumber: s.season_number,
      episodeNumber: startSeason === s.season_number ? startEpisode : 1,
    };
  }
  return null;
}

async function loadNextEpisode(
  item: { tmdb_id: number; current_season: number | null; current_episode: number | null; episodes_watched: number | null },
  language: string,
): Promise<NextEpisode | null> {
  const show = await getFromCache<TmdbShow>(`tv:${item.tmdb_id}:${language}`);
  if (!show) return null;

  const target = pickNextSeasonEpisode(
    show,
    item.current_season,
    item.current_episode,
    item.episodes_watched,
  );
  if (!target) return null;

  const season = await getFromCache<TmdbSeason>(
    `tv:${item.tmdb_id}:season:${target.seasonNumber}:${language}`,
  );
  if (!season) return null;

  const ep = (season.episodes ?? []).find(
    (e: TmdbEpisode) => e.episode_number === target.episodeNumber,
  );
  if (!ep) return null;

  return {
    tmdb_id: item.tmdb_id,
    season_number: target.seasonNumber,
    episode_number: target.episodeNumber,
    name: ep.name,
    overview: ep.overview,
    air_date: ep.air_date,
    runtime_minutes: ep.runtime_minutes,
    still_url: ep.still_url,
    vote_average: ep.vote_average,
    season_name: season.name,
    episode_count_in_season: season.episodes.length,
  };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const { user, error: authErr } = await getAuthUser(req, origin);
  if (authErr) return authErr;

  const db = getUserClient(req);
  const url = new URL(req.url);
  const params = url.searchParams;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // GET — paginated library list
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const status = params.get("status");
      const type = params.get("type");
      const genre = params.get("genre");
      const language = params.get("language");
      const include = params.get("include");
      const sortBy = params.get("sort_by") ?? "updated_at";
      const sortDir = params.get("sort_dir") ?? "desc";
      const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
      const from = (page - 1) * limit;

      const validSortFields = ["updated_at", "created_at", "rating", "title", "release_year", "times_watched"];
      if (!validSortFields.includes(sortBy)) {
        return badRequest(`sort_by must be one of: ${validSortFields.join(", ")}`, origin);
      }

      if (!["asc", "desc"].includes(sortDir)) {
        return badRequest("sort_dir must be asc or desc", origin);
      }

      let query = db
        .from("library")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (status) {
        if (!VALID_STATUSES.includes(status as WatchStatus)) {
          return badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, origin);
        }
        query = query.eq("status", status);
      }

      if (type) {
        if (!["movie", "tv"].includes(type)) {
          return badRequest("type must be movie or tv", origin);
        }
        query = query.eq("media_type", type);
      }

      if (genre) {
        query = query.contains("genres", [genre]);
      }

      // ?unrated=true — only library rows with a NULL rating. Powers the
      // Continue Rating flow so it doesn't have to page the full library.
      if (params.get("unrated") === "true") {
        query = query.is("rating", null);
      }

      if (language) {
        query = query.eq("original_language", language);
      }

      const { data, count, error } = await query
        .order(sortBy, { ascending: sortDir === "asc" })
        .range(from, from + limit - 1);

      if (error) throw error;

      let rows = data ?? [];

      // ───────────────────────────────────────────────────────────────────
      // ?include=next_episode — inline next-up episode for status=watching TV
      // Reads media_cache only (no TMDB calls). Missing cache → omit field.
      // ───────────────────────────────────────────────────────────────────
      if (include === "next_episode" && rows.length > 0) {
        const lang = language ?? "en-US";
        const hydrated = await Promise.all(
          rows.map(async (row) => {
            if (
              row.media_type === "tv" &&
              (row.status === "watching" || row.status === "rewatching")
            ) {
              try {
                const next = await loadNextEpisode(
                  {
                    tmdb_id: row.tmdb_id,
                    current_season: row.current_season,
                    current_episode: row.current_episode,
                    episodes_watched: row.episodes_watched,
                  },
                  lang,
                );
                if (next) {
                  return { ...row, next_episode: next };
                }
              } catch (err) {
                log.warn("next_episode hydration failed", {
                  tmdb_id: row.tmdb_id,
                  err: String(err),
                });
              }
            }
            return row;
          }),
        );
        rows = hydrated;
      }

      return new Response(
        JSON.stringify({
          data: rows,
          pagination: {
            page,
            limit,
            total: count ?? 0,
            total_pages: Math.ceil((count ?? 0) / limit),
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        },
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — add item to library
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      let tmdb_id: number;
      let media_type: "movie" | "tv";
      let status: WatchStatus;

      try {
        tmdb_id = validateTmdbId(body.tmdb_id);
        media_type = validateMediaType(body.media_type, true)!;
        status = validateEnum(body.status ?? "watching", "status", [...VALID_STATUSES], false) as WatchStatus ?? "watching";
      } catch (e) {
        if (e instanceof ValidationError) return badRequest(e.message, origin);
        throw e;
      }

      // Check for duplicate
      const { data: existing } = await db
        .from("library")
        .select("id")
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdb_id)
        .eq("media_type", media_type)
        .maybeSingle();

      if (existing) {
        return conflict("This item is already in your library", origin);
      }

      // Fetch TMDB data to denormalize metadata
      log.info("fetching TMDB data for library add", { tmdb_id, media_type });
      const mediaData = media_type === "movie"
        ? await getMovieDetails(tmdb_id)
        : await getShowDetails(tmdb_id);

      const isMovie = media_type === "movie";
      const isTv = media_type === "tv";

      const now = new Date().toISOString();
      const insertData = {
        user_id: user.id,
        tmdb_id,
        media_type,
        title: mediaData.title,
        poster_url: mediaData.poster_url,
        backdrop_url: mediaData.backdrop_url,
        release_year: mediaData.release_year,
        genres: mediaData.genres,
        origin_country: mediaData.origin_country,
        original_language: mediaData.original_language,
        runtime_minutes: mediaData.runtime_minutes,
        status,
        rating: validateRating(body.rating),
        notes: body.notes ? validateString(body.notes, "notes", { maxLength: 2000 }) : null,
        times_watched: (isMovie && status === "completed") ? 1 : 0,
        // TV-specific
        total_seasons: isTv ? (mediaData as { number_of_seasons: number }).number_of_seasons : null,
        total_episodes: isTv ? (mediaData as { number_of_episodes: number }).number_of_episodes : null,
        // Timestamps
        started_at: status === "watching" || status === "completed" ? now : null,
        completed_at: status === "completed" ? now : null,
      };

      const { data, error } = await db
        .from("library")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      log.info("added to library", { user_id: user.id, tmdb_id, media_type });

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH — update library item
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const id = params.get("id");
      if (!id) return badRequest("id query parameter is required", origin);

      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      // Check item exists and belongs to user
      const { data: existing, error: fetchErr } = await db
        .from("library")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!existing) return notFound("Library item", origin);

      try {
        const updates: Record<string, unknown> = {};

        if (body.status !== undefined) {
          updates.status = validateEnum(body.status, "status", [...VALID_STATUSES], true)!;

          // Auto-set timestamps based on status transitions
          const now = new Date().toISOString();
          if (body.status === "watching" && !existing.started_at) {
            updates.started_at = now;
          }
          if (body.status === "completed" && existing.status !== "completed") {
            updates.completed_at = now;
            if (existing.media_type === "movie") {
              // Only increment times_watched if we've never completed it before,
              // or if we are actively rewatching/completing again.
              updates.times_watched = (existing.times_watched ?? 0) + 1;
            } else if (existing.media_type === "tv") {
              try {
                const showData = await getShowDetails(existing.tmdb_id);
                const upserts: any[] = [];
                let totalEps = 0;
                for (const s of showData.seasons) {
                  if (s.season_number > 0) { // exclude specials
                    for (let ep = 1; ep <= s.episode_count; ep++) {
                      upserts.push({
                        user_id: user.id,
                        library_id: existing.id,
                        tmdb_show_id: existing.tmdb_id,
                        season_number: s.season_number,
                        episode_number: ep,
                        watched: true,
                        watched_at: now
                      });
                      totalEps++;
                    }
                  }
                }
                if (upserts.length > 0) {
                  const { error: upsertErr } = await db
                    .from("episode_progress")
                    .upsert(upserts, { onConflict: "user_id,tmdb_show_id,season_number,episode_number" });
                  if (upsertErr) throw upsertErr;
                  
                  updates.episodes_watched = totalEps;
                  updates.total_episodes = showData.number_of_episodes;
                }
              } catch (err) {
                log.error("failed to mark all episodes for completed tv show", { tmdb_id: existing.tmdb_id, err });
              }
            }
          }
        }

        if (body.rating !== undefined) {
          updates.rating = validateRating(body.rating);
        }

        if (body.notes !== undefined) {
          updates.notes = body.notes === null
            ? null
            : validateString(body.notes, "notes", { maxLength: 2000 });
        }

        if (body.times_watched !== undefined) {
          const n = Number(body.times_watched);
          if (!Number.isInteger(n) || n < 0) throw new ValidationError("times_watched must be a non-negative integer");
          updates.times_watched = n;
        }

        if (body.current_season !== undefined) {
          const n = Number(body.current_season);
          if (!Number.isInteger(n) || n < 0) throw new ValidationError("current_season must be a non-negative integer");
          updates.current_season = n;
        }

        if (body.current_episode !== undefined) {
          const n = Number(body.current_episode);
          if (!Number.isInteger(n) || n < 0) throw new ValidationError("current_episode must be a non-negative integer");
          updates.current_episode = n;
        }

        if (body.episodes_watched !== undefined) {
          const n = Number(body.episodes_watched);
          if (!Number.isInteger(n) || n < 0) throw new ValidationError("episodes_watched must be a non-negative integer");
          updates.episodes_watched = n;
        }

        const validateOptionalDate = (raw: unknown, field: string): string | null => {
          if (raw === null) return null;
          if (typeof raw !== "string") throw new ValidationError(`${field} must be an ISO date string or null`);
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) throw new ValidationError(`${field} must be a valid ISO date string`);
          return d.toISOString();
        };

        if (body.started_at !== undefined) {
          updates.started_at = validateOptionalDate(body.started_at, "started_at");
        }

        if (body.completed_at !== undefined) {
          updates.completed_at = validateOptionalDate(body.completed_at, "completed_at");
        }

        if (Object.keys(updates).length === 0) {
          return badRequest("No valid fields to update", origin);
        }

        const { data, error } = await db
          .from("library")
          .update(updates)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        log.info("updated library item", { user_id: user.id, id });

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      } catch (e) {
        if (e instanceof ValidationError) return badRequest(e.message, origin);
        throw e;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE — remove from library
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const id = params.get("id");
      if (!id) return badRequest("id query parameter is required", origin);

      // Deleting library item cascades to episode_progress via FK
      const { error } = await db
        .from("library")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      log.info("removed library item", { user_id: user.id, id });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    return methodNotAllowed(origin);
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});
