// =============================================================================
// _shared/db.ts — Supabase client factories
// =============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Creates a user-scoped Supabase client.
 * RLS policies apply — user can only access their own data.
 * Use for all user-initiated operations.
 */
export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates a service-role Supabase client.
 * Bypasses RLS — use ONLY for:
 *   - Writing to media_cache
 *   - Reading data for analytics aggregations
 *   - Admin operations
 * NEVER expose this client's token to the client-side.
 */
export function getAdminClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
