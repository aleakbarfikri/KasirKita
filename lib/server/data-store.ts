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

const DATA_DIR = process.env.KASIRKITA_DATA_DIR || path.join(process.cwd(), ".data");
const DB_FILE = process.env.KASIRKITA_DB_FILE || path.join(DATA_DIR, "kasirkita-db.json");

export function now() {
  return new Date().toISOString();
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
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
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

export function readDb(): AppDb {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw) as AppDb;
}

export function writeDb(db: AppDb) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
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
