// =============================================================================
// frontend/src/lib/importParser.ts — Client-side parser for import files
// =============================================================================

export type ImportMediaType = "movie" | "tv";

export interface ParsedEntry {
  tmdb_id: number;
  media_type: ImportMediaType;
  title?: string;
  status: string;
  rating: number | null;
  notes: string | null;
  times_watched: number;
  completed_at?: string | null;
  started_at?: string | null;
  // TV episode-specific fields (if this entry represents an episode progress log)
  is_episode?: boolean;
  season_number?: number | null;
  episode_number?: number | null;
  watched_at?: string | null;
}

export interface SkippedEntry {
  raw: string;
  reason: string;
  title?: string;
  media_type?: string;
  status?: string;
}

export interface ClientParsedImport {
  format: "intermission" | "trakt" | "csv";
  totalEntries: number;
  parsed: ParsedEntry[];
  skipped: SkippedEntry[];
}

const VALID_STATUSES = new Set([
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "plan_to_watch",
  "rewatching",
]);

function normalizeStatus(raw: unknown, fallback = "completed"): string {
  if (typeof raw !== "string") return fallback;
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID_STATUSES.has(s)) return s;
  if (s === "watched" || s === "seen") return "completed";
  if (s === "watchlist" || s === "queued") return "plan_to_watch";
  return fallback;
}

function parseRating(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (isNaN(n)) return null;
  // scale 1-5 stars to 1-10 if integer and <= 5
  const scaled = n <= 5 && n > 0 && !String(raw).includes(".") ? n * 2 : n;
  return Math.min(10, Math.max(0, Math.round(scaled * 10) / 10));
}

function extractTmdbId(obj: unknown): number | null {
  if (!obj || typeof obj !== "object") return null;
  const ids = (obj as Record<string, unknown>).ids ?? obj;
  if (!ids || typeof ids !== "object") return null;
  const tmdb = (ids as Record<string, unknown>).tmdb;
  const n = Number(tmdb);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseImportContent(content: string, filename?: string): ClientParsedImport {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("File is empty");
  }

  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "csv" || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return parseCsv(trimmed);
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return parseCsv(trimmed);
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.library) || Array.isArray(obj.episode_progress)) {
      return parseIntermissionJson(obj);
    }
    if (Array.isArray(obj.movies) || Array.isArray(obj.shows)) {
      return parseTraktCollection(obj);
    }
  }

  if (Array.isArray(data)) {
    return parseTraktHistory(data);
  }

  throw new Error("Unrecognized JSON structure. See import format help.");
}

