// =============================================================================
// scrobble/index.ts — Auto-log media plays (webhook / client scrobble)
//
// POST /functions/v1/scrobble
//   Body: { tmdb_id, media_type, event, season_number?, episode_number?, progress_pct? }
//
// Events:
//   "start"    — user started watching (sets status to watching if not set)
//   "progress" — user is n% through (used for UI progress bars)
//   "complete" — user finished (marks episode watched / movie completed)
//   "pause"    — user paused (no-op for now, logged for analytics)
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
import {
  validateEnum,
  validateTmdbId,
  validateMediaType,
  ValidationError,
} from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("scrobble");

type ScrobbleEvent = "start" | "progress" | "complete" | "pause";
const SCROBBLE_EVENTS: ScrobbleEvent[] = ["start", "progress", "complete", "pause"];

// Threshold: mark as complete if progress >= this %
const COMPLETION_THRESHOLD = 90;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");

  if (req.method !== "POST") return methodNotAllowed(origin);

  const { user, error: authErr } = await getAuthUser(req, origin);
  if (authErr) return authErr;

  const db = getUserClient(req);

  try {
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Request body must be valid JSON", origin);

    let tmdb_id: number;
    let media_type: "movie" | "tv";
    let event: ScrobbleEvent;

    try {
      tmdb_id = validateTmdbId(body.tmdb_id);
      media_type = validateMediaType(body.media_type, true)!;
      event = validateEnum(body.event, "event", SCROBBLE_EVENTS, true) as ScrobbleEvent;
    } catch (e) {
      if (e instanceof ValidationError) return badRequest(e.message, origin);
      throw e;
    }

    const progress_pct = typeof body.progress_pct === "number"
      ? Math.max(0, Math.min(100, body.progress_pct))
      : null;
    const season_number = typeof body.season_number === "number" ? body.season_number : null;
    const episode_number = typeof body.episode_number === "number" ? body.episode_number : null;

    // TV requires season + episode for episode-level events
    if (media_type === "tv" && event !== "pause") {
      if (season_number === null || episode_number === null) {
        return badRequest("TV scrobbles require season_number and episode_number", origin);
      }
    }

    log.info("scrobble received", {
      user_id: user.id,
      tmdb_id,
      media_type,
      event,
      season_number,
      episode_number,
      progress_pct,
    });

    // Get or ensure library item exists
    let { data: libItem } = await db
      .from("library")
      .select("id, status, total_episodes, episodes_watched")
      .eq("user_id", user.id)
      .eq("tmdb_id", tmdb_id)
      .eq("media_type", media_type)
      .maybeSingle();

    // ─── "start" event ──────────────────────────────────────────────────────
    if (event === "start") {
      if (!libItem) {
        // Item not in library yet — return a hint to the client to add it first
        return notFound(
          "Item not in library (add it first, then scrobble)",
          origin,
        );
      }

      // Only transition to "watching" if currently unstarted
      if (libItem.status === "plan_to_watch" || libItem.status === "on_hold") {
        await db
          .from("library")
          .update({ status: "watching", started_at: new Date().toISOString() })
          .eq("id", libItem.id)
          .eq("user_id", user.id);
      }

      return jsonOk({ event: "start", recorded: true }, origin);
    }

    // ─── "pause" event ──────────────────────────────────────────────────────
    if (event === "pause") {
      // No state changes — just acknowledge
      return jsonOk({ event: "pause", recorded: true }, origin);
    }

    // ─── "progress" event ───────────────────────────────────────────────────
    if (event === "progress") {
      if (!libItem) {
        return notFound("Item not in library", origin);
      }

      // If we've crossed the completion threshold, auto-promote to "complete"
      if (progress_pct !== null && progress_pct >= COMPLETION_THRESHOLD) {
        return handleComplete(db, user.id, libItem, media_type, tmdb_id, season_number, episode_number, origin);
      }

      return jsonOk({ event: "progress", progress_pct, recorded: true }, origin);
    }

    // ─── "complete" event ───────────────────────────────────────────────────
    if (event === "complete") {
      if (!libItem) {
        return notFound("Item not in library", origin);
      }

      return handleComplete(db, user.id, libItem, media_type, tmdb_id, season_number, episode_number, origin);
    }

    return badRequest("Unknown event", origin);
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});

// ---------------------------------------------------------------------------
// Handle completion logic (shared between "complete" and progress threshold)
// ---------------------------------------------------------------------------
async function handleComplete(
  // deno-lint-ignore no-explicit-any
  db: any,
  userId: string,
  // deno-lint-ignore no-explicit-any
  libItem: any,
  mediaType: "movie" | "tv",
  tmdbId: number,
  seasonNumber: number | null,
  episodeNumber: number | null,
  origin: string | null,
): Promise<Response> {
  const now = new Date().toISOString();

  if (mediaType === "movie") {
    // Mark movie as completed
    const newTimesWatched = (libItem.times_watched ?? 0) + 1;
    await db
      .from("library")
      .update({
        status: "completed",
        times_watched: newTimesWatched,
        completed_at: now,
      })
      .eq("id", libItem.id)
      .eq("user_id", userId);

    log.info("movie completed via scrobble", { user_id: userId, tmdb_id: tmdbId });
    return jsonOk({ event: "complete", media_type: "movie", times_watched: newTimesWatched }, origin);
  }

  // TV — mark episode as watched
  const upsertData = {
    user_id: userId,
    library_id: libItem.id,
    tmdb_show_id: tmdbId,
    season_number: seasonNumber!,
    episode_number: episodeNumber!,
    watched: true,
    watched_at: now,
  };

  await db
    .from("episode_progress")
    .upsert(upsertData, {
      onConflict: "user_id,tmdb_show_id,season_number,episode_number",
    });

  // Count total watched episodes
  const { count } = await db
    .from("episode_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tmdb_show_id", tmdbId)
    .eq("watched", true);

  const newEpisodesWatched = count ?? 0;

  const libUpdates: Record<string, unknown> = {
    episodes_watched: newEpisodesWatched,
    current_season: seasonNumber,
    current_episode: episodeNumber,
  };

  // Auto-status: if status is plan_to_watch or not yet started, move to watching
  if (libItem.status === "plan_to_watch" || libItem.status === "on_hold") {
    libUpdates.status = "watching";
    libUpdates.started_at = now;
  }

  // If all episodes watched, mark series as completed
  if (libItem.total_episodes && newEpisodesWatched >= libItem.total_episodes) {
    libUpdates.status = "completed";
    libUpdates.completed_at = now;
  }

  await db
    .from("library")
    .update(libUpdates)
    .eq("id", libItem.id)
    .eq("user_id", userId);

  log.info("episode completed via scrobble", {
    user_id: userId,
    tmdb_id: tmdbId,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    total_watched: newEpisodesWatched,
  });

  return jsonOk(
    {
      event: "complete",
      media_type: "tv",
      season_number: seasonNumber,
      episode_number: episodeNumber,
      episodes_watched: newEpisodesWatched,
      series_completed: libUpdates.status === "completed",
    },
    origin,
  );
}

function jsonOk(data: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
