// =============================================================================
// _shared/validate.ts — Input validation helpers
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate that required query params are present and non-empty */
export function requireParams(
  params: URLSearchParams,
  required: string[],
): ValidationResult {
  const errors: string[] = [];
  for (const key of required) {
    const val = params.get(key);
    if (val === null || val.trim() === "") {
      errors.push(`Missing required parameter: ${key}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Parse and validate a positive integer param */
export function parseIntParam(
  params: URLSearchParams,
  key: string,
  opts: { min?: number; max?: number; required?: boolean } = {},
): { value: number | null; error: string | null } {
  const raw = params.get(key);
  if (raw === null || raw === "") {
    if (opts.required) return { value: null, error: `Missing required parameter: ${key}` };
    return { value: null, error: null };
  }

  const n = parseInt(raw, 10);
  if (isNaN(n)) return { value: null, error: `Invalid integer for parameter: ${key}` };
  if (opts.min !== undefined && n < opts.min) {
    return { value: null, error: `${key} must be >= ${opts.min}` };
  }
  if (opts.max !== undefined && n > opts.max) {
    return { value: null, error: `${key} must be <= ${opts.max}` };
  }
  return { value: n, error: null };
}

/** Validate and sanitize string length */
export function validateString(
  value: unknown,
  name: string,
  opts: { minLength?: number; maxLength?: number; required?: boolean } = {},
): string | null {
  if (value === undefined || value === null) {
    if (opts.required) throw new ValidationError(`${name} is required`);
    return null;
  }
  if (typeof value !== "string") throw new ValidationError(`${name} must be a string`);
  const trimmed = value.trim();
  if (opts.required && trimmed.length === 0) throw new ValidationError(`${name} cannot be empty`);
  if (opts.minLength && trimmed.length < opts.minLength) {
    throw new ValidationError(`${name} must be at least ${opts.minLength} characters`);
  }
  if (opts.maxLength && trimmed.length > opts.maxLength) {
    throw new ValidationError(`${name} must be at most ${opts.maxLength} characters`);
  }
  return trimmed;
}

/** Validate rating value (0-10, 1 decimal) */
export function validateRating(value: unknown, name = "rating"): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (isNaN(n)) throw new ValidationError(`${name} must be a number`);
  if (n < 0 || n > 10) throw new ValidationError(`${name} must be between 0 and 10`);
  return Math.round(n * 10) / 10;
}

/** Validate enum value */
export function validateEnum<T extends string>(
  value: unknown,
  name: string,
  allowed: T[],
  required = false,
): T | null {
  if (value === undefined || value === null) {
    if (required) throw new ValidationError(`${name} is required`);
    return null;
  }
  if (!allowed.includes(value as T)) {
    throw new ValidationError(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Validate TMDB ID (positive integer) */
export function validateTmdbId(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError("Invalid TMDB ID");
  }
  return n;
}

/** Validate media type */
export function validateMediaType(value: unknown, required = true): "movie" | "tv" | null {
  return validateEnum(value, "media_type", ["movie", "tv"], required) as "movie" | "tv" | null;
}

/** Sanitize text to prevent XSS (strip HTML tags) */
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
