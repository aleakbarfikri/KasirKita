import { checkSharedSecurityStore, readDb } from "@/lib/server/data-store";
import { reportServerError } from "@/lib/server/monitoring";

export async function checkApplicationHealth(
  readinessCheck: () => Promise<unknown> = readDb,
  securityStoreCheck?: () => Promise<"ok" | "not_configured">,
) {
  try {
    await readinessCheck();
    const securityStore = securityStoreCheck ? await securityStoreCheck() : undefined;
    if (securityStore === "not_configured" && process.env.NODE_ENV === "production") {
      throw new Error("Shared security store is not configured.");
    }
    return {
      ok: true as const,
      status: "healthy" as const,
      checks: { database: "ok" as const, ...(securityStore ? { securityStore } : {}) },
    };
  } catch (error) {
    reportServerError(error, { operation: "health_check" });
    return { ok: false as const, status: "unhealthy" as const, checks: { dependencies: "unavailable" as const } };
  }
}

/** Public liveness/readiness endpoint for uptime monitors. Deliberately exposes no tenant data. */
export async function GET() {
  const health = await checkApplicationHealth(readDb, checkSharedSecurityStore);
  if (health.ok) {
    return Response.json({ ...health, timestamp: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json(health, { status: 503, headers: { "Cache-Control": "no-store" } });
}
