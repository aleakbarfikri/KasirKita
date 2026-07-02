import { cookies } from "next/headers";
import { createId } from "@/lib/server/ids";
import { createSignedSessionToken, isAdminProfileActive, now, publicUser, readDb, verifyPassword, verifySignedSessionToken, writeDb } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";

const COOKIE_NAME = "kasirkita_session";
const SESSION_DAYS = 7;

type Params = { params: { all?: string[] } };

function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function POST(request: Request, { params }: Params) {
  const action = (params.all || []).join("/");

  if (action === "sign-in/username") {
    const body = await readJson(request) as { username?: string; password?: string };
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) return fail("Username dan password wajib diisi.", 422);

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
    const token = createSignedSessionToken(user.id, expiresAt);
    const session = {
      id: createId("sess"),
      token,
      userId: user.id,
      expiresAt,
      createdAt: t,
      updatedAt: t,
    };
    // Store a copy for local development, but auth also works statelessly from the signed cookie.
    db.sessions = db.sessions.filter((row) => new Date(row.expiresAt).getTime() > Date.now());
    db.sessions.push(session);
    await writeDb(db);
    setSessionCookie(token);

    return ok({ user: publicUser(user), session });
  }

  if (action === "sign-out") {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (token) {
      const db = await readDb();
      db.sessions = db.sessions.filter((row) => row.token !== token);
      await writeDb(db);
    }
    clearSessionCookie();
    return ok({ signedOut: true });
  }

  return fail("Auth route not found", 404);
}

export async function GET(_request: Request, { params }: Params) {
  const action = (params.all || []).join("/");
  if (action === "get-session") {
    const token = cookies().get(COOKIE_NAME)?.value;
    if (!token) return Response.json(null);
    const db = await readDb();
    const signed = verifySignedSessionToken(token);
    if (signed) {
      const user = db.users.find((row) => row.id === signed.userId);
      if (!user) return Response.json(null);
      return Response.json({
        session: { token, userId: signed.userId, expiresAt: signed.expiresAt },
        user: publicUser(user),
      });
    }

    const session = db.sessions.find((row) => row.token === token && new Date(row.expiresAt).getTime() > Date.now());
    if (!session) return Response.json(null);
    const user = db.users.find((row) => row.id === session.userId);
    if (!user) return Response.json(null);
    return Response.json({ session, user: publicUser(user) });
  }
  return fail("Auth route not found", 404);
}
