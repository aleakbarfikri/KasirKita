import crypto from "node:crypto";
import type { AppDb, AppUser, OwnerMfaConfig } from "@/lib/server/data-store";
import { decryptSecret, encryptSecret, hashOneTimeRecoveryCode } from "@/lib/server/secrets";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function findEnabledMfaConfig(db: AppDb, user: Pick<AppUser, "id" | "role">) {
  if (user.role !== "owner" && user.role !== "admin") return null;
  return db.ownerMfaConfigs.find((row) => row.ownerId === user.id && row.enabled) ?? null;
}

function base32Encode(buffer: Buffer) {
  let bits = "";
  for (let index = 0; index < buffer.length; index += 1) bits += buffer[index].toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const normalized = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Secret MFA tidak valid.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret: string, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, "0");
}

export function verifyTotp(code: string, secret: string, timestamp = Date.now()) {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  return [-1, 0, 1].some((window) => {
    const expected = totpCode(secret, timestamp + window * 30_000);
    return crypto.timingSafeEqual(Buffer.from(normalized), Buffer.from(expected));
  });
}

export function totpProvisioningUri(secret: string, username: string) {
  const issuer = "KasirKita";
  const label = `${issuer}:${username}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(8);
    const value = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join("");
    return `${value.slice(0, 4)}-${value.slice(4)}`;
  });
}

export function createPendingMfaConfig(ownerId: string, secret: string, timestamp: string): OwnerMfaConfig {
  return {
    ownerId,
    encryptedSecret: encryptSecret(secret)!,
    enabled: false,
    recoveryCodeHashes: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function enableMfa(config: OwnerMfaConfig, codes: string[], timestamp: string) {
  config.enabled = true;
  config.recoveryCodeHashes = codes.map((code) => hashOneTimeRecoveryCode(code));
  config.updatedAt = timestamp;
  return config;
}

export function verifyOwnerMfaCode(config: OwnerMfaConfig, code: string) {
  const normalized = code.trim();
  const secret = decryptSecret(config.encryptedSecret);
  if (!secret) return { valid: false, usedRecoveryCode: false };
  if (verifyTotp(normalized, secret)) return { valid: true, usedRecoveryCode: false };

  const recoveryHash = hashOneTimeRecoveryCode(normalized);
  const index = config.recoveryCodeHashes.findIndex((hash) => {
    if (hash.length !== recoveryHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(recoveryHash));
  });
  if (index < 0) return { valid: false, usedRecoveryCode: false };
  config.recoveryCodeHashes.splice(index, 1);
  return { valid: true, usedRecoveryCode: true };
}
