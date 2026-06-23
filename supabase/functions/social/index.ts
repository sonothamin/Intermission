// =============================================================================
// social/index.ts — Friends / social graph
//
// GET    ?action=friends                     → list accepted friends w/ profile
// GET    ?action=requests&type=incoming      → incoming pending requests
// GET    ?action=requests&type=outgoing      → outgoing pending requests
// GET    ?action=search&q=<query>            → public profile search
// POST   ?action=request   { user_id | username }   → send a friend request
// POST   ?action=respond   { friendship_id, accept: bool }  → accept/decline
// DELETE ?action=request   ?id=<friendship_id>     → cancel outgoing request
// DELETE ?action=friend    ?id=<user_id>           → unfriend accepted pair
// =============================================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import {
  badRequest,
  forbidden,
  notFound,
  conflict,
  methodNotAllowed,
  internalError,
} from "../_shared/errors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/db.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("social");

// Normalize a (a, b) pair so a < b — used to satisfy the `friendships_pair_order`
// CHECK constraint defined in the friends migration.
function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function json(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// Shape we return for each friend/request row.
type FriendRow = {
  friendship_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  requested_by: string;
  created_at: string;
  responded_at: string | null;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

const PROFILE_SELECT =
  "id, username, display_name, avatar_url, is_public, bio, location, website";

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
    // ── GET ?action=friends ────────────────────────────────────────────────
    if (req.method === "GET" && action === "friends") {
      return await listFriends(db, user.id, origin);
    }

    // ── GET ?action=requests&type=incoming|outgoing ────────────────────────
    if (req.method === "GET" && action === "requests") {
      const type = url.searchParams.get("type") ?? "incoming";
      if (type !== "incoming" && type !== "outgoing") {
        return badRequest("type must be 'incoming' or 'outgoing'", origin);
      }
      return await listRequests(db, user.id, type, origin);
    }

    // ── GET ?action=search&q=… ─────────────────────────────────────────────
    if (req.method === "GET" && action === "search") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (q.length < 2) return badRequest("q must be at least 2 characters", origin);
      return await searchUsers(db, user.id, q, origin);
    }

    // ── POST ?action=request { user_id | username } ────────────────────────
    if (req.method === "POST" && action === "request") {
      return await sendRequest(db, user.id, req, origin);
    }

    // ── POST ?action=respond { friendship_id, accept } ──────────────────────
    if (req.method === "POST" && action === "respond") {
      return await respondRequest(db, user.id, req, origin);
    }

    // ── DELETE ?action=request?id=<friendship_id> ───────────────────────────
    if (req.method === "DELETE" && action === "request") {
      const id = url.searchParams.get("id");
      if (!id) return badRequest("id is required", origin);
      return await cancelRequest(db, user.id, id, origin);
    }

    // ── DELETE ?action=friend?id=<user_id> ──────────────────────────────────
    if (req.method === "DELETE" && action === "friend") {
      const id = url.searchParams.get("id");
      if (!id) return badRequest("id is required", origin);
      return await unfriend(db, user.id, id, origin);
    }

    return methodNotAllowed(origin);
  } catch (err) {
    log.error("unhandled error", { err: String(err) });
    return internalError(origin, err);
  }
});

// =============================================================================
// Handlers
// =============================================================================

async function listFriends(db: ReturnType<typeof getUserClient>, userId: string, origin: string | null) {
  // Friendships where I'm either a or b. We pull the *other* side's profile in
  // a single round-trip via PostgREST embedding.
  const { data, error } = await db
    .from("friendships")
    .select(
      `id, status, requested_by, created_at, responded_at,
       user_a:profiles!friendships_user_a_id_fkey (${PROFILE_SELECT}),
       user_b:profiles!friendships_user_b_id_fkey (${PROFILE_SELECT})`,
    )
    .eq("status", "accepted")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (error) {
    log.error("listFriends failed", { error: error.message });
    return internalError(origin, error);
  }

  const friends: FriendRow[] = (data ?? []).map((row: any) => {
    const other = row.user_a?.id === userId ? row.user_b : row.user_a;
    return {
      friendship_id: row.id,
      status: row.status,
      requested_by: row.requested_by,
      created_at: row.created_at,
      responded_at: row.responded_at,
      user: {
        id: other.id,
        username: other.username,
        display_name: other.display_name,
        avatar_url: other.avatar_url,
      },
    };
  });

  return json({ friends }, origin);
}

