// =============================================================================
// media-search/index.ts
// GET /functions/v1/media-search?q=&type=movie|tv|all&page=1
// Optional auth: returns user library status for each result if authenticated
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { badRequest, internalError } from "../_shared/errors.ts";
import { searchMedia, getTrending } from "../_shared/tmdb.ts";
import { getUserClient } from "../_shared/db.ts";
import { tryGetAuthUser } from "../_shared/auth.ts";
import { parseIntParam } from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("media-search");

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");

  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const query = params.get("q")?.trim() ?? "";
    const type = params.get("type") ?? "all";
    const language = params.get("language") ?? "en-US";
    const includeAdult = params.get("adult") === "true";

    if (!["movie", "tv", "all"].includes(type)) {
      return badRequest("type must be one of: movie, tv, all", origin);
    }

    const { value: page, error: pageErr } = parseIntParam(params, "page", { min: 1, max: 500 });
    if (pageErr) return badRequest(pageErr, origin);

    let results;

    if (!query) {
      // No query → return trending
      log.info("returning trending", { type });
      const trending = await getTrending(type as "movie" | "tv" | "all", "week", language);
      results = {
        results: trending,
        total_results: trending.length,
        total_pages: 1,
        source: "trending",
      };
    } else {
      if (query.length < 1 || query.length > 200) {
        return badRequest("Query must be between 1 and 200 characters", origin);
      }

      log.info("searching", { query, type, page });
      const data = await searchMedia(
        query,
        type as "movie" | "tv" | "all",
        page ?? 1,
        language,
        includeAdult,
      );
      results = { ...data, source: "search" };
    }

    // If user is authenticated, attach their library status to results
    const user = await tryGetAuthUser(req);
    if (user) {
      const db = getUserClient(req);
      const tmdbIds = results.results.map((r) => r.tmdb_id);

      if (tmdbIds.length > 0) {
        const { data: libraryItems } = await db
          .from("library")
          .select("tmdb_id, media_type, status, rating")
          .eq("user_id", user.id)
          .in("tmdb_id", tmdbIds);

        const { data: watchlistItems } = await db
          .from("watchlist")
          .select("tmdb_id, media_type")
          .eq("user_id", user.id)
          .in("tmdb_id", tmdbIds);

        const libraryMap = new Map(
          (libraryItems ?? []).map((i) => [`${i.tmdb_id}:${i.media_type}`, i]),
        );
        const watchlistSet = new Set(
          (watchlistItems ?? []).map((i) => `${i.tmdb_id}:${i.media_type}`),
        );

        results.results = results.results.map((r) => ({
          ...r,
          user_status: libraryMap.get(`${r.tmdb_id}:${r.media_type}`) ?? null,
          in_watchlist: watchlistSet.has(`${r.tmdb_id}:${r.media_type}`),
        }));
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": query ? "public, max-age=300" : "public, max-age=1800",
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});