function parseIntermissionJson(obj: Record<string, unknown>): ClientParsedImport {
  const parsed: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];
  let totalEntries = 0;

  // 1. Library Items
  if (Array.isArray(obj.library)) {
    totalEntries += obj.library.length;
    for (const item of obj.library) {
      if (!item || typeof item !== "object") {
        skipped.push({ raw: JSON.stringify(item), reason: "Not an object" });
        continue;
      }
      const row = item as Record<string, unknown>;
      const tmdb_id = Number(row.tmdb_id);
      const media_type = row.media_type as ImportMediaType;
      if (!Number.isInteger(tmdb_id) || !["movie", "tv"].includes(media_type)) {
        skipped.push({
          raw: JSON.stringify(item),
          reason: `Invalid TMDB ID (${row.tmdb_id}) or Media Type (${row.media_type})`,
          title: typeof row.title === "string" ? row.title : undefined,
          media_type: typeof row.media_type === "string" ? row.media_type : undefined,
          status: typeof row.status === "string" ? row.status : undefined,
        });
        continue;
      }

      parsed.push({
        tmdb_id,
        media_type,
        title: typeof row.title === "string" ? row.title : undefined,
        status: normalizeStatus(row.status, "plan_to_watch"),
        rating: parseRating(row.rating),
        notes: typeof row.notes === "string" ? row.notes : null,
        times_watched: Number(row.times_watched) || 0,
        completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
        started_at: typeof row.started_at === "string" ? row.started_at : null,
      });
    }
  }

  // 2. Watchlist Items
  if (Array.isArray(obj.watchlist)) {
    totalEntries += obj.watchlist.length;
    for (const item of obj.watchlist) {
      if (!item || typeof item !== "object") {
        skipped.push({ raw: JSON.stringify(item), reason: "Not an object" });
        continue;
      }
      const row = item as Record<string, unknown>;
      const tmdb_id = Number(row.tmdb_id);
      const media_type = row.media_type as ImportMediaType;
      if (!Number.isInteger(tmdb_id) || !["movie", "tv"].includes(media_type)) {
        skipped.push({
          raw: JSON.stringify(item),
          reason: `Invalid TMDB ID (${row.tmdb_id}) or Media Type (${row.media_type})`,
          title: typeof row.title === "string" ? row.title : undefined,
          media_type: typeof row.media_type === "string" ? row.media_type : undefined,
          status: "plan_to_watch",
        });
        continue;
      }

      parsed.push({
        tmdb_id,
        media_type,
        title: typeof row.title === "string" ? row.title : undefined,
        status: "plan_to_watch",
        rating: null,
        notes: typeof row.notes === "string" ? row.notes : null,
        times_watched: 0,
      });
    }
  }

  // 3. Episode Progress
  if (Array.isArray(obj.episode_progress)) {
    totalEntries += obj.episode_progress.length;
    for (const item of obj.episode_progress) {
      if (!item || typeof item !== "object") {
        skipped.push({ raw: JSON.stringify(item), reason: "Not an object" });
        continue;
      }
      const row = item as Record<string, unknown>;
      const tmdb_show_id = Number(row.tmdb_show_id);
      const season_number = Number(row.season_number);
      const episode_number = Number(row.episode_number);

      if (
        !Number.isInteger(tmdb_show_id) ||
        !Number.isInteger(season_number) ||
        !Number.isInteger(episode_number)
      ) {
        skipped.push({
          raw: JSON.stringify(item),
          reason: "Invalid season, episode, or show ID numbers",
          title: typeof row.episode_title === "string" ? row.episode_title : `S${row.season_number}E${row.episode_number}`,
          media_type: "tv",
        });
        continue;
      }

      if (row.watched === false) {
        skipped.push({ raw: JSON.stringify(item), reason: "Episode is marked unwatched" });
        continue;
      }

      parsed.push({
        tmdb_id: tmdb_show_id,
        media_type: "tv",
        title: typeof row.episode_title === "string" ? row.episode_title : `S${season_number}E${episode_number}`,
        status: "watching",
        rating: parseRating(row.rating),
        notes: typeof row.notes === "string" ? row.notes : null,
        times_watched: 1,
        is_episode: true,
        season_number,
        episode_number,
        watched_at: typeof row.watched_at === "string" ? row.watched_at : null,
      });
    }
  }

  return { format: "intermission", totalEntries, parsed, skipped };
}

