// =============================================================================
// import/index.ts — Import library data from JSON, CSV, or Trakt export
//
// POST /functions/v1/import
//   multipart/form-data: file=<json|csv>
//   or JSON body: { content: string, filename?: string }
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { badRequest, internalError, methodNotAllowed } from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/db.ts";
import { getMovieDetails, getShowDetails } from "../_shared/tmdb.ts";
import { parseImportContent, type ImportLibraryRow, type ImportEpisodeRow } from "../_shared/import.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("import");

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  if (req.method !== "POST") return methodNotAllowed(origin);

  const { user, error: authErr } = await getAuthUser(req, origin);
  if (authErr) return authErr;

  const db = getUserClient(req);

  try {
    let content = "";
    let filename: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return badRequest("Upload a file using the 'file' field", origin);
      }
      content = await file.text();
      filename = file.name;
    } else {
      const body = await req.json().catch(() => null);
      if (!body?.content || typeof body.content !== "string") {
        return badRequest("Send multipart file or JSON body { content, filename? }", origin);
      }
      content = body.content;
      filename = typeof body.filename === "string" ? body.filename : undefined;
    }

    const parsed = parseImportContent(content, filename);
    const result = {
      format: parsed.format,
      library: { imported: 0, updated: 0, skipped: 0, errors: [] as string[] },
      watchlist: { imported: 0, skipped: 0, errors: [] as string[] },
      episodes: { imported: 0, skipped: 0, errors: [] as string[] },
    };

    const libraryIds = new Map<string, string>();

    for (const row of parsed.library) {
      try {
        const outcome = await upsertLibraryItem(db, user.id, row);
        libraryIds.set(`${row.media_type}:${row.tmdb_id}`, outcome.id);
        if (outcome.created) result.library.imported++;
        else result.library.updated++;
      } catch (err) {
        result.library.skipped++;
        result.library.errors.push(`${row.media_type}/${row.tmdb_id}: ${String(err)}`);
      }
    }

    for (const row of parsed.watchlist) {
      try {
        await upsertWatchlistItem(db, user.id, row);
        result.watchlist.imported++;
      } catch (err) {
        result.watchlist.skipped++;
        result.watchlist.errors.push(`${row.media_type}/${row.tmdb_id}: ${String(err)}`);
      }
    }

    for (const row of parsed.episodes) {
      try {
        const libKey = `tv:${row.tmdb_show_id}`;
        let libraryId = libraryIds.get(libKey);
        if (!libraryId) {
          const { data: existing } = await db
            .from("library")
            .select("id")
            .eq("user_id", user.id)
            .eq("tmdb_id", row.tmdb_show_id)
            .eq("media_type", "tv")
            .maybeSingle();
          if (!existing) {
            const created = await upsertLibraryItem(db, user.id, {
              tmdb_id: row.tmdb_show_id,
              media_type: "tv",
              status: "watching",
            });
            libraryId = created.id;
            libraryIds.set(libKey, libraryId);
            result.library.imported++;
          } else {
            libraryId = existing.id;
            libraryIds.set(libKey, libraryId);
          }
        }
        await upsertEpisode(db, user.id, libraryId, row);
        result.episodes.imported++;
      } catch (err) {
        result.episodes.skipped++;
        result.episodes.errors.push(
          `S${row.season_number}E${row.episode_number} show ${row.tmdb_show_id}: ${String(err)}`,
        );
      }
    }

    // Refresh episodes_watched counts for imported shows
    for (const [key, libraryId] of libraryIds) {
      if (!key.startsWith("tv:")) continue;
      const tmdbShowId = parseInt(key.split(":")[1], 10);
      const { count } = await db
        .from("episode_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("tmdb_show_id", tmdbShowId)
        .eq("watched", true);
      const epCount = count ?? 0;
      const updates: Record<string, unknown> = { episodes_watched: epCount };
      if (epCount > 0) updates.status = "watching";
      await db
        .from("library")
        .update(updates)
        .eq("id", libraryId)
        .eq("user_id", user.id);
    }

    log.info("import complete", { user_id: user.id, format: parsed.format, result });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (err) {
    log.error("import failed", { err: String(err) });
    if (String(err).includes("Unrecognized") || String(err).includes("CSV") || String(err).includes("empty")) {
      return badRequest(String(err), origin);
    }
    return internalError(origin, err);
  }
});

