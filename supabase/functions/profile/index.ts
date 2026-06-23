// =============================================================================
// profile/index.ts — User profile management
//
// GET    /functions/v1/profile                  → own profile + stats
// GET    /functions/v1/profile?user_id=         → public profile by user id
// GET    /functions/v1/profile?username=        → public profile by username
// PATCH  /functions/v1/profile                  → update own profile
// POST   /functions/v1/profile/avatar           → upload avatar
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import {
  badRequest,
  notFound,
  forbidden,
  internalError,
  methodNotAllowed,
} from "../_shared/errors.ts";
import { getAuthUser, tryGetAuthUser } from "../_shared/auth.ts";
import { getUserClient, getAdminClient } from "../_shared/db.ts";
import { validateString, ValidationError } from "../_shared/validate.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("profile");

const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const params = url.searchParams;

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // GET — profile (own or public, or search)
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const targetUserId = params.get("user_id");
      const targetUsername = params.get("username");
      const searchQuery = params.get("q");

      // Try to get the requesting user (optional)
      const requestingUser = await tryGetAuthUser(req);
      const db = requestingUser ? getUserClient(req) : getAdminClient();

      // ── Search mode ─────────────────────────────────────────────────────
      // Returns public-only profile rows whose username OR display_name
      // matches the query (case-insensitive, prefix-or-substring on
      // username; substring on display_name). Results are trimmed to 20
      // and ordered by username to keep the response stable.
      if (searchQuery !== null) {
        const q = searchQuery.trim();
        if (q.length < 2) {
          return badRequest("search query must be at least 2 characters", origin);
        }
        if (q.length > 50) {
          return badRequest("search query must be 50 characters or fewer", origin);
        }
        // Escape % and _ for ilike patterns
        const safe = q.replace(/[%_\\]/g, (m) => "\\" + m);
        const pattern = `%${safe}%`;
        const { data: matches, error: searchErr } = await getAdminClient()
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio, is_public")
          .eq("is_public", true)
          .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
          .order("username", { ascending: true })
          .limit(20);
        if (searchErr) throw searchErr;
        return new Response(
          JSON.stringify({ profiles: matches ?? [] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          },
        );
      }

      // Resolve the user id from whichever identifier was supplied. Username
      // lookups go through the admin client because RLS hides private profiles
      // — we'll still respect the privacy flag below before returning data.
      let userId: string;

      if (targetUserId) {
        userId = targetUserId;
      } else if (targetUsername) {
        if (targetUsername.length < 3 || targetUsername.length > 30) {
          return badRequest("username must be between 3 and 30 characters", origin);
        }
        if (!/^[a-zA-Z0-9_]+$/.test(targetUsername)) {
          return badRequest("username can only contain letters, numbers, and underscores", origin);
        }
        const { data: match, error: lookupErr } = await getAdminClient()
          .from("profiles")
          .select("id")
          .eq("username", targetUsername)
          .maybeSingle();
        if (lookupErr) throw lookupErr;
        if (!match) return notFound("Profile", origin);
        userId = match.id;
      } else if (requestingUser) {
        userId = requestingUser.id;
      } else {
        return badRequest("user_id or username parameter required for unauthenticated requests", origin);
      }

      const isOwnProfile = requestingUser?.id === userId;

      const { data: profile, error: profErr } = await db
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profErr) throw profErr;
      if (!profile) return notFound("Profile", origin);

      // Compute viewer ↔ target friendship state. `are_friends` and friends
      // lookup use the admin client because RLS only lets participants see
      // friendship rows, and we don't want to fail here when the viewer is
      // not yet a friend.
      let friendStatus: "none" | "pending_incoming" | "pending_outgoing" | "accepted" | "blocked" = "none";
      if (requestingUser && !isOwnProfile) {
        const adminDb = getAdminClient();
        const [a, b] = requestingUser.id < userId
          ? [requestingUser.id, userId]
          : [userId, requestingUser.id];

        const { data: fr } = await adminDb
          .from("friendships")
          .select("id, status, requested_by")
          .eq("user_a_id", a)
          .eq("user_b_id", b)
          .maybeSingle();

        if (fr) {
          if (fr.status === "accepted") friendStatus = "accepted";
          else if (fr.status === "blocked") friendStatus = "blocked";
          else if (fr.status === "pending") {
            friendStatus = fr.requested_by === requestingUser.id
              ? "pending_outgoing"
              : "pending_incoming";
          }
        }
      }

      // Enforce privacy — private profiles are visible to accepted friends only.
      const isAcceptedFriend = friendStatus === "accepted";
      if (!profile.is_public && !isOwnProfile && !isAcceptedFriend) {
        return forbidden(origin);
      }

      // Get watch stats
      const { data: stats } = await (isOwnProfile ? db : getAdminClient())
        .from("user_watch_stats")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // If own profile, include settings
      let settings = null;
      if (isOwnProfile) {
        const { data: userSettings } = await db
          .from("user_settings")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        settings = userSettings;
      }

      return new Response(
        JSON.stringify({
          profile,
          stats: stats ?? null,
          settings,
          friend_status: isOwnProfile ? null : friendStatus,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        },
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH — update own profile
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      const { user, error: authErr } = await getAuthUser(req, origin);
      if (authErr) return authErr;
      const db = getUserClient(req);

      const body = await req.json().catch(() => null);
      if (!body) return badRequest("Request body must be valid JSON", origin);

      try {
        const updates: Record<string, unknown> = {};

        if (body.username !== undefined) {
          const username = validateString(body.username, "username", {
            minLength: 3,
            maxLength: 30,
          });
          if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
            return badRequest("username can only contain letters, numbers, and underscores", origin);
          }
          updates.username = username;
        }

        if (body.display_name !== undefined) {
          updates.display_name = validateString(body.display_name, "display_name", { maxLength: 100 });
        }

        if (body.bio !== undefined) {
          updates.bio = body.bio === null
            ? null
            : validateString(body.bio, "bio", { maxLength: 500 });
        }

        if (body.website !== undefined) {
          if (body.website !== null) {
            const site = validateString(body.website, "website", { maxLength: 200 });
            // Basic URL validation
            if (site && !site.startsWith("http://") && !site.startsWith("https://")) {
              return badRequest("website must be a valid URL starting with http:// or https://", origin);
            }
            updates.website = site;
          } else {
            updates.website = null;
          }
        }

        if (body.location !== undefined) {
          updates.location = body.location === null
            ? null
            : validateString(body.location, "location", { maxLength: 100 });
        }

        if (body.is_public !== undefined) {
          updates.is_public = Boolean(body.is_public);
        }

        if (Object.keys(updates).length === 0) {
          return badRequest("No valid fields to update", origin);
        }

        const { data, error } = await db
          .from("profiles")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();

        if (error) {
          // Handle unique constraint violation on username
          if (error.code === "23505") {
            return badRequest("Username is already taken", origin);
          }
          throw error;
        }

        log.info("updated profile", { user_id: user.id });

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
    // POST — avatar upload
    // ─────────────────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const { user, error: authErr } = await getAuthUser(req, origin);
      if (authErr) return authErr;
      const db = getUserClient(req);

      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.includes("multipart/form-data")) {
        return badRequest("Avatar upload requires multipart/form-data", origin);
      }

      const formData = await req.formData().catch(() => null);
      if (!formData) return badRequest("Failed to parse form data", origin);

      const file = formData.get("avatar") as File | null;
      if (!file) return badRequest("avatar field is required", origin);

      // Validate file
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return badRequest(`File type must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`, origin);
      }

      if (file.size > AVATAR_MAX_SIZE) {
        return badRequest("Avatar file must be under 5MB", origin);
      }

      // Generate unique path: {user_id}/{timestamp}.{ext}
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();

      // Use user-scoped client (RLS allows upload to own folder)
      const { error: uploadErr } = await db.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadErr) {
        log.error("avatar upload failed", { err: uploadErr.message });
        throw uploadErr;
      }

      // Get public URL
      const { data: { publicUrl } } = db.storage.from("avatars").getPublicUrl(filePath);

      // Update profile
      const { data, error: updateErr } = await db
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id)
        .select("id, avatar_url")
        .single();

      if (updateErr) throw updateErr;

      log.info("avatar uploaded", { user_id: user.id, path: filePath });

      return new Response(JSON.stringify(data), {
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