function parseTraktCollection(obj: Record<string, unknown>): ClientParsedImport {
  const parsed: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];
  let totalEntries = 0;

  if (Array.isArray(obj.movies)) {
    totalEntries += obj.movies.length;
    for (const entry of obj.movies) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const movie = row.movie ?? row;
      const tmdb_id = extractTmdbId(movie);
      const movieTitle = (movie as Record<string, unknown>)?.title as string | undefined;

      if (!tmdb_id) {
        skipped.push({ raw: JSON.stringify(entry), reason: "Missing TMDB ID for Movie", title: movieTitle, media_type: "movie", status: "completed" });
        continue;
      }

      parsed.push({
        tmdb_id,
        media_type: "movie",
        title: movieTitle,
        status: "completed",
        rating: parseRating(row.rating ?? row.user_rating),
        notes: null,
        times_watched: 1,
        completed_at: typeof row.watched_at === "string" ? row.watched_at : null,
      });
    }
  }

  if (Array.isArray(obj.shows)) {
    totalEntries += obj.shows.length;
    for (const entry of obj.shows) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const show = row.show ?? row;
      const tmdb_id = extractTmdbId(show);
      const showTitle = (show as Record<string, unknown>)?.title as string | undefined;

      if (!tmdb_id) {
        skipped.push({ raw: JSON.stringify(entry), reason: "Missing TMDB ID for Show", title: showTitle, media_type: "tv", status: "watching" });
        continue;
      }

      const status = row.watched_at || row.last_watched_at ? "watching" : "plan_to_watch";
      parsed.push({
        tmdb_id,
        media_type: "tv",
        title: showTitle,
        status: normalizeStatus(row.status, status),
        rating: parseRating(row.rating ?? row.user_rating),
        notes: null,
        times_watched: 0,
        started_at: typeof row.started_at === "string" ? row.started_at : null,
      });

      if (Array.isArray(row.seasons)) {
        for (const season of row.seasons) {
          if (!season || typeof season !== "object") continue;
          const s = season as Record<string, unknown>;
          const season_number = Number(s.number ?? s.season_number);
          if (Array.isArray(s.episodes)) {
            for (const ep of s.episodes) {
              if (!ep || typeof ep !== "object") continue;
              const e = ep as Record<string, unknown>;
              const episode_number = Number(e.number ?? e.episode_number);
              if (!Number.isInteger(season_number) || !Number.isInteger(episode_number)) continue;
              if (e.watched === false || e.completed === false) continue;
              
              if (e.watched === true || e.completed === true || e.last_watched_at || e.watched_at) {
                totalEntries++;
                parsed.push({
                  tmdb_id,
                  media_type: "tv",
                  title: `${showTitle || "Show"} S${season_number}E${episode_number}`,
                  status: "watching",
                  rating: parseRating(e.rating),
                  notes: null,
                  times_watched: 1,
                  is_episode: true,
                  season_number,
                  episode_number,
                  watched_at: typeof e.last_watched_at === "string"
                    ? e.last_watched_at
                    : typeof e.watched_at === "string"
                    ? e.watched_at
                    : null,
                });
              }
            }
          }
        }
      }
    }
  }

  return { format: "trakt", totalEntries, parsed, skipped };
}

function parseTraktHistory(entries: unknown[]): ClientParsedImport {
  const parsed: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];
  let totalEntries = entries.length;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      skipped.push({ raw: String(entry), reason: "Not an object" });
      continue;
    }
    const row = entry as Record<string, unknown>;
    const type = String(row.type ?? "").toLowerCase();

    if (type === "movie" && row.movie) {
      const movie = row.movie as Record<string, unknown>;
      const tmdb_id = extractTmdbId(movie);
      if (!tmdb_id) {
        skipped.push({ raw: JSON.stringify(entry), reason: "Missing TMDB ID for movie", title: movie.title as string | undefined, media_type: "movie", status: "completed" });
        continue;
      }
      parsed.push({
        tmdb_id,
        media_type: "movie",
        title: movie.title as string | undefined,
        status: "completed",
        rating: parseRating(row.rating),
        notes: null,
        times_watched: 1,
        completed_at: typeof row.watched_at === "string" ? row.watched_at : null,
      });
      continue;
    }

    if ((type === "episode" || row.episode) && row.show) {
      const show = row.show as Record<string, unknown>;
      const showId = extractTmdbId(show);
      const ep = row.episode as Record<string, unknown> | undefined;
      if (!showId || !ep) {
        skipped.push({ raw: JSON.stringify(entry), reason: "Missing show ID or episode information", title: (show.title as string | undefined) || (ep.title as string | undefined), media_type: "tv", status: "watching" });
        continue;
      }
      const season_number = Number(ep.season ?? ep.season_number);
      const episode_number = Number(ep.number ?? ep.episode_number);
      if (!Number.isInteger(season_number) || !Number.isInteger(episode_number)) {
        skipped.push({ raw: JSON.stringify(entry), reason: "Invalid season or episode number", title: `${show.title || "Show"} S${ep.season || ep.season_number}E${ep.number || ep.episode_number}`, media_type: "tv", status: "watching" });
        continue;
      }

      parsed.push({
        tmdb_id: showId,
        media_type: "tv",
        title: `${show.title || "Show"} S${season_number}E${episode_number}`,
        status: "watching",
        rating: parseRating(row.rating),
        notes: null,
        times_watched: 1,
        is_episode: true,
        season_number,
        episode_number,
        watched_at: typeof row.watched_at === "string" ? row.watched_at : null,
      });
      continue;
    }

    skipped.push({ raw: JSON.stringify(entry), reason: `Unknown Trakt history item type: ${type}` });
  }

  return { format: "trakt", totalEntries, parsed, skipped };
}

