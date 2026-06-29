import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

export type UserRole = "owner" | "admin";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string | null;
  username: string;
  displayUsername?: string | null;
  role: UserRole;
  shopName?: string | null;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type AppSession = {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Shop = {
  id: string;
  ownerId: string;
  name: string;
  address?: string | null;
  qrisStaticImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfile = {
  userId: string;
  ownerId: string;
  shopId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaymentConfig = {
  id: string;
  ownerId: string;
  pakasirSlug?: string | null;
  pakasirApiKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  shopId: string;
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock?: number | null;
  photoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Transaction = {
  id: string;
  shopId: string;
  cashierId: string;
  paymentMethod: "cash" | "qris_static" | "qris_pakasir" | "debt";
  total: number;
  paidAmount?: number | null;
  changeAmount?: number | null;
  status: "pending" | "success" | "failed" | "cancelled";
  externalRef?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionItem = {
  id: string;
  transactionId: string;
  productId?: string | null;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

export type Balance = {
  adminId: string;
  totalEarnedQrisApi: number;
  totalWithdrawn: number;
  updatedAt: string;
};

export type Withdrawal = {
  id: string;
  adminId: string;
  ownerId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: "pending" | "processed" | "completed" | "rejected";
  createdAt: string;
  processedAt?: string | null;
  completedAt?: string | null;
};

export type Debt = {
  id: string;
  shopId: string;
  adminId: string;
  transactionId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  amount: number;
  paidAmount: number;
  status: "open" | "partial" | "paid";
  dueDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DebtPayment = {
  id: string;
  debtId: string;
  amount: number;
  note?: string | null;
  createdAt: string;
};

export type AppDb = {
  users: AppUser[];
  sessions: AppSession[];
  shops: Shop[];
  adminProfiles: AdminProfile[];
  paymentConfigs: PaymentConfig[];
  products: Product[];
  transactions: Transaction[];
  transactionItems: TransactionItem[];
  balances: Balance[];
  withdrawals: Withdrawal[];
  debts: Debt[];
  debtPayments: DebtPayment[];
};

function resolveDataDir() {
  if (process.env.KASIRKITA_DATA_DIR) return process.env.KASIRKITA_DATA_DIR;

  // Vercel serverless functions run from a read-only deployment directory.
  // Only /tmp is writable at runtime, so the JSON store must live there.
  if (process.env.VERCEL === "1") return path.join("/tmp", "kasirkita-data");

  return path.join(process.cwd(), ".data");
}

const DATA_DIR = resolveDataDir();
const DB_FILE = process.env.KASIRKITA_DB_FILE || path.join(DATA_DIR, "kasirkita-db.json");
const AUTH_SECRET = process.env.KASIRKITA_AUTH_SECRET || process.env.NEXTAUTH_SECRET || "kasirkita-local-dev-secret-change-me";

export function now() {
  return new Date().toISOString();
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hmac(payload: string) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("hex");
}

export function createSignedSessionToken(userId: string, expiresAt: string) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt }), "utf8").toString("base64url");
  return `v1.${payload}.${hmac(payload)}`;
}

export function verifySignedSessionToken(token: string) {
  const [version, payload, signature] = token.split(".");
  if (version !== "v1" || !payload || !signature) return null;
  const expected = hmac(payload);
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; expiresAt?: string };
    if (!parsed.userId || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed as { userId: string; expiresAt: string };
  } catch {
    return null;
  }
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function publicUser(user: AppUser) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

export function defaultDb(): AppDb {
  const t = now();
  return {
    users: [
      {
        id: "user_owner_kasirkita",
        name: "Owner KasirKita",
        email: "owner@kasirkita.local",
        emailVerified: true,
        image: null,
        username: "ownerkasirkita",
        displayUsername: "ownerkasirkita",
        role: "owner",
        shopName: "KasirKita",
        passwordHash: hashPassword("Regina050322"),
        createdAt: t,
        updatedAt: t,
      },
    ],
    sessions: [],
    shops: [],
    adminProfiles: [],
    paymentConfigs: [],
    products: [],
    transactions: [],
    transactionItems: [],
    balances: [],
    withdrawals: [],
    debts: [],
    debtPayments: [],
  };
}

const CLOUD_DB_KEY = process.env.KASIRKITA_CLOUD_DB_KEY || "kasirkita:db";

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand<T = unknown>(command: unknown[]): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([command]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis storage error: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json() as Array<{ result?: T; error?: string }>;
  const first = payload[0];
  if (first?.error) throw new Error(first.error);
  return first?.result ?? null;
}

function encodeRedisCommand(parts: string[]) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join("")}`;
}

type AnyNodeBuffer = Buffer<ArrayBufferLike>;

function parseResp(buffer: AnyNodeBuffer): { value: unknown; rest: AnyNodeBuffer } | null {
  if (buffer.length < 1) return null;
  const prefix = String.fromCharCode(buffer[0]);
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd === -1) return null;
  const line = buffer.subarray(1, lineEnd).toString("utf8");
  const afterLine = lineEnd + 2;

  if (prefix === "+") return { value: line, rest: buffer.subarray(afterLine) };
  if (prefix === "-") throw new Error(`Redis error: ${line}`);
  if (prefix === ":") return { value: Number(line), rest: buffer.subarray(afterLine) };

  if (prefix === "$") {
    const length = Number(line);
    if (length === -1) return { value: null, rest: buffer.subarray(afterLine) };
    const end = afterLine + length;
    if (buffer.length < end + 2) return null;
    return { value: buffer.subarray(afterLine, end).toString("utf8"), rest: buffer.subarray(end + 2) };
  }

  if (prefix === "*") {
    const count = Number(line);
    if (count === -1) return { value: null, rest: buffer.subarray(afterLine) };
    const values: unknown[] = [];
    let rest = buffer.subarray(afterLine);
    for (let index = 0; index < count; index += 1) {
      const parsed = parseResp(rest);
      if (!parsed) return null;
      values.push(parsed.value);
      rest = parsed.rest;
    }
    return { value: values, rest };
  }

  throw new Error(`Unsupported Redis response: ${prefix}`);
}

async function redisUrlCommand<T = unknown>(command: string[]): Promise<T | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const url = new URL(redisUrl);
  const isTls = url.protocol === "rediss:";
  const port = Number(url.port || (isTls ? 6380 : 6379));
  const username = url.username ? decodeURIComponent(url.username) : "";
  const password = url.password ? decodeURIComponent(url.password) : "";
  const database = url.pathname?.replace(/^\//, "");

  const commands: string[][] = [];
  if (password) {
    commands.push(username ? ["AUTH", username, password] : ["AUTH", password]);
  }
  if (database && /^\d+$/.test(database) && database !== "0") {
    commands.push(["SELECT", database]);
  }
  commands.push(command);

  return await new Promise<T>((resolve, reject) => {
    const socket = isTls
      ? tls.connect({ host: url.hostname, port, servername: url.hostname })
      : net.connect({ host: url.hostname, port });

    let responseBuffer: AnyNodeBuffer = Buffer.alloc(0);
    let responseIndex = 0;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Redis URL storage timeout"));
    }, 10_000);

    socket.once("connect", () => {
      socket.write(commands.map(encodeRedisCommand).join(""));
    });

    socket.on("data", (chunk) => {
      try {
        responseBuffer = Buffer.concat([responseBuffer, chunk]);
        while (responseIndex < commands.length) {
          const parsed = parseResp(responseBuffer);
          if (!parsed) return;
          responseBuffer = parsed.rest;
          responseIndex += 1;
          if (responseIndex === commands.length) {
            clearTimeout(timeout);
            socket.end();
            resolve(parsed.value as T);
            return;
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
      }
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function readRedisUrlDb(): Promise<AppDb | null> {
  if (!process.env.REDIS_URL) return null;
  const stored = await redisUrlCommand<string | null>(["GET", CLOUD_DB_KEY]);
  if (!stored) {
    const fresh = defaultDb();
    await writeRedisUrlDb(fresh);
    return fresh;
  }
  return JSON.parse(stored) as AppDb;
}

async function writeRedisUrlDb(db: AppDb): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  await redisUrlCommand(["SET", CLOUD_DB_KEY, JSON.stringify(db)]);
  return true;
}

async function readCloudDb(): Promise<AppDb | null> {
  const config = getRedisConfig();
  if (config) {
    const stored = await redisCommand<string | null>(["GET", CLOUD_DB_KEY]);
    if (!stored) {
      const fresh = defaultDb();
      await writeCloudDb(fresh);
      return fresh;
    }

    if (typeof stored === "string") {
      return JSON.parse(stored) as AppDb;
    }

    return stored as AppDb;
  }

  return await readRedisUrlDb();
}

async function writeCloudDb(db: AppDb): Promise<boolean> {
  const config = getRedisConfig();
  if (config) {
    await redisCommand(["SET", CLOUD_DB_KEY, JSON.stringify(db)]);
    return true;
  }

  return await writeRedisUrlDb(db);
}

function ensureDbFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
    }
  } catch (error) {
    // Last-resort fallback for serverless read-only filesystems.
    const fallbackDir = path.join("/tmp", "kasirkita-data");
    const fallbackFile = path.join(fallbackDir, "kasirkita-db.json");
    if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
    if (!fs.existsSync(fallbackFile)) {
      fs.writeFileSync(fallbackFile, JSON.stringify(defaultDb(), null, 2));
    }
    return fallbackFile;
  }
  return DB_FILE;
}

export async function readDb(): Promise<AppDb> {
  const cloudDb = await readCloudDb();
  if (cloudDb) return cloudDb;

  const file = ensureDbFile();
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as AppDb;
}

export async function writeDb(db: AppDb): Promise<void> {
  const wroteCloud = await writeCloudDb(db);
  if (wroteCloud) return;

  const file = ensureDbFile();
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

export async function resetDb() {
  const fresh = defaultDb();
  const wroteCloud = await writeCloudDb(fresh);
  if (wroteCloud) return CLOUD_DB_KEY;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = ensureDbFile();
  fs.writeFileSync(file, JSON.stringify(fresh, null, 2));
  return file;
}

export async function withDb<T>(mutator: (db: AppDb) => T): Promise<T> {
  const db = await readDb();
  const result = mutator(db);
  await writeDb(db);
  return result;
}

export function sortDesc<T extends { createdAt?: string; updatedAt?: string }>(rows: T[]) {
  return rows.sort((a, b) => String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")));
}

export function getUserByIdFromDb(db: AppDb, id: string) {
  return db.users.find((user) => user.id === id) || null;
}

export function getShopByIdFromDb(db: AppDb, id: string) {
  return db.shops.find((shop) => shop.id === id) || null;
}

export function getBalanceFromDb(db: AppDb, adminId: string) {
  return db.balances.find((balance) => balance.adminId === adminId) || null;
}

export function upsertBalance(db: AppDb, adminId: string, patch: Partial<Balance>) {
  let balance = db.balances.find((row) => row.adminId === adminId);
  if (!balance) {
    balance = { adminId, totalEarnedQrisApi: 0, totalWithdrawn: 0, updatedAt: now() };
    db.balances.push(balance);
  }
  Object.assign(balance, patch, { updatedAt: now() });
  return balance;
}

export function incrementBalance(db: AppDb, adminId: string, field: "totalEarnedQrisApi" | "totalWithdrawn", amount: number) {
  const balance = upsertBalance(db, adminId, {});
  balance[field] += amount;
  balance.updatedAt = now();
  return balance;
}

export function rowWithAdminProfile(db: AppDb, profile: AdminProfile) {
  const user = getUserByIdFromDb(db, profile.userId);
  const shop = getShopByIdFromDb(db, profile.shopId);
  if (!user || !shop) return null;
  return {
    admin: publicUser(user),
    profile,
    shop,
    balance: getBalanceFromDb(db, user.id),
  };
}
