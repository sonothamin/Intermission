// =============================================================================
// season-details/index.ts
// GET /functions/v1/season-details?tmdb_id=&season_number=
// Optional auth: returns user's episode progress for the season
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { badRequest, notFound, internalError } from "../_shared/errors.ts";
import { getSeasonDetails } from "../_shared/tmdb.ts";
import { getUserClient } from "../_shared/db.ts";
import { tryGetAuthUser } from "../_shared/auth.ts";
import { parseIntParam } from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("season-details");

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const { value: tmdbId, error: tmdbErr } = parseIntParam(params, "tmdb_id", {
      min: 1,
      required: true,
    });
    if (tmdbErr) return badRequest(tmdbErr, origin);

    const { value: seasonNumber, error: snErr } = parseIntParam(params, "season_number", {
      min: 0,
      required: true,
    });
    if (snErr) return badRequest(snErr, origin);

    const language = params.get("language") ?? "en-US";

    log.info("fetching season", { tmdbId, seasonNumber });

    let season;
    try {
      season = await getSeasonDetails(tmdbId!, seasonNumber!, language);
    } catch (err) {
      if (String(err).includes("404")) {
        return notFound("Season", origin);
      }
      throw err;
    }

    let episodeProgress: Record<number, unknown> = {};
    const user = await tryGetAuthUser(req);

    if (user) {
      const db = getUserClient(req);
      const { data: progress } = await db
        .from("episode_progress")
        .select("episode_number, watched, watched_at, rating, notes")
        .eq("user_id", user.id)
        .eq("tmdb_show_id", tmdbId!)
        .eq("season_number", seasonNumber!);

      if (progress) {
        episodeProgress = Object.fromEntries(
          progress.map((ep) => [ep.episode_number, ep]),
        );
      }
    }

    // Merge user progress into episode list
    const episodes = season.episodes.map((ep) => ({
      ...ep,
      user_progress: episodeProgress[ep.episode_number] ?? null,
    }));

    return new Response(
      JSON.stringify({ ...season, episodes }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders(origin),
        },
      },
    );
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});