function parseCsv(content: string): ClientParsedImport {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const idx = (name: string) => header.indexOf(name);

  const typeIdx = idx("type") >= 0 ? idx("type") : idx("media_type");
  const tmdbIdx = idx("tmdb_id") >= 0 ? idx("tmdb_id") : idx("tmdb");
  if (typeIdx < 0 || tmdbIdx < 0) {
    throw new Error("CSV requires columns: type (or media_type), tmdb_id (or tmdb)");
  }

  const statusIdx = idx("status");
  const ratingIdx = idx("rating");
  const watchedIdx = idx("watched_at");
  const seasonIdx = idx("season") >= 0 ? idx("season") : idx("season_number");
  const episodeIdx = idx("episode") >= 0 ? idx("episode") : idx("episode_number");
  const titleIdx = idx("title");
  const notesIdx = idx("notes");

  const parsed: ParsedEntry[] = [];
  const skipped: SkippedEntry[] = [];
  const totalEntries = lines.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = splitCsvLine(rawLine);
    const media_type = cols[typeIdx]?.trim().toLowerCase();
    const tmdb_id = parseInt(cols[tmdbIdx]?.trim() ?? "", 10);

    if (!["movie", "tv"].includes(media_type) || isNaN(tmdb_id)) {
      const title = titleIdx >= 0 ? cols[titleIdx]?.trim() : cols[0]?.trim();
      skipped.push({
        raw: rawLine,
        reason: `Invalid Media Type (${media_type || "none"}) or TMDB ID (${cols[tmdbIdx] || "none"})`,
        title: title || undefined,
        media_type: media_type || undefined,
        status: statusIdx >= 0 ? cols[statusIdx]?.trim() : undefined,
      });
      continue;
    }

    const title = titleIdx >= 0 ? cols[titleIdx]?.trim() : undefined;
    const status = statusIdx >= 0
      ? normalizeStatus(cols[statusIdx], "plan_to_watch")
      : "plan_to_watch";
    const watched_at = watchedIdx >= 0 ? cols[watchedIdx]?.trim() || null : null;
    const notes = notesIdx >= 0 ? cols[notesIdx]?.trim() || null : null;

    if (media_type === "tv" && seasonIdx >= 0 && episodeIdx >= 0) {
      const season_number = parseInt(cols[seasonIdx]?.trim() ?? "", 10);
      const episode_number = parseInt(cols[episodeIdx]?.trim() ?? "", 10);
      if (!isNaN(season_number) && !isNaN(episode_number)) {
        parsed.push({
          tmdb_id,
          media_type: "tv",
          title: title || `TV Show (TMDB: ${tmdb_id}) S${season_number}E${episode_number}`,
          status: "watching",
          rating: ratingIdx >= 0 ? parseRating(cols[ratingIdx]) : null,
          notes,
          times_watched: 1,
          is_episode: true,
          season_number,
          episode_number,
          watched_at,
        });
        continue;
      }
    }

    parsed.push({
      tmdb_id,
      media_type: media_type as ImportMediaType,
      title: title || `${media_type === "movie" ? "Movie" : "TV Show"} (TMDB: ${tmdb_id})`,
      status: watched_at && status === "plan_to_watch" ? "completed" : status,
      rating: ratingIdx >= 0 ? parseRating(cols[ratingIdx]) : null,
      notes,
      times_watched: watched_at && media_type === "movie" ? 1 : 0,
      completed_at: watched_at,
    });
  }

  return { format: "csv", totalEntries, parsed, skipped };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result.map((s) => s.replace(/^"|"$/g, "").trim());
}
