// =============================================================================
// media-details/index.ts
// GET /functions/v1/media-details?tmdb_id=&type=movie|tv
// Optional auth: returns user library entry and episode progress if authenticated
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { badRequest, notFound, internalError } from "../_shared/errors.ts";
import { getMovieDetails, getShowDetails } from "../_shared/tmdb.ts";
import { getUserClient } from "../_shared/db.ts";
import { tryGetAuthUser } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("media-details");

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const tmdbIdRaw = params.get("tmdb_id");
    const type = params.get("type");

    if (!tmdbIdRaw || !type) {
      return badRequest("tmdb_id and type are required", origin);
    }

    const tmdbId = parseInt(tmdbIdRaw, 10);
    if (isNaN(tmdbId) || tmdbId <= 0) {
      return badRequest("tmdb_id must be a positive integer", origin);
    }

    if (!["movie", "tv"].includes(type)) {
      return badRequest("type must be movie or tv", origin);
    }

    const language = params.get("language") ?? "en-US";

    log.info("fetching details", { tmdbId, type });

    let media;
    try {
      media = type === "movie"
        ? await getMovieDetails(tmdbId, language)
        : await getShowDetails(tmdbId, language);
    } catch (err) {
      if (String(err).includes("404")) {
        return notFound("Media", origin);
      }
      throw err;
    }

    let userEntry = null;
    let episodeProgress = null;
    const user = await tryGetAuthUser(req);

    if (user) {
      const db = getUserClient(req);
      const { data: library } = await db
        .from("library")
        .select("*")
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdbId)
        .eq("media_type", type)
        .maybeSingle();

      userEntry = library;

      if (type === "tv" && library) {
        const { data: progress } = await db
          .from("episode_progress")
          .select("season_number, episode_number, watched, watched_at, rating")
          .eq("user_id", user.id)
          .eq("tmdb_show_id", tmdbId)
          .order("season_number")
          .order("episode_number");

        episodeProgress = progress ?? [];
      }
    }

    return new Response(
      JSON.stringify({ media, user_entry: userEntry, episode_progress: episodeProgress }),
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
