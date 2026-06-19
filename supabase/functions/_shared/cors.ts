// =============================================================================
// _shared/cors.ts — CORS configuration
// =============================================================================

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// In development, allow localhost; in prod, require explicit ALLOWED_ORIGINS
const isDev = Deno.env.get("SUPABASE_ENV") === "local";

export function getAllowedOrigin(requestOrigin: string | null): string {
  return requestOrigin || "*";
}

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = getAllowedOrigin(requestOrigin);
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, X-Client-Info, Content-Type, X-Request-ID, Accept, apikey",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}

/** Handle OPTIONS preflight — call at the top of every function */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get("origin")),
    });
  }
  return null;
}