async function listRequests(
  db: ReturnType<typeof getUserClient>,
  userId: string,
  type: "incoming" | "outgoing",
  origin: string | null,
) {
  // For both: we want pending rows where I'm a participant.
  //   incoming → requested_by != me
  //   outgoing → requested_by = me
  const { data, error } = await db
    .from("friendships")
    .select(
      `id, status, requested_by, created_at, responded_at,
       user_a:profiles!friendships_user_a_id_fkey (${PROFILE_SELECT}),
       user_b:profiles!friendships_user_b_id_fkey (${PROFILE_SELECT})`,
    )
    .eq("status", "pending")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (error) {
    log.error("listRequests failed", { error: error.message });
    return internalError(origin, error);
  }

  const requests: FriendRow[] = (data ?? [])
    .filter((row: any) =>
      type === "incoming" ? row.requested_by !== userId : row.requested_by === userId,
    )
    .map((row: any) => {
      const other = row.user_a?.id === userId ? row.user_b : row.user_a;
      return {
        friendship_id: row.id,
        status: row.status,
        requested_by: row.requested_by,
        created_at: row.created_at,
        responded_at: row.responded_at,
        user: {
          id: other.id,
          username: other.username,
          display_name: other.display_name,
          avatar_url: other.avatar_url,
        },
      };
    });

  return json({ requests }, origin);
}

async function searchUsers(
  db: ReturnType<typeof getUserClient>,
  viewerId: string,
  q: string,
  origin: string | null,
) {
  // Public-only search, exclude self, case-insensitive ilike on username/display_name.
  // PostgREST's `or` lets us search both columns in one call.
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const { data, error } = await db
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("is_public", true)
    .neq("id", viewerId)
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .limit(20);

  if (error) {
    log.error("searchUsers failed", { error: error.message });
    return internalError(origin, error);
  }

  return json({ users: data ?? [] }, origin);
}

