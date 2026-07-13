import { readDb } from "@/lib/server/data-store";
import { reportServerError } from "@/lib/server/monitoring";

export async function checkApplicationHealth(readinessCheck: () => Promise<unknown> = readDb) {
  try {
    await readinessCheck();
    return { ok: true as const, status: "healthy" as const, checks: { database: "ok" as const } };
  } catch (error) {
    reportServerError(error, { operation: "health_check", dependency: "database" });
    return { ok: false as const, status: "unhealthy" as const, checks: { database: "unavailable" as const } };
  }
}

/** Public liveness/readiness endpoint for uptime monitors. Deliberately exposes no tenant data. */
export async function GET() {
  const health = await checkApplicationHealth();
  if (health.ok) {
    return Response.json({ ...health, timestamp: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json(health, { status: 503, headers: { "Cache-Control": "no-store" } });
}
