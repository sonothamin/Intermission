// =============================================================================
// _shared/errors.ts — Standardized error responses
// =============================================================================

import { corsHeaders } from "./cors.ts";

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export function errorResponse(
  message: string,
  status: number,
  code: string,
  requestOrigin: string | null = null,
  details?: unknown,
): Response {
  const body: ApiError = { error: message, code };
  if (details !== undefined) body.details = details;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(requestOrigin),
    },
  });
}

// Convenience helpers
export const badRequest = (msg: string, origin: string | null, details?: unknown) =>
  errorResponse(msg, 400, "BAD_REQUEST", origin, details);

export const unauthorized = (origin: string | null) =>
  errorResponse("Authentication required", 401, "UNAUTHORIZED", origin);

export const forbidden = (origin: string | null) =>
  errorResponse("Access denied", 403, "FORBIDDEN", origin);

export const notFound = (resource: string, origin: string | null) =>
  errorResponse(`${resource} not found`, 404, "NOT_FOUND", origin);

export const conflict = (msg: string, origin: string | null) =>
  errorResponse(msg, 409, "CONFLICT", origin);

export const tooManyRequests = (origin: string | null) =>
  errorResponse("Rate limit exceeded", 429, "RATE_LIMITED", origin);

export const internalError = (origin: string | null, err?: unknown) => {
  console.error("[internal_error]", err);
  return errorResponse("Internal server error", 500, "INTERNAL_ERROR", origin);
};

export const methodNotAllowed = (origin: string | null) =>
  errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED", origin);
