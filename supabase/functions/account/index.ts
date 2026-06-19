// =============================================================================
// account/index.ts — Account management (delete account, export data)
//
// GET    /functions/v1/account          → get account summary
// POST   /functions/v1/account/export   → request full data export
// DELETE /functions/v1/account          → delete account + all data
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import {
  badRequest,
  internalError,
  methodNotAllowed,
} from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient, getAdminClient } from "../_shared/db.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("account");

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const { user, error: authErr } = await getAuthUser(req, origin);
  if (authErr) return authErr;

  const db = getUserClient(req);
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // GET — account summary
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const [profileRes, statsRes, libraryCountRes, watchlistCountRes] = await Promise.all([
        db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        db.from("user_watch_stats").select("*").eq("user_id", user.id).maybeSingle(),
        db.from("library").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        db.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      return new Response(
        JSON.stringify({
          user_id: user.id,
          email: user.email,
          profile: profileRes.data,
          stats: statsRes.data,
          library_count: libraryCountRes.count ?? 0,
          watchlist_count: watchlistCountRes.count ?? 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        },
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST — export all data
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "POST" && action === "export") {
      log.info("data export requested", { user_id: user.id });

      const [library, watchlist, episodeProgress, profile, settings] = await Promise.all([
        db.from("library").select("*").eq("user_id", user.id),
        db.from("watchlist").select("*").eq("user_id", user.id),
        db.from("episode_progress").select("*").eq("user_id", user.id),
        db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        db.from("user_settings").select("*").eq("id", user.id).maybeSingle(),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        email: user.email,
        profile: profile.data,
        settings: settings.data,
        library: library.data ?? [],
        watchlist: watchlist.data ?? [],
        episode_progress: episodeProgress.data ?? [],
      };

      // Return as downloadable JSON
      return new Response(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="intermission-export-${user.id}.json"`,
          ...corsHeaders(origin),
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE — delete account and all data
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const body = await req.json().catch(() => null);

      // Require confirmation payload to prevent accidental deletion
      if (!body?.confirm || body.confirm !== "DELETE MY ACCOUNT") {
        return badRequest(
          'To confirm deletion, send: { "confirm": "DELETE MY ACCOUNT" }',
          origin,
        );
      }

      log.warn("account deletion requested", { user_id: user.id, email: user.email });

      // Delete user from auth.users — cascades to all tables via FK
      const admin = getAdminClient();
      const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);

      if (deleteErr) {
        log.error("failed to delete user", { user_id: user.id, err: deleteErr.message });
        throw deleteErr;
      }

      log.info("account deleted", { user_id: user.id });

      return new Response(
        JSON.stringify({ success: true, message: "Account and all data permanently deleted." }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        },
      );
    }

    return methodNotAllowed(origin);
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});
