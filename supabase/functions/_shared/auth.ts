// =============================================================================
// _shared/auth.ts — JWT validation and user extraction
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unauthorized } from "./errors.ts";

export interface AuthUser {
  id: string;
  email: string | undefined;
  role: string;
}

/**
 * Extracts and validates the Bearer JWT from the Authorization header.
 * Returns the authenticated user or null if invalid/missing.
 */
export async function requireAuth(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Use a user-scoped client to validate the token
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role ?? "authenticated",
  };
}

/**
 * Returns an unauthorized response if no valid auth — use at the top of
 * protected functions.
 */
export async function getAuthUser(
  req: Request,
  origin: string | null,
): Promise<{ user: AuthUser; error: null } | { user: null; error: Response }> {
  const user = await requireAuth(req);
  if (!user) {
    return { user: null, error: unauthorized(origin) };
  }
  return { user, error: null };
}

/** Try to get the auth user but don't fail — for optional auth endpoints */
export async function tryGetAuthUser(req: Request): Promise<AuthUser | null> {
  return await requireAuth(req);
}
