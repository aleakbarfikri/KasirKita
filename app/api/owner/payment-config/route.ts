import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { paymentConfigSchema } from "@/lib/server/validators";
import { now, readDb, writeDb, type PaymentConfig } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireOwner();
    const config = (await readDb()).paymentConfigs.find((row) => row.ownerId === session.user.id) || null;
    return ok(config);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireOwner();
    const body = paymentConfigSchema.parse(await readJson(request));
    const db = await readDb();
    let config = db.paymentConfigs.find((row) => row.ownerId === session.user.id);
    const t = now();
    if (!config) {
      config = { id: createId("paycfg"), ownerId: session.user.id, pakasirSlug: body.pakasirSlug || null, pakasirApiKey: body.pakasirApiKey || null, createdAt: t, updatedAt: t } satisfies PaymentConfig;
      db.paymentConfigs.push(config);
    } else {
      config.pakasirSlug = body.pakasirSlug || null;
      config.pakasirApiKey = body.pakasirApiKey || null;
      config.updatedAt = t;
    }
    await writeDb(db);
    return ok(config);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid payment config payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
