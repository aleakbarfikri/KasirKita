const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|recovery|otp|verification|session)/i;

function sanitizeText(value: string) {
  return value
    .replace(/(bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:password|secret|token|api[-_]?key|authorization|cookie)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(\w+:\/\/[^/:\s]+:)[^@\s]+@/g, "$1[REDACTED]@");
}

function sanitizeValue(value: unknown, key = "", seen = new WeakSet<object>()): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    const sanitized = sanitizeText(value);
    return sanitized.length > 500 ? `${sanitized.slice(0, 500)}…` : sanitized;
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, key, seen));
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey, seen)]));
}

export function buildServerErrorLog(error: unknown, context: Record<string, unknown> = {}) {
  const cause = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown server error");
  return {
    level: "error",
    event: "server_error",
    timestamp: new Date().toISOString(),
    error: {
      name: cause.name,
      message: sanitizeText(cause.message),
      ...(process.env.NODE_ENV !== "production" && cause.stack ? { stack: sanitizeText(cause.stack) } : {}),
    },
    context: sanitizeValue(context),
  };
}

/** Emits structured, redacted JSON that is retained by the deployment log provider. */
export function reportServerError(error: unknown, context: Record<string, unknown> = {}) {
  console.error(JSON.stringify(buildServerErrorLog(error, context)));
}
