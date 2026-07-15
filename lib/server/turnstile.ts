import { getClientIp } from "@/lib/server/rate-limit";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;

type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export async function verifyTurnstile(
  request: Request,
  token: string,
  expectedAction: string,
  fetcher: typeof fetch = fetch,
) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) throw Object.assign(new Error("Verifikasi keamanan checkout belum dikonfigurasi."), { status: 503 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetcher(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: getClientIp(request) }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw Object.assign(new Error("Layanan verifikasi keamanan sedang tidak tersedia."), { status: 503 });
    const result = await response.json() as TurnstileResult;
    const allowedHosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (process.env.NODE_ENV === "production" && allowedHosts.length === 0) {
      throw Object.assign(new Error("Hostname Turnstile production belum dikonfigurasi."), { status: 503 });
    }
    const hostnameAllowed = allowedHosts.length === 0 || Boolean(result.hostname && allowedHosts.includes(result.hostname.toLowerCase()));
    if (!result.success || result.action !== expectedAction || !hostnameAllowed) {
      throw Object.assign(new Error("Verifikasi keamanan gagal. Silakan ulangi verifikasi."), { status: 403 });
    }
    return true;
  } catch (error) {
    if (typeof (error as { status?: unknown })?.status === "number") throw error;
    throw Object.assign(new Error("Layanan verifikasi keamanan sedang tidak tersedia."), { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