async function sendRequest(
  db: ReturnType<typeof getUserClient>,
  userId: string,
  req: Request,
  origin: string | null,
) {
  let body: { user_id?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body", origin);
  }

  let targetId: string | null = body.user_id ?? null;

  if (!targetId && body.username) {
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .eq("username", body.username)
      .maybeSingle();
    if (error) {
      log.error("sendRequest: username lookup failed", { error: error.message });
      return internalError(origin, error);
    }
    if (!data) return notFound("User", origin);
    targetId = data.id;
  }

  if (!targetId) return badRequest("user_id or username is required", origin);
  if (targetId === userId) return badRequest("You cannot friend yourself", origin);

  const [a, b] = normalizePair(userId, targetId);

  // Check for an existing friendship in either direction (any status) so we
  // surface a clean conflict rather than a constraint violation.
  const { data: existing, error: existErr } = await db
    .from("friendships")
    .select("id, status, requested_by")
    .eq("user_a_id", a)
    .eq("user_b_id", b)
    .maybeSingle();

  if (existErr) {
    log.error("sendRequest: existing check failed", { error: existErr.message });
    return internalError(origin, existErr);
  }

  if (existing) {
    if (existing.status === "accepted") return conflict("You are already friends", origin);
    if (existing.status === "pending") return conflict("A friend request already exists", origin);
    if (existing.status === "blocked") return conflict("Cannot send a request to this user", origin);
    // 'declined' → fall through and re-insert as a new pending request.
  }

  if (existing && existing.status === "declined") {
    // Re-open as a new pending request from the current user.
    const { data: updated, error: updErr } = await db
      .from("friendships")
      .update({
        status: "pending",
        requested_by: userId,
        responded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, status, requested_by, created_at, responded_at")
      .single();

    if (updErr) {
      log.error("sendRequest: re-open failed", { error: updErr.message });
      return internalError(origin, updErr);
    }
    return json({ friendship: updated }, origin, 201);
  }

  const { data: created, error: insErr } = await db
    .from("friendships")
    .insert({
      user_a_id: a,
      user_b_id: b,
      status: "pending",
      requested_by: userId,
    })
    .select("id, status, requested_by, created_at, responded_at")
    .single();

  if (insErr) {
    // 23505 = unique_violation
    if (insErr.code === "23505") return conflict("A friend request already exists", origin);
    log.error("sendRequest: insert failed", { error: insErr.message });
    return internalError(origin, insErr);
  }

  return json({ friendship: created }, origin, 201);
}

async function respondRequest(
  db: ReturnType<typeof getUserClient>,
  userId: string,
  req: Request,
  origin: string | null,
) {
  let body: { friendship_id?: string; accept?: boolean };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body", origin);
  }

  if (!body.friendship_id || typeof body.accept !== "boolean") {
    return badRequest("friendship_id and accept are required", origin);
  }

  const { data: row, error: fetchErr } = await db
    .from("friendships")
    .select("id, status, requested_by, user_a_id, user_b_id")
    .eq("id", body.friendship_id)
    .maybeSingle();

  if (fetchErr) {
    log.error("respondRequest: fetch failed", { error: fetchErr.message });
    return internalError(origin, fetchErr);
  }
  if (!row) return notFound("Friend request", origin);

  if (row.user_a_id !== userId && row.user_b_id !== userId) return forbidden(origin);
  if (row.status !== "pending") return conflict("Friend request is no longer pending", origin);
  if (row.requested_by === userId) {
    return badRequest("You cannot respond to your own request", origin);
  }

  const newStatus: "accepted" | "declined" = body.accept ? "accepted" : "declined";
  const now = new Date().toISOString();

  const { data: updated, error: updErr } = await db
    .from("friendships")
    .update({ status: newStatus, responded_at: now, updated_at: now })
    .eq("id", body.friendship_id)
    .select("id, status, requested_by, user_a_id, user_b_id, responded_at")
    .single();

  if (updErr) {
    log.error("respondRequest: update failed", { error: updErr.message });
    return internalError(origin, updErr);
  }

  return json({ friendship: updated }, origin);
}

async function cancelRequest(
  db: ReturnType<typeof getUserClient>,
  userId: string,
  friendshipId: string,
  origin: string | null,
) {
  const { data: row, error: fetchErr } = await db
    .from("friendships")
    .select("id, status, requested_by, user_a_id, user_b_id")
    .eq("id", friendshipId)
    .maybeSingle();

  if (fetchErr) {
    log.error("cancelRequest: fetch failed", { error: fetchErr.message });
    return internalError(origin, fetchErr);
  }
  if (!row) return notFound("Friend request", origin);
  if (row.user_a_id !== userId && row.user_b_id !== userId) return forbidden(origin);
  if (row.status !== "pending") return conflict("Only pending requests can be cancelled", origin);
  if (row.requested_by !== userId) {
    return badRequest("Only the requester can cancel a request", origin);
  }

  const { error: delErr } = await db.from("friendships").delete().eq("id", friendshipId);
  if (delErr) {
    log.error("cancelRequest: delete failed", { error: delErr.message });
    return internalError(origin, delErr);
  }

  return json({ success: true }, origin);
}

async function unfriend(
  db: ReturnType<typeof getUserClient>,
  userId: string,
  otherUserId: string,
  origin: string | null,
) {
  const [a, b] = normalizePair(userId, otherUserId);

  const { data: row, error: fetchErr } = await db
    .from("friendships")
    .select("id, status, user_a_id, user_b_id")
    .eq("user_a_id", a)
    .eq("user_b_id", b)
    .maybeSingle();

  if (fetchErr) {
    log.error("unfriend: fetch failed", { error: fetchErr.message });
    return internalError(origin, fetchErr);
  }
  if (!row) return notFound("Friendship", origin);
  if (row.status !== "accepted") return conflict("You are not friends with this user", origin);

  const { error: delErr } = await db.from("friendships").delete().eq("id", row.id);
  if (delErr) {
    log.error("unfriend: delete failed", { error: delErr.message });
    return internalError(origin, delErr);
  }

  return json({ success: true }, origin);
}
