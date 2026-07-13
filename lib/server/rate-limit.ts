import crypto from "node:crypto";
import { incrementSharedCounter } from "@/lib/server/data-store";

type LimitOptions = { limit: number; windowMs: number };
type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function subjectKey(subject?: string) {
  if (!subject) return "";
  return `:${crypto.createHash("sha256").update(subject.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
}

/** Uses Redis when configured and falls back to a per-instance guard. */
export async function enforceRateLimit(request: Request, action: string, options: LimitOptions, subject?: string) {
  const now = Date.now();
  const key = `${action}:${clientKey(request)}${subjectKey(subject)}`;
  try {
    const sharedCount = await incrementSharedCounter(`kasirkita:rate-limit:${key}`, Math.ceil(options.windowMs / 1000));
    if (sharedCount !== null) return { allowed: sharedCount <= options.limit, remaining: Math.max(0, options.limit - sharedCount) };
  } catch {
    // A limiter outage must not become an availability outage; the local guard below remains active.
  }
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1 };
  }
  current.count += 1;
  return { allowed: current.count <= options.limit, remaining: Math.max(0, options.limit - current.count) };
}