// deno-lint-ignore no-explicit-any
async function upsertLibraryItem(db: any, userId: string, row: ImportLibraryRow) {
  const { data: existing } = await db
    .from("library")
    .select("id, status, times_watched")
    .eq("user_id", userId)
    .eq("tmdb_id", row.tmdb_id)
    .eq("media_type", row.media_type)
    .maybeSingle();

  const mediaData = row.media_type === "movie"
    ? await getMovieDetails(row.tmdb_id)
    : await getShowDetails(row.tmdb_id);

  const status = row.status ?? "plan_to_watch";
  const times_watched = row.times_watched ??
    (row.media_type === "movie" && status === "completed" ? 1 : 0);

  const payload = {
    user_id: userId,
    tmdb_id: row.tmdb_id,
    media_type: row.media_type,
    title: mediaData.title,
    poster_url: mediaData.poster_url,
    backdrop_url: mediaData.backdrop_url,
    release_year: mediaData.release_year,
    genres: mediaData.genres,
    origin_country: mediaData.origin_country,
    original_language: mediaData.original_language,
    runtime_minutes: mediaData.runtime_minutes,
    status,
    rating: row.rating ?? null,
    notes: row.notes ?? null,
    times_watched,
    total_seasons: row.media_type === "tv"
      ? (mediaData as { number_of_seasons: number }).number_of_seasons
      : null,
    total_episodes: row.media_type === "tv"
      ? (mediaData as { number_of_episodes: number }).number_of_episodes
      : null,
    started_at: row.started_at ?? (status === "watching" || status === "completed" ? new Date().toISOString() : null),
    completed_at: row.completed_at ?? (status === "completed" ? new Date().toISOString() : null),
  };

  if (existing) {
    const { data, error } = await db
      .from("library")
      .update(payload)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id as string, created: false };
  }

  const { data, error } = await db.from("library").insert(payload).select("id").single();
  if (error) throw error;
  return { id: data.id as string, created: true };
}

// deno-lint-ignore no-explicit-any
async function upsertWatchlistItem(db: any, userId: string, row: ImportLibraryRow) {
  const { data: existing } = await db
    .from("watchlist")
    .select("id")
    .eq("user_id", userId)
    .eq("tmdb_id", row.tmdb_id)
    .eq("media_type", row.media_type)
    .maybeSingle();

  if (existing) return;

  const mediaData = row.media_type === "movie"
    ? await getMovieDetails(row.tmdb_id)
    : await getShowDetails(row.tmdb_id);

  const { error } = await db.from("watchlist").insert({
    user_id: userId,
    tmdb_id: row.tmdb_id,
    media_type: row.media_type,
    title: mediaData.title,
    poster_url: mediaData.poster_url,
    release_year: mediaData.release_year,
    genres: mediaData.genres,
    original_language: mediaData.original_language,
    priority: 0,
    notes: row.notes ?? null,
  });

  if (error) throw error;
}

// deno-lint-ignore no-explicit-any
async function upsertEpisode(
  db: any,
  userId: string,
  libraryId: string,
  row: ImportEpisodeRow,
) {
  const watched_at = row.watched_at ?? new Date().toISOString();
  const { error } = await db.from("episode_progress").upsert(
    {
      user_id: userId,
      library_id: libraryId,
      tmdb_show_id: row.tmdb_show_id,
      season_number: row.season_number,
      episode_number: row.episode_number,
      watched: true,
      watched_at,
      rating: row.rating ?? null,
    },
    { onConflict: "user_id,tmdb_show_id,season_number,episode_number" },
  );
  if (error) throw error;
}
