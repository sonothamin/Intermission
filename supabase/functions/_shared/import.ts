// =============================================================================
// _shared/import.ts — Parse import files (Intermission JSON, CSV, Trakt)
// =============================================================================

export type ImportMediaType = "movie" | "tv";

export interface ImportLibraryRow {
  tmdb_id: number;
  media_type: ImportMediaType;
  status?: string;
  rating?: number | null;
  notes?: string | null;
  times_watched?: number;
  completed_at?: string | null;
  started_at?: string | null;
}

export interface ImportEpisodeRow {
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  watched_at?: string | null;
  rating?: number | null;
}

export interface ParsedImport {
  format: "intermission" | "trakt" | "csv";
  library: ImportLibraryRow[];
  episodes: ImportEpisodeRow[];
  watchlist: ImportLibraryRow[];
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
  // Trakt uses 1-10; some exports use 1-5 stars — scale if <= 5
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

function pushLibrary(
  rows: ImportLibraryRow[],
  seen: Set<string>,
  row: ImportLibraryRow,
) {
  const key = `${row.media_type}:${row.tmdb_id}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
}

function pushEpisode(
  rows: ImportEpisodeRow[],
  seen: Set<string>,
  row: ImportEpisodeRow,
) {
  const key = `${row.tmdb_show_id}:${row.season_number}:${row.episode_number}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
}

export function parseImportContent(content: string, filename?: string): ParsedImport {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("File is empty");

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

function parseIntermissionJson(obj: Record<string, unknown>): ParsedImport {
  const library: ImportLibraryRow[] = [];
  const episodes: ImportEpisodeRow[] = [];
  const watchlist: ImportLibraryRow[] = [];
  const libSeen = new Set<string>();
  const epSeen = new Set<string>();
  const wlSeen = new Set<string>();

  for (const item of (obj.library as unknown[]) ?? []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tmdb_id = Number(row.tmdb_id);
    const media_type = row.media_type as ImportMediaType;
    if (!Number.isInteger(tmdb_id) || !["movie", "tv"].includes(media_type)) continue;
    pushLibrary(library, libSeen, {
      tmdb_id,
      media_type,
      status: normalizeStatus(row.status, "plan_to_watch"),
      rating: parseRating(row.rating),
      notes: typeof row.notes === "string" ? row.notes : null,
      times_watched: Number(row.times_watched) || 0,
      completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
      started_at: typeof row.started_at === "string" ? row.started_at : null,
    });
  }

  for (const item of (obj.watchlist as unknown[]) ?? []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tmdb_id = Number(row.tmdb_id);
    const media_type = row.media_type as ImportMediaType;
    if (!Number.isInteger(tmdb_id) || !["movie", "tv"].includes(media_type)) continue;
    pushLibrary(watchlist, wlSeen, {
      tmdb_id,
      media_type,
      status: "plan_to_watch",
      notes: typeof row.notes === "string" ? row.notes : null,
    });
  }

  for (const item of (obj.episode_progress as unknown[]) ?? []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tmdb_show_id = Number(row.tmdb_show_id);
    const season_number = Number(row.season_number);
    const episode_number = Number(row.episode_number);
    if (
      !Number.isInteger(tmdb_show_id) ||
      !Number.isInteger(season_number) ||
      !Number.isInteger(episode_number)
    ) continue;
    if (row.watched === false) continue;
    pushEpisode(episodes, epSeen, {
      tmdb_show_id,
      season_number,
      episode_number,
      watched_at: typeof row.watched_at === "string" ? row.watched_at : null,
      rating: parseRating(row.rating),
    });
  }

  return { format: "intermission", library, episodes, watchlist };
}

function parseTraktCollection(obj: Record<string, unknown>): ParsedImport {
  const library: ImportLibraryRow[] = [];
  const episodes: ImportEpisodeRow[] = [];
  const watchlist: ImportLibraryRow[] = [];
  const libSeen = new Set<string>();
  const epSeen = new Set<string>();

  for (const entry of (obj.movies as unknown[]) ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const movie = row.movie ?? row;
    const tmdb_id = extractTmdbId(movie);
    if (!tmdb_id) continue;
    pushLibrary(library, libSeen, {
      tmdb_id,
      media_type: "movie",
      status: "completed",
      rating: parseRating(row.rating ?? row.user_rating),
      times_watched: 1,
      completed_at: typeof row.watched_at === "string" ? row.watched_at : null,
    });
  }

  for (const entry of (obj.shows as unknown[]) ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const show = row.show ?? row;
    const tmdb_id = extractTmdbId(show);
    if (!tmdb_id) continue;

    const status = row.watched_at || row.last_watched_at ? "watching" : "plan_to_watch";
    pushLibrary(library, libSeen, {
      tmdb_id,
      media_type: "tv",
      status: normalizeStatus(row.status, status),
      rating: parseRating(row.rating ?? row.user_rating),
      started_at: typeof row.started_at === "string" ? row.started_at : null,
    });

    for (const season of (row.seasons as unknown[]) ?? []) {
      if (!season || typeof season !== "object") continue;
      const s = season as Record<string, unknown>;
      const season_number = Number(s.number ?? s.season_number);
      for (const ep of (s.episodes as unknown[]) ?? []) {
        if (!ep || typeof ep !== "object") continue;
        const e = ep as Record<string, unknown>;
        const episode_number = Number(e.number ?? e.episode_number);
        if (!Number.isInteger(season_number) || !Number.isInteger(episode_number)) continue;
        if (e.watched === false || e.completed === false) continue;
        if (e.watched === true || e.completed === true || e.last_watched_at || e.watched_at) {
          pushEpisode(episodes, epSeen, {
            tmdb_show_id: tmdb_id,
            season_number,
            episode_number,
            watched_at: typeof e.last_watched_at === "string"
              ? e.last_watched_at
              : typeof e.watched_at === "string"
              ? e.watched_at
              : null,
            rating: parseRating(e.rating),
          });
        }
      }
    }
  }

  return { format: "trakt", library, episodes, watchlist };
}

function parseTraktHistory(entries: unknown[]): ParsedImport {
  const library: ImportLibraryRow[] = [];
  const episodes: ImportEpisodeRow[] = [];
  const watchlist: ImportLibraryRow[] = [];
  const libSeen = new Set<string>();
  const epSeen = new Set<string>();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const type = String(row.type ?? "").toLowerCase();

    if (type === "movie" && row.movie) {
      const tmdb_id = extractTmdbId(row.movie);
      if (!tmdb_id) continue;
      pushLibrary(library, libSeen, {
        tmdb_id,
        media_type: "movie",
        status: "completed",
        rating: parseRating(row.rating),
        times_watched: 1,
        completed_at: typeof row.watched_at === "string" ? row.watched_at : null,
      });
      continue;
    }

    if ((type === "episode" || row.episode) && row.show) {
      const showId = extractTmdbId(row.show);
      const ep = row.episode as Record<string, unknown> | undefined;
      if (!showId || !ep) continue;
      const season_number = Number(ep.season ?? ep.season_number);
      const episode_number = Number(ep.number ?? ep.episode_number);
      if (!Number.isInteger(season_number) || !Number.isInteger(episode_number)) continue;

      pushLibrary(library, libSeen, {
        tmdb_id: showId,
        media_type: "tv",
        status: "watching",
        started_at: typeof row.watched_at === "string" ? row.watched_at : null,
      });

      pushEpisode(episodes, epSeen, {
        tmdb_show_id: showId,
        season_number,
        episode_number,
        watched_at: typeof row.watched_at === "string" ? row.watched_at : null,
        rating: parseRating(row.rating),
      });
    }
  }

  return { format: "trakt", library, episodes, watchlist };
}

function parseCsv(content: string): ParsedImport {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) throw new Error("CSV must include a header row and at least one data row");

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
  const listTypeIdx = idx("list_type") >= 0 ? idx("list_type") : idx("list");

