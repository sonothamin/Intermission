// =============================================================================
// settings/index.ts — User preferences/settings
//
// GET   /functions/v1/settings   → get user settings
// PATCH /functions/v1/settings   → update settings
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { badRequest, internalError, methodNotAllowed } from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/db.ts";
import { validateEnum, ValidationError } from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("settings");

const VALID_THEMES = ["dark", "light", "system"] as const;
const VALID_LIST_VIEWS = ["grid", "list", "compact"] as const;

// ISO 639-1 language codes — abbreviated list of common codes
const COMMON_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
  "ar", "hi", "bn", "pa", "tr", "nl", "sv", "pl", "fi", "no",
  "da", "cs", "ro", "hu", "he", "id", "th", "vi", "uk", "el",
];

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const { user, error: authErr } = await getAuthUser(req, origin);
  if (authErr) return authErr;

  const db = getUserClient(req);

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // GET — fetch settings
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await db
        .from("user_settings")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Auto-create if somehow missing (shouldn't happen with trigger)
      if (!data) {
        const { data: created, error: createErr } = await db
          .from("user_settings")
          .insert({ id: user.id })
          .select()
          .single();
        if (createErr) throw createErr;
        return new Response(JSON.stringify(created), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH — update settings
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      try {
        const updates: Record<string, unknown> = {};

        if (body.theme !== undefined) {
          updates.theme = validateEnum(body.theme, "theme", [...VALID_THEMES], true)!;
        }

        if (body.preferred_language !== undefined) {
          const lang = String(body.preferred_language).toLowerCase().trim();
          if (lang.length !== 2 && lang.length !== 5) {
            throw new ValidationError("preferred_language must be a valid ISO 639-1 or BCP47 code");
          }
          updates.preferred_language = lang;
        }

        if (body.preferred_region !== undefined) {
          const region = String(body.preferred_region).toUpperCase().trim();
          if (!/^[A-Z]{2}$/.test(region)) {
            throw new ValidationError("preferred_region must be a 2-letter ISO 3166-1 alpha-2 code");
          }
          updates.preferred_region = region;
        }

        if (body.adult_content !== undefined) {
          updates.adult_content = Boolean(body.adult_content);
        }

        if (body.auto_mark_watched !== undefined) {
          updates.auto_mark_watched = Boolean(body.auto_mark_watched);
        }

        if (body.show_spoilers !== undefined) {
          updates.show_spoilers = Boolean(body.show_spoilers);
        }

        if (body.default_list_view !== undefined) {
          updates.default_list_view = validateEnum(
            body.default_list_view,
            "default_list_view",
            [...VALID_LIST_VIEWS],
            true,
          )!;
        }

        if (body.notifications_enabled !== undefined) {
          updates.notifications_enabled = Boolean(body.notifications_enabled);
        }

        if (Object.keys(updates).length === 0) {
          return badRequest("No valid fields to update", origin);
        }

        const { data, error } = await db
          .from("user_settings")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) throw error;

        log.info("updated settings", { user_id: user.id, fields: Object.keys(updates) });

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      } catch (e) {
        if (e instanceof ValidationError) return badRequest(e.message, origin);
        throw e;
      }
    }

    return methodNotAllowed(origin);
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});
