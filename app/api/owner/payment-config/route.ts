import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { paymentConfigSchema } from "@/lib/server/validators";
import { now, withDbTransaction, type PaymentConfig } from "@/lib/server/data-store";
import { protectPaymentConfig, publicPaymentConfig } from "@/lib/server/payment-secrets";
import { encryptSecret } from "@/lib/server/secrets";

export async function GET() {
  try {
    const session = await requireOwner();
    const config = await withDbTransaction((db) => {
      const current = db.paymentConfigs.find((row) => row.ownerId === session.user.id) || null;
      if (current) protectPaymentConfig(current);
      return publicPaymentConfig(current);
    });
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
    const result = await withDbTransaction((db) => {
      let config = db.paymentConfigs.find((row) => row.ownerId === session.user.id);
      const t = now();
      if (!config) {
        config = {
          id: createId("paycfg"),
          ownerId: session.user.id,
          pakasirSlug: body.pakasirSlug || null,
          pakasirApiKey: encryptSecret(body.pakasirApiKey),
          whatsappProvider: body.whatsappProvider || null,
          whatsappApiKey: encryptSecret(body.whatsappApiKey),
          whatsappSender: body.whatsappSender || null,
          createdAt: t,
          updatedAt: t,
        } satisfies PaymentConfig;
        db.paymentConfigs.push(config);
      } else {
        protectPaymentConfig(config);
        config.pakasirSlug = body.pakasirSlug || null;
        if (body.pakasirApiKey) config.pakasirApiKey = encryptSecret(body.pakasirApiKey);
        config.whatsappProvider = body.whatsappProvider || null;
        if (body.whatsappApiKey) config.whatsappApiKey = encryptSecret(body.whatsappApiKey);
        config.whatsappSender = body.whatsappSender || null;
        config.updatedAt = t;
      }
      return publicPaymentConfig(config);
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid payment config payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
