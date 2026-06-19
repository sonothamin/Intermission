// =============================================================================
// _shared/logger.ts — Structured JSON logger
// =============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  function: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const isDev = Deno.env.get("SUPABASE_ENV") === "local";

function log(level: LogLevel, fnName: string, message: string, meta?: Record<string, unknown>) {
  // In dev, pretty print; in prod, structured JSON
  const entry: LogEntry = {
    level,
    function: fnName,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else if (isDev && level === "debug") {
    console.debug(output);
  } else {
    console.log(output);
  }
}

export function createLogger(functionName: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      log("debug", functionName, message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      log("info", functionName, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      log("warn", functionName, message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      log("error", functionName, message, meta),
  };
}