  const library: ImportLibraryRow[] = [];
  const episodes: ImportEpisodeRow[] = [];
  const watchlist: ImportLibraryRow[] = [];
  const libSeen = new Set<string>();
  const epSeen = new Set<string>();
  const wlSeen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const media_type = cols[typeIdx]?.trim().toLowerCase();
    const tmdb_id = parseInt(cols[tmdbIdx]?.trim() ?? "", 10);
    if (!["movie", "tv"].includes(media_type) || isNaN(tmdb_id)) continue;

    const rawListType = listTypeIdx >= 0 ? (cols[listTypeIdx]?.trim().toLowerCase() || "") : "";
    const explicitWatchlist = rawListType === "watchlist" || rawListType === "plan_to_watch";
    const explicitLibrary = rawListType === "library";

    const status = statusIdx >= 0
      ? normalizeStatus(cols[statusIdx], "plan_to_watch")
      : "plan_to_watch";
    const watched_at = watchedIdx >= 0 ? cols[watchedIdx]?.trim() || null : null;

    // If the CSV row is explicitly tagged as a watchlist row, route to watchlist
    // and skip library/episodes bookkeeping for that row.
    if (explicitWatchlist && !explicitLibrary) {
      pushLibrary(watchlist, wlSeen, {
        tmdb_id,
        media_type: media_type as ImportMediaType,
        status: "plan_to_watch",
        notes: notesIdx >= 0 ? cols[notesIdx]?.trim() || null : null,
      });
      continue;
    }

    pushLibrary(library, libSeen, {
      tmdb_id,
      media_type: media_type as ImportMediaType,
      status: watched_at && status === "plan_to_watch" ? "completed" : status,
      rating: ratingIdx >= 0 ? parseRating(cols[ratingIdx]) : null,
      notes: notesIdx >= 0 ? cols[notesIdx]?.trim() || null : null,
      times_watched: watched_at && media_type === "movie" ? 1 : 0,
      completed_at: watched_at,
    });

    if (media_type === "tv" && seasonIdx >= 0 && episodeIdx >= 0) {
      const season_number = parseInt(cols[seasonIdx]?.trim() ?? "", 10);
      const episode_number = parseInt(cols[episodeIdx]?.trim() ?? "", 10);
      if (!isNaN(season_number) && !isNaN(episode_number)) {
        pushEpisode(episodes, epSeen, {
          tmdb_show_id: tmdb_id,
          season_number,
          episode_number,
          watched_at,
        });
      }
    }

    void titleIdx; // reserved for future TMDB lookup by title
  }

  return { format: "csv", library, episodes, watchlist };
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
