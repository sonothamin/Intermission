// =============================================================================
// analytics/index.ts — Dashboard stats and watch habit analytics
//
// GET /functions/v1/analytics
//   ?period=all|30d|90d|1y     (default: all)
//   &type=movie|tv|all         (default: all)
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { badRequest, internalError } from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/db.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("analytics");

type Period = "all" | "30d" | "90d" | "1y";

function getPeriodFilter(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "30d":
      return new Date(now.getTime() - 30 * 86400000).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * 86400000).toISOString();
    case "1y":
      return new Date(now.getTime() - 365 * 86400000).toISOString();
    default:
      return null;
  }
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
    const period = (params.get("period") ?? "all") as Period;
    if (!["all", "30d", "90d", "1y"].includes(period)) {
      return badRequest("period must be one of: all, 30d, 90d, 1y", origin);
    }

    const typeFilter = params.get("type");
    if (typeFilter && !["movie", "tv"].includes(typeFilter)) {
      return badRequest("type must be movie or tv", origin);
    }

    const sinceDate = getPeriodFilter(period);
    log.info("computing analytics", { user_id: user.id, period });

    // ── Fetch all library data for the user ──────────────────────────────────
    let libQuery = db
      .from("library")
      .select(
        "id, media_type, status, rating, genres, origin_country, original_language, " +
        "runtime_minutes, times_watched, episodes_watched, release_year, " +
        "started_at, completed_at, created_at",
      )
      .eq("user_id", user.id);

    if (typeFilter) libQuery = libQuery.eq("media_type", typeFilter);
    if (sinceDate) libQuery = libQuery.gte("created_at", sinceDate);

    const { data: library, error: libErr } = await libQuery;
    if (libErr) throw libErr;

    // ── Fetch episode progress (paginated to avoid the 1000-row default cap) ──
    const PAGE_SIZE = 1000;
    const episodes: Array<{
      watched: boolean;
      watched_at: string | null;
      runtime_minutes: number | null;
      season_number: number | null;
    }> = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let epQuery = db
        .from("episode_progress")
        .select("watched, watched_at, runtime_minutes, season_number")
        .eq("user_id", user.id)
        .eq("watched", true)
        .range(offset, offset + PAGE_SIZE - 1);
      if (sinceDate) epQuery = epQuery.gte("watched_at", sinceDate);
      const { data: page, error: epErr } = await epQuery;
      if (epErr) throw epErr;
      if (!page || page.length === 0) break;
      episodes.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    // ── Compute stats ────────────────────────────────────────────────────────
    const items = library ?? [];
    const eps = episodes;

    const movies = items.filter((i) => i.media_type === "movie");
    const shows = items.filter((i) => i.media_type === "tv");

    // Count movies with actual watch activity (completed or rewatched)
    const moviesWatched = movies.filter(
      (m) => m.status === "completed" || (m.times_watched ?? 0) > 0,
    );
    const movieHours = movies.reduce((sum, m) => {
      const views = Math.max(m.times_watched ?? 0, m.status === "completed" ? 1 : 0);
      if (views === 0) return sum;
      return sum + (m.runtime_minutes ?? 120) * views;
    }, 0) / 60;

    const tvHours = eps.reduce((sum, ep) => {
      return sum + (ep.runtime_minutes ?? 45);
    }, 0) / 60;

    const totalHours = movieHours + tvHours;

    // Genre breakdown
    const genreCounts: Record<string, number> = {};
    for (const item of items) {
      for (const g of item.genres ?? []) {
        genreCounts[g] = (genreCounts[g] ?? 0) + 1;
      }
    }

    // Language breakdown (count + runtime minutes)
    const langCounts: Record<string, number> = {};
    const langMinutes: Record<string, number> = {};
    for (const item of items) {
      const lang = item.original_language ?? "unknown";
      langCounts[lang] = (langCounts[lang] ?? 0) + 1;
      const mins = item.media_type === "movie"
        ? (item.runtime_minutes ?? 120) * Math.max(item.times_watched ?? 0, item.status === "completed" ? 1 : 0)
        : (item.episodes_watched ?? 0) * (item.runtime_minutes ?? 45);
      langMinutes[lang] = (langMinutes[lang] ?? 0) + mins;
    }

    // Country/region breakdown (count + runtime minutes)
    const countryCounts: Record<string, number> = {};
    const countryMinutes: Record<string, number> = {};
    for (const item of items) {
      const mins = item.media_type === "movie"
        ? (item.runtime_minutes ?? 120) * Math.max(item.times_watched ?? 0, item.status === "completed" ? 1 : 0)
        : (item.episodes_watched ?? 0) * (item.runtime_minutes ?? 45);
      for (const c of item.origin_country ?? []) {
        countryCounts[c] = (countryCounts[c] ?? 0) + 1;
        countryMinutes[c] = (countryMinutes[c] ?? 0) + mins;
      }
    }

    // Decade breakdown (by release_year)
    const decadeCounts: Record<string, number> = {};
    for (const item of items) {
      if (item.release_year) {
        const decade = `${Math.floor(item.release_year / 10) * 10}s`;
        decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;
      }
    }

    // Average rating
    const ratedItems = items.filter((i) => i.rating !== null && i.rating !== undefined);
    const avgRating = ratedItems.length > 0
      ? ratedItems.reduce((s, i) => s + i.rating, 0) / ratedItems.length
      : null;

    // Rating distribution (0-10, bucketed by whole number)
    const ratingDist: Record<string, number> = {};
    for (const item of ratedItems) {
      const bucket = String(Math.floor(item.rating));
      ratingDist[bucket] = (ratingDist[bucket] ?? 0) + 1;
    }

    // Monthly watch activity (episodes watched per month)
    const monthlyActivity: Record<string, { movies: number; episodes: number }> = {};
    for (const item of moviesWatched) {
      const dateStr = item.completed_at ?? item.created_at;
      if (dateStr) {
        const key = dateStr.slice(0, 7); // YYYY-MM
        if (!monthlyActivity[key]) monthlyActivity[key] = { movies: 0, episodes: 0 };
        monthlyActivity[key].movies += Math.max(item.times_watched ?? 1, 1);
      }
    }
    for (const ep of eps) {
      if (ep.watched_at) {
        const key = ep.watched_at.slice(0, 7);
        if (!monthlyActivity[key]) monthlyActivity[key] = { movies: 0, episodes: 0 };
        monthlyActivity[key].episodes += 1;
      }
    }

    // Series status breakdown
    const seriesStatus = {
      watching: shows.filter((s) => s.status === "watching").length,
      completed: shows.filter((s) => s.status === "completed").length,
      on_hold: shows.filter((s) => s.status === "on_hold").length,
      dropped: shows.filter((s) => s.status === "dropped").length,
      plan_to_watch: shows.filter((s) => s.status === "plan_to_watch").length,
      rewatching: shows.filter((s) => s.status === "rewatching").length,
    };

    // Watchlist count
    const { count: watchlistCount } = await db
      .from("watchlist")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Top 5 of each category
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const topLanguages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count, minutes: langMinutes[code] ?? 0 }));

    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count, minutes: countryMinutes[code] ?? 0 }));

    const analytics = {
      period,
      summary: {
        total_items: items.length,
        movies_watched: moviesWatched.length,
        total_movies: movies.length,
        series_tracked: shows.length,
        episodes_watched: eps.length,
        total_hours_watched: Math.round(totalHours * 10) / 10,
        movie_hours: Math.round(movieHours * 10) / 10,
        tv_hours: Math.round(tvHours * 10) / 10,
        avg_rating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
        rated_items: ratedItems.length,
        watchlist_count: watchlistCount ?? 0,
      },
      series_status: seriesStatus,
      genres: topGenres,
      languages: topLanguages,
      countries: topCountries,
      decades: Object.entries(decadeCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([decade, count]) => ({ decade, count })),
      rating_distribution: Object.entries(ratingDist)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([score, count]) => ({ score: Number(score), count })),
      monthly_activity: Object.entries(monthlyActivity)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, counts]) => ({ month, ...counts })),
    };

    return new Response(JSON.stringify(analytics), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=300", // 5 min, user-specific
        ...corsHeaders(origin),
      },
    });
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});
