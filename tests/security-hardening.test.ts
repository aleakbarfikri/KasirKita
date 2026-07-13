import assert from "node:assert/strict";
import test from "node:test";
import { createPendingMfaConfig, enableMfa, generateRecoveryCodes, totpCode, verifyOwnerMfaCode, verifyTotp } from "../lib/server/mfa";
import { paymentCredentials, protectPaymentConfig, publicPaymentConfig } from "../lib/server/payment-secrets";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../lib/server/secrets";
import { adminCreateSchema, cashierCreateSchema, registerAdminSchema } from "../lib/server/validators";

const key = Buffer.alloc(32, 11).toString("base64");

test("provider API keys are encrypted at rest and masked for browser responses", () => {
  process.env.KASIRKITA_DATA_ENCRYPTION_KEY = key;
  const encrypted = encryptSecret("provider-secret-123456")!;
  assert.equal(isEncryptedSecret(encrypted), true);
  assert.equal(encrypted.includes("provider-secret"), false);
  assert.equal(decryptSecret(encrypted), "provider-secret-123456");

  const config = { id: "cfg_1", ownerId: "owner_1", pakasirApiKey: "plain-pakasir-key", whatsappApiKey: "plain-whatsapp-key", createdAt: "now", updatedAt: "now" };
  assert.equal(protectPaymentConfig(config), true);
  assert.equal(isEncryptedSecret(config.pakasirApiKey), true);
  assert.equal(paymentCredentials(config).pakasirApiKey, "plain-pakasir-key");
  const publicConfig = publicPaymentConfig(config)!;
  assert.equal("pakasirApiKey" in publicConfig, false);
  assert.equal(publicConfig.pakasirApiKeyMasked?.endsWith("-key"), true);
});

test("TOTP follows RFC timing and recovery codes can only be consumed once", () => {
  process.env.KASIRKITA_DATA_ENCRYPTION_KEY = key;
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpCode(rfcSecret, 59_000), "287082");
  assert.equal(verifyTotp("287082", rfcSecret, 59_000), true);

  const timestamp = new Date().toISOString();
  const config = createPendingMfaConfig("owner_1", rfcSecret, timestamp);
  const recoveryCodes = generateRecoveryCodes(2);
  enableMfa(config, recoveryCodes, timestamp);
  assert.equal(verifyOwnerMfaCode(config, recoveryCodes[0]).valid, true);
  assert.equal(verifyOwnerMfaCode(config, recoveryCodes[0]).valid, false);
  assert.equal(config.recoveryCodeHashes.length, 1);
});

test("new admin, registration, and cashier passwords require 12 characters", () => {
  const common = { name: "Test User", username: "test_user", email: "test@example.test", password: "12345678" };
  assert.equal(adminCreateSchema.safeParse({ ...common, shopName: "Toko" }).success, false);
  assert.equal(registerAdminSchema.safeParse({ ...common, shopName: "Toko", verificationCode: "123456" }).success, false);
  assert.equal(cashierCreateSchema.safeParse(common).success, false);
  assert.equal(cashierCreateSchema.safeParse({ ...common, password: "strong-pass-12" }).success, true);
});
