import crypto from "node:crypto";
import { incrementSharedCounter } from "@/lib/server/data-store";

type LimitOptions = { limit: number; windowMs: number; requireShared?: boolean };
type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip") || forwarded || request.headers.get("x-real-ip") || "unknown";
}

function subjectKey(subject?: string) {
  if (!subject) return "";
  return `:${crypto.createHash("sha256").update(subject.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
}

/** Uses Redis when configured and falls back to a per-instance guard. */
export async function enforceRateLimit(request: Request, action: string, options: LimitOptions, subject?: string) {
  const now = Date.now();
  // Account/user limits must remain stable when an attacker changes IP.
  // IP-only limits keep using the client address when no subject is supplied.
  const key = subject ? `${action}${subjectKey(subject)}` : `${action}:${getClientIp(request)}`;
  try {
    const sharedCount = await incrementSharedCounter(`kasirkita:rate-limit:${key}`, Math.ceil(options.windowMs / 1000));
    if (sharedCount !== null) return { allowed: sharedCount <= options.limit, remaining: Math.max(0, options.limit - sharedCount) };
  } catch {
    if (options.requireShared) return { allowed: false, remaining: 0, unavailable: true as const };
  }
  if (options.requireShared) return { allowed: false, remaining: 0, unavailable: true as const };
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1 };
  }
  current.count += 1;
  return { allowed: current.count <= options.limit, remaining: Math.max(0, options.limit - current.count) };
}
