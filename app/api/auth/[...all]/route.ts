import { cookies } from "next/headers";
import { createId } from "@/lib/server/ids";
import { createSignedSessionToken, isAdminProfileActive, now, publicUser, readDb, sessionTokenHash, verifyPassword, verifySignedSessionToken, writeDb } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const COOKIE_NAME = "kasirkita_session";
const SESSION_DAYS = 7;

type Params = { params: Promise<{ all?: string[] }> };

async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function POST(request: Request, props: Params) {
  const params = await props.params;
  const action = (params.all || []).join("/");

  if (action === "sign-in/username") {
    const ipLimit = await enforceRateLimit(request, "auth:sign-in:ip", { limit: 30, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed) return fail("Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.", 429);
    const body = await readJson(request) as { username?: string; password?: string };
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) return fail("Username dan password wajib diisi.", 422);
    const accountLimit = await enforceRateLimit(request, "auth:sign-in:account", { limit: 8, windowMs: 15 * 60 * 1000 }, username);
    if (!accountLimit.allowed) return fail("Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.", 429);

    const db = await readDb();
    const user = db.users.find((row) => row.username.toLowerCase() === username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail("Username atau password salah.", 401);
    }
    if (user.role === "admin") {
      const profile = db.adminProfiles.find((row) => row.userId === user.id);
      if (!profile || !isAdminProfileActive(profile)) {
        return fail("Akun admin sedang nonaktif atau masa aktif subscription sudah habis. Minta owner mengaktifkan/perpanjang akun terlebih dahulu.", 403);
      }
    }
    if (user.role === "cashier") {
      const profile = db.cashierProfiles.find((row) => row.userId === user.id);
      if (!profile || !profile.isActive || profile.approvalStatus !== "approved") {
        return fail("Akun kasir belum aktif. Minta owner melakukan approval terlebih dahulu.", 403);
      }
      const adminProfile = db.adminProfiles.find((row) => row.userId === profile.adminId);
      if (!adminProfile || !isAdminProfileActive(adminProfile)) {
        return fail("Akun kasir ikut nonaktif karena admin/UMKM induk sedang nonaktif atau subscription sudah habis.", 403);
      }
    }

    const t = now();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = createId("sess");
    const token = createSignedSessionToken(user.id, sessionId, expiresAt);
    db.sessions = db.sessions.filter((row) => new Date(row.expiresAt).getTime() > Date.now());
    db.sessions.push({ id: sessionId, token: sessionTokenHash(token), userId: user.id, expiresAt, createdAt: t, updatedAt: t });
    await writeDb(db);
    await setSessionCookie(token);

    return ok({ user: publicUser(user), session: { id: sessionId, userId: user.id, expiresAt } });
  }

  if (action === "sign-out") {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    const signed = token ? verifySignedSessionToken(token) : null;
    if (signed) {
      const db = await readDb();
      db.sessions = db.sessions.filter((row) => row.id !== signed.sessionId);
      await writeDb(db);
    }
    await clearSessionCookie();
    return ok({ signedOut: true });
  }

  return fail("Auth route not found", 404);
}

export async function GET(_request: Request, props: Params) {
  const params = await props.params;
  const action = (params.all || []).join("/");
  if (action === "get-session") {
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return Response.json(null);
    const db = await readDb();
    const signed = verifySignedSessionToken(token);
    if (signed) {
      const session = db.sessions.find((row) => row.id === signed.sessionId && row.userId === signed.userId && row.token === sessionTokenHash(token) && new Date(row.expiresAt).getTime() > Date.now());
      if (!session) return Response.json(null);
      const user = db.users.find((row) => row.id === signed.userId);
      if (!user) return Response.json(null);
      return Response.json({
        session: { id: session.id, userId: session.userId, expiresAt: session.expiresAt },
        user: publicUser(user),
      });
    }
    return Response.json(null);
  }
  return fail("Auth route not found", 404);
}
