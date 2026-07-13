import type { PaymentConfig } from "@/lib/server/data-store";
import { decryptSecret, encryptSecret, isEncryptedSecret, maskSecret } from "@/lib/server/secrets";

export function protectPaymentConfig(config: PaymentConfig) {
  let changed = false;
  for (const field of ["pakasirApiKey", "whatsappApiKey"] as const) {
    const current = config[field];
    if (current && !isEncryptedSecret(current)) {
      config[field] = encryptSecret(current);
      changed = true;
    }
  }
  return changed;
}

export function paymentCredentials(config?: PaymentConfig | null) {
  return {
    pakasirSlug: config?.pakasirSlug?.trim() || null,
    pakasirApiKey: decryptSecret(config?.pakasirApiKey),
    whatsappProvider: config?.whatsappProvider?.trim() || null,
    whatsappApiKey: decryptSecret(config?.whatsappApiKey),
    whatsappSender: config?.whatsappSender?.trim() || null,
  };
}

export function publicPaymentConfig(config?: PaymentConfig | null) {
  if (!config) return null;
  const credentials = paymentCredentials(config);
  return {
    id: config.id,
    ownerId: config.ownerId,
    pakasirSlug: credentials.pakasirSlug,
    pakasirApiKeyMasked: maskSecret(credentials.pakasirApiKey),
    pakasirApiKeyConfigured: Boolean(credentials.pakasirApiKey),
    whatsappProvider: credentials.whatsappProvider,
    whatsappApiKeyMasked: maskSecret(credentials.whatsappApiKey),
    whatsappApiKeyConfigured: Boolean(credentials.whatsappApiKey),
    whatsappSender: credentials.whatsappSender,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}
