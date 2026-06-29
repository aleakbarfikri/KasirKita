import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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

export function readDb(): AppDb {
  const file = ensureDbFile();
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as AppDb;
}

export function writeDb(db: AppDb) {
  const file = ensureDbFile();
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

export function resetDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  writeDb(defaultDb());
  return DB_FILE;
}

export function withDb<T>(mutator: (db: AppDb) => T): T {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
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
