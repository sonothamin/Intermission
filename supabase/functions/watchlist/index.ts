// =============================================================================
// watchlist/index.ts — Want-to-watch queue
//
// GET    /functions/v1/watchlist              → paginated watchlist
// POST   /functions/v1/watchlist              → add to watchlist
// PATCH  /functions/v1/watchlist?id=          → update priority/notes
// DELETE /functions/v1/watchlist?id=          → remove from watchlist
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
  validateTmdbId,
  validateMediaType,
  validateString,
  ValidationError,
} from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("watchlist");

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
    // GET — paginated watchlist
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const type = params.get("type");
      const sortBy = params.get("sort_by") ?? "priority";
      const sortDir = params.get("sort_dir") ?? "desc";
      const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "20", 10)));
      const from = (page - 1) * limit;

      const validSortFields = ["priority", "created_at", "title", "release_year"];
      if (!validSortFields.includes(sortBy)) {
        return badRequest(`sort_by must be one of: ${validSortFields.join(", ")}`, origin);
      }

      let query = db
        .from("watchlist")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (type) {
        if (!["movie", "tv"].includes(type)) {
          return badRequest("type must be movie or tv", origin);
        }
        query = query.eq("media_type", type);
      }

      const { data, count, error } = await query
        .order(sortBy, { ascending: sortDir === "asc" })
        .range(from, from + limit - 1);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          data: data ?? [],
          pagination: { page, limit, total: count ?? 0, total_pages: Math.ceil((count ?? 0) / limit) },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } },
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — add to watchlist
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      let tmdb_id: number;
      let media_type: "movie" | "tv";

      try {
        tmdb_id = validateTmdbId(body.tmdb_id);
        media_type = validateMediaType(body.media_type, true)!;
      } catch (e) {
        if (e instanceof ValidationError) return badRequest(e.message, origin);
        throw e;
      }

      // Prevent duplicates
      const { data: existing } = await db
        .from("watchlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdb_id)
        .eq("media_type", media_type)
        .maybeSingle();

      if (existing) {
        return conflict("This item is already in your watchlist", origin);
      }

      // Check it's not already in library
      const { data: inLibrary } = await db
        .from("library")
        .select("id")
        .eq("user_id", user.id)
        .eq("tmdb_id", tmdb_id)
        .eq("media_type", media_type)
        .maybeSingle();

      if (inLibrary) {
        return conflict("This item is already in your library", origin);
      }

      // Fetch TMDB metadata
      log.info("fetching TMDB data for watchlist add", { tmdb_id, media_type });
      const mediaData = media_type === "movie"
        ? await getMovieDetails(tmdb_id)
        : await getShowDetails(tmdb_id);

      const priority = typeof body.priority === "number" ? Math.max(0, Math.min(100, body.priority)) : 0;

      const insertData = {
        user_id: user.id,
        tmdb_id,
        media_type,
        title: mediaData.title,
        poster_url: mediaData.poster_url,
        release_year: mediaData.release_year,
        genres: mediaData.genres,
        original_language: mediaData.original_language,
        priority,
        notes: body.notes ? validateString(body.notes, "notes", { maxLength: 500 }) : null,
      };

      const { data, error } = await db
        .from("watchlist")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      log.info("added to watchlist", { user_id: user.id, tmdb_id, media_type });

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH — update watchlist item (priority, notes)
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const id = params.get("id");
      if (!id) return badRequest("id query parameter is required", origin);

      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      const { data: existing } = await db
        .from("watchlist")
        .select("id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) return notFound("Watchlist item", origin);

      try {
        const updates: Record<string, unknown> = {};

        if (body.priority !== undefined) {
          const p = Number(body.priority);
          if (isNaN(p)) throw new ValidationError("priority must be a number");
          updates.priority = Math.max(0, Math.min(100, p));
        }

        if (body.notes !== undefined) {
          updates.notes = body.notes === null
            ? null
            : validateString(body.notes, "notes", { maxLength: 500 });
        }

        if (Object.keys(updates).length === 0) {
          return badRequest("No valid fields to update", origin);
        }

        const { data, error } = await db
          .from("watchlist")
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
    // DELETE — remove from watchlist
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const id = params.get("id");
      if (!id) return badRequest("id query parameter is required", origin);

      const { error } = await db
        .from("watchlist")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      log.info("removed from watchlist", { user_id: user.id, id });

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
