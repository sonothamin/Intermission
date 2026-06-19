// =============================================================================
// episode-progress/index.ts — Episode-level tracking for TV series
//
// GET    /functions/v1/episode-progress?tmdb_id=&season_number= (optional)
// POST   /functions/v1/episode-progress              → mark episode
// PATCH  /functions/v1/episode-progress?id=          → update episode
// DELETE /functions/v1/episode-progress?id=          → unmark episode
// POST   /functions/v1/episode-progress/bulk         → bulk mark episodes
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import {
  badRequest,
  notFound,
  internalError,
  methodNotAllowed,
} from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/db.ts";
import { getSeasonDetails } from "../_shared/tmdb.ts";
import {
  validateRating,
  validateString,
  validateTmdbId,
  ValidationError,
  parseIntParam,
} from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("episode-progress");

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
    // GET — fetch episode progress
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { value: tmdbId, error: tmdbErr } = parseIntParam(params, "tmdb_id", {
        min: 1,
        required: true,
      });
      if (tmdbErr) return badRequest(tmdbErr, origin);

      const { value: seasonNumber } = parseIntParam(params, "season_number", { min: 0 });

      let query = db
        .from("episode_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("tmdb_show_id", tmdbId!)
        .order("season_number")
        .order("episode_number");

      if (seasonNumber !== null) {
        query = query.eq("season_number", seasonNumber);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ data: data ?? [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — mark episode(s) as watched/unwatched
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      // Bulk mode: { tmdb_id, seasons: [{ season_number, episodes: [ep_number] }], watched }
      if (body.bulk === true) {
        return handleBulkMark(body, user.id, db, origin);
      }

      let tmdb_id: number, season_number: number, episode_number: number;
      try {
        tmdb_id = validateTmdbId(body.tmdb_id);
        season_number = Number(body.season_number);
        episode_number = Number(body.episode_number);
        if (!Number.isInteger(season_number) || season_number < 0) {
          throw new ValidationError("season_number must be a non-negative integer");
        }
        if (!Number.isInteger(episode_number) || episode_number < 1) {
          throw new ValidationError("episode_number must be a positive integer");
        }
      } catch (e) {
        if (e instanceof ValidationError) return badRequest(e.message, origin);
        throw e;
      }

      // Get library_id for this show
      const { data: libItem } = await db
        .from("library")
        .select("id")
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdb_id)
        .eq("media_type", "tv")
        .maybeSingle();

      if (!libItem) {
        return notFound("Show in library (add it to your library first)", origin);
      }

      // Fetch episode metadata from TMDB for denormalization
      let episodeMeta = { title: null as string | null, air_date: null as string | null, runtime: null as number | null };
      try {
        const season = await getSeasonDetails(tmdb_id, season_number);
        const ep = season.episodes.find((e) => e.episode_number === episode_number);
        if (ep) {
          episodeMeta = {
            title: ep.name ?? null,
            air_date: ep.air_date ?? null,
            runtime: ep.runtime_minutes ?? null,
          };
        }
      } catch (_) {
        // Non-fatal — metadata enrichment is best-effort
      }

      const watched = body.watched !== false; // default true
      const now = new Date().toISOString();

      const upsertData = {
        user_id: user.id,
        library_id: libItem.id,
        tmdb_show_id: tmdb_id,
        season_number,
        episode_number,
        episode_title: episodeMeta.title,
        air_date: episodeMeta.air_date,
        runtime_minutes: episodeMeta.runtime,
        watched,
        watched_at: watched ? now : null,
        rating: validateRating(body.rating),
        notes: body.notes ? validateString(body.notes, "notes", { maxLength: 500 }) : null,
      };

      const { data, error } = await db
        .from("episode_progress")
        .upsert(upsertData, {
          onConflict: "user_id,tmdb_show_id,season_number,episode_number",
        })
        .select()
        .single();

      if (error) throw error;

      // Update episodes_watched count on library item
      await updateEpisodesWatched(db, user.id, tmdb_id, libItem.id);

      log.info("marked episode", { user_id: user.id, tmdb_id, season_number, episode_number, watched });

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH — update episode (rating/notes only)
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const id = params.get("id");
      if (!id) return badRequest("id query parameter is required", origin);

      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      try {
        const updates: Record<string, unknown> = {};
        if (body.rating !== undefined) updates.rating = validateRating(body.rating);
        if (body.notes !== undefined) {
          updates.notes = body.notes === null
            ? null
            : validateString(body.notes, "notes", { maxLength: 500 });
        }

        if (Object.keys(updates).length === 0) {
          return badRequest("No valid fields to update", origin);
        }

        const { data, error } = await db
          .from("episode_progress")
          .update(updates)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

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
    // DELETE — unmark episode
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const id = params.get("id");
      if (!id) return badRequest("id query parameter is required", origin);

      const { data: ep } = await db
        .from("episode_progress")
        .select("library_id, tmdb_show_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await db
        .from("episode_progress")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      if (ep) {
        await updateEpisodesWatched(db, user.id, ep.tmdb_show_id, ep.library_id);
      }

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

// Helper: count all watched episodes and update library row
//   - episodes_watched, current_season, current_episode
//   - Auto-set status to "completed" when all episodes are watched
//   - Revert to "watching" if episodes are un-watched after completion
//   - Transition from "plan_to_watch" to "watching" on first episode
// deno-lint-ignore no-explicit-any
async function updateEpisodesWatched(db: any, userId: string, tmdbShowId: number, libraryId: string) {
  // 1. Count watched episodes
  const { count } = await db
    .from("episode_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tmdb_show_id", tmdbShowId)
    .eq("watched", true);

  const episodesWatched = count ?? 0;

  // 2. Find the highest watched season + episode (for current_season/current_episode)
  const { data: maxSeasonRows } = await db
    .from("episode_progress")
    .select("season_number")
    .eq("user_id", userId)
    .eq("tmdb_show_id", tmdbShowId)
    .eq("watched", true)
    .order("season_number", { ascending: false })
    .limit(1);

  const maxSeason = maxSeasonRows?.[0]?.season_number ?? null;

  let maxEpisode: number | null = null;
  if (maxSeason !== null) {
    const { data: maxEpRows } = await db
      .from("episode_progress")
      .select("episode_number")
      .eq("user_id", userId)
      .eq("tmdb_show_id", tmdbShowId)
      .eq("season_number", maxSeason)
      .eq("watched", true)
      .order("episode_number", { ascending: false })
      .limit(1);
    maxEpisode = maxEpRows?.[0]?.episode_number ?? null;
  }

  // 3. Fetch the library row to get total_episodes and current status
  const { data: libRow } = await db
    .from("library")
    .select("status, total_episodes, started_at")
    .eq("id", libraryId)
    .eq("user_id", userId)
    .maybeSingle();

  const totalEpisodes = libRow?.total_episodes ?? 0;
  const currentStatus = libRow?.status as string | null;
  const now = new Date().toISOString();

  // 4. Build the update object
  // deno-lint-ignore no-explicit-any
  const updates: Record<string, any> = {
    episodes_watched: episodesWatched,
    ...(maxSeason !== null ? { current_season: maxSeason } : {}),
    ...(maxEpisode !== null ? { current_episode: maxEpisode } : {}),
  };

  // 5. Auto-status transitions
  if (totalEpisodes > 0 && episodesWatched >= totalEpisodes) {
    // All episodes watched → completed
    updates.status = "completed";
    updates.completed_at = now;
    log.info("auto-completed show", { libraryId, episodesWatched, totalEpisodes });
  } else if (episodesWatched > 0 && (currentStatus === "completed" || currentStatus === "plan_to_watch")) {
    // Some episodes watched but not all → watching
    // (handles un-marking an episode on a completed show, or first watch on plan_to_watch)
    updates.status = "watching";
    if (!libRow?.started_at) {
      updates.started_at = now;
    }
  } else if (episodesWatched === 0 && currentStatus === "watching") {
    // All episodes un-watched → back to plan_to_watch
    updates.status = "plan_to_watch";
  }

  await db
    .from("library")
    .update(updates)
    .eq("id", libraryId)
    .eq("user_id", userId);
}

// Helper: bulk mark episodes
// Supports two payload formats:
//   Single-season:  { tmdb_id, season_number, episodes: [1,2,3], watched }
//   Multi-season:   { tmdb_id, seasons: [{ season_number, episodes: [1,2,3] }, ...], watched }
// deno-lint-ignore no-explicit-any
async function handleBulkMark(body: any, userId: string, db: any, origin: string | null): Promise<Response> {
  const { tmdb_id, watched = true } = body;

  if (!tmdb_id) {
    return badRequest("bulk requires tmdb_id", origin);
  }

  // Normalize to multi-season format
  // deno-lint-ignore no-explicit-any
  let seasons: { season_number: number; episodes: number[] }[];

  if (Array.isArray(body.seasons)) {
    // Multi-season format
    seasons = body.seasons;
  } else if (body.season_number !== undefined && Array.isArray(body.episodes)) {
    // Single-season format (backward compat)
    seasons = [{ season_number: body.season_number, episodes: body.episodes }];
  } else {
    return badRequest("bulk requires either (season_number + episodes) or seasons array", origin);
  }

  // Validate
  for (const s of seasons) {
    if (typeof s.season_number !== "number" || !Array.isArray(s.episodes) || s.episodes.length === 0) {
      return badRequest("Each season must have season_number and non-empty episodes array", origin);
    }
  }

  const { data: libItem } = await db
    .from("library")
    .select("id")
    .eq("user_id", userId)
    .eq("tmdb_id", tmdb_id)
    .eq("media_type", "tv")
    .maybeSingle();

  if (!libItem) {
    return notFound("Show in library", origin);
  }

  const now = new Date().toISOString();

  // Build all upsert rows across all seasons
  // deno-lint-ignore no-explicit-any
  const upserts: any[] = [];
  for (const s of seasons) {
    for (const ep_num of s.episodes) {
      upserts.push({
        user_id: userId,
        library_id: libItem.id,
        tmdb_show_id: tmdb_id,
        season_number: s.season_number,
        episode_number: ep_num,
        watched,
        watched_at: watched ? now : null,
      });
    }
  }

  // Upsert all at once (Supabase handles batch upserts)
  const { error } = await db
    .from("episode_progress")
    .upsert(upserts, { onConflict: "user_id,tmdb_show_id,season_number,episode_number" });

  if (error) throw error;

  // Single call to update episodes_watched + auto-status
  await updateEpisodesWatched(db, userId, tmdb_id, libItem.id);

  log.info("bulk marked episodes", { user_id: userId, tmdb_id, seasons: seasons.length, total_eps: upserts.length, watched });

  return new Response(JSON.stringify({ success: true, count: upserts.length }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

