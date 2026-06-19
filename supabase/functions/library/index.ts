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
import { getMovieDetails, getShowDetails } from "../_shared/tmdb.ts";
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

      if (language) {
        query = query.eq("original_language", language);
      }

      const { data, count, error } = await query
        .order(sortBy, { ascending: sortDir === "asc" })
        .range(from, from + limit - 1);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          data: data ?? [],
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
