import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import postgres from "postgres";

export type UserRole = "owner" | "admin" | "cashier";

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
  phone?: string | null;
  qrisStaticImageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfile = {
  userId: string;
  ownerId: string;
  shopId: string;
  isActive: boolean;
  activeUntil?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CashierProfile = {
  userId: string;
  adminId: string;
  ownerId: string;
  shopId: string;
  isActive: boolean;
  approvalStatus: "approved" | "pending" | "rejected";
  createdAt: string;
  updatedAt: string;
};

export type PaymentConfig = {
  id: string;
  ownerId: string;
  pakasirSlug?: string | null;
  pakasirApiKey?: string | null;
  whatsappProvider?: string | null;
  whatsappApiKey?: string | null;
  whatsappSender?: string | null;
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
  discountType?: "none" | "percent" | "amount";
  discountValue?: number;
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
  subtotal?: number;
  discountType?: "none" | "percent" | "amount";
  discountValue?: number;
  discountAmount?: number;
  total: number;
  paidAmount?: number | null;
  changeAmount?: number | null;
  status: "pending" | "success" | "failed" | "cancelled";
  externalRef?: string | null;
  receiptToken?: string | null;
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
  originalPrice?: number;
  price: number;
  costPrice?: number | null;
  discountAmount?: number;
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

export type AuditLog = {
  id: string;
  actorId: string;
  actorRole: UserRole;
  shopId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type CashShift = {
  id: string;
  shopId: string;
  cashierId: string;
  openedAt: string;
  closedAt: string;
  transactionCount: number;
  cashSales: number;
  qrisStaticSales: number;
  qrisPakasirSales: number;
  debtSales: number;
  cancelledSales: number;
  grossSales: number;
  grossProfit: number;
  cashCounted?: number | null;
  cashDifference?: number | null;
  note?: string | null;
  createdAt: string;
};

export type AppDb = {
  users: AppUser[];
  sessions: AppSession[];
  shops: Shop[];
  adminProfiles: AdminProfile[];
  cashierProfiles: CashierProfile[];
  paymentConfigs: PaymentConfig[];
  products: Product[];
  transactions: Transaction[];
  transactionItems: TransactionItem[];
  balances: Balance[];
  withdrawals: Withdrawal[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  auditLogs: AuditLog[];
  cashShifts: CashShift[];
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

export function jakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isAdminProfileActive(profile: Pick<AdminProfile, "isActive" | "activeUntil">, date = new Date()) {
  if (!profile.isActive) return false;
  if (!profile.activeUntil) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(profile.activeUntil)) return profile.activeUntil >= jakartaDateString(date);
  const expiresAt = new Date(profile.activeUntil).getTime();
  return Number.isFinite(expiresAt) ? expiresAt >= date.getTime() : true;
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function createDataId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
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
    cashierProfiles: [],
    paymentConfigs: [],
    products: [],
    transactions: [],
    transactionItems: [],
    balances: [],
    withdrawals: [],
    debts: [],
    debtPayments: [],
    auditLogs: [],
    cashShifts: [],
  };
}

function normalizeDb(db: AppDb): AppDb {
  return {
    ...db,
    users: db.users ?? [],
    sessions: db.sessions ?? [],
    shops: db.shops ?? [],
    adminProfiles: db.adminProfiles ?? [],
    cashierProfiles: db.cashierProfiles ?? [],
    paymentConfigs: db.paymentConfigs ?? [],
    products: db.products ?? [],
    transactions: db.transactions ?? [],
    transactionItems: db.transactionItems ?? [],
    balances: db.balances ?? [],
    withdrawals: db.withdrawals ?? [],
    debts: db.debts ?? [],
    debtPayments: db.debtPayments ?? [],
    auditLogs: db.auditLogs ?? [],
    cashShifts: db.cashShifts ?? [],
  };
}

const CLOUD_DB_KEY = process.env.KASIRKITA_CLOUD_DB_KEY || "kasirkita:db";
const CLOUD_BACKUPS_INDEX_KEY = `${CLOUD_DB_KEY}:backups:index`;
const POSTGRES_STATE_KEY = process.env.KASIRKITA_POSTGRES_STATE_KEY || "default";

type PostgresClient = ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>) & {
  end?: () => Promise<void>;
  json: (value: unknown) => unknown;
};

let postgresClient: PostgresClient | null = null;

function getPostgresUrl() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url || url.startsWith("file:")) return null;
  if (!/^postgres(ql)?:\/\//.test(url)) return null;
  return url;
}

async function getPostgresClient() {
  const url = getPostgresUrl();
  if (!url) return null;
  if (postgresClient) return postgresClient;

  postgresClient = postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.POSTGRES_SSL === "false" ? false : "require",
  }) as unknown as PostgresClient;
  return postgresClient;
}

async function ensurePostgresTables(sql: PostgresClient) {
  await sql`
    create table if not exists kasirkita_app_state (
      key text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists kasirkita_backups (
      id text primary key,
      reason text not null,
      data jsonb not null,
      size_bytes integer not null,
      created_at timestamptz not null default now()
    )
  `;
}

async function readPostgresDb(): Promise<AppDb | null> {
  const sql = await getPostgresClient();
  if (!sql) return null;

  await ensurePostgresTables(sql);
  const rows = await sql`
    select data
    from kasirkita_app_state
    where key = ${POSTGRES_STATE_KEY}
    limit 1
  ` as Array<{ data: AppDb }>;

  if (rows[0]?.data) return normalizeDb(rows[0].data);

  const fresh = defaultDb();
  await writePostgresDb(fresh);
  return fresh;
}

async function writePostgresDb(db: AppDb): Promise<boolean> {
  const sql = await getPostgresClient();
  if (!sql) return false;

  await ensurePostgresTables(sql);
  await sql`
    insert into kasirkita_app_state (key, data, updated_at)
    values (${POSTGRES_STATE_KEY}, ${sql.json(db)}, now())
    on conflict (key)
    do update set data = excluded.data, updated_at = now()
  `;
  return true;
}

export type BackupInfo = {
  id: string;
  reason: string;
  sizeBytes: number;
  createdAt: string;
};

export async function createBackup(reason = "manual"): Promise<BackupInfo> {
  const db = await readDb();
  const id = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const sizeBytes = Buffer.byteLength(JSON.stringify(db), "utf8");
  const sql = await getPostgresClient();

  if (sql) {
    await ensurePostgresTables(sql);
    const rows = await sql`
      insert into kasirkita_backups (id, reason, data, size_bytes, created_at)
      values (${id}, ${reason}, ${sql.json(db)}, ${sizeBytes}, now())
      returning id, reason, size_bytes as "sizeBytes", created_at as "createdAt"
    ` as Array<BackupInfo>;
    return {
      ...rows[0],
      createdAt: new Date(rows[0].createdAt).toISOString(),
    };
  }

  if (hasCloudStorage()) {
    const createdAt = now();
    const info = { id, reason, sizeBytes, createdAt };
    await writeCloudValue(`${CLOUD_DB_KEY}:backup:${id}`, JSON.stringify({ info, data: db }));
    const currentIndex = await readCloudValue<string>(CLOUD_BACKUPS_INDEX_KEY);
    const parsedIndex = currentIndex ? JSON.parse(currentIndex) as BackupInfo[] : [];
    const nextIndex = [info, ...parsedIndex.filter((row) => row.id !== id)]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 30);
    await writeCloudValue(CLOUD_BACKUPS_INDEX_KEY, JSON.stringify(nextIndex));
    return info;
  }

  const backupDir = path.join(DATA_DIR, "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify({ id, reason, createdAt: now(), data: db }, null, 2));
  return { id, reason, sizeBytes, createdAt: now() };
}

export async function listBackups(): Promise<BackupInfo[]> {
  const sql = await getPostgresClient();
  if (sql) {
    await ensurePostgresTables(sql);
    const rows = await sql`
      select id, reason, size_bytes as "sizeBytes", created_at as "createdAt"
      from kasirkita_backups
      order by created_at desc
      limit 30
    ` as Array<BackupInfo>;
    return rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
  }

  if (hasCloudStorage()) {
    const currentIndex = await readCloudValue<string>(CLOUD_BACKUPS_INDEX_KEY);
    if (!currentIndex) return [];
    return (JSON.parse(currentIndex) as BackupInfo[])
      .map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 30);
  }

  const backupDir = path.join(DATA_DIR, "backups");
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, 30)
    .map((file) => {
      const fullPath = path.join(backupDir, file);
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw) as { id?: string; reason?: string; createdAt?: string };
      return {
        id: parsed.id || file.replace(/\.json$/, ""),
        reason: parsed.reason || "manual",
        sizeBytes: Buffer.byteLength(raw, "utf8"),
        createdAt: parsed.createdAt || fs.statSync(fullPath).mtime.toISOString(),
      };
    });
}

export async function readBackup(id: string): Promise<{ info: BackupInfo; data: AppDb } | null> {
  if (!/^backup_[A-Za-z0-9_-]+$/.test(id)) return null;

  const sql = await getPostgresClient();
  if (sql) {
    await ensurePostgresTables(sql);
    const rows = await sql`
      select id, reason, data, size_bytes as "sizeBytes", created_at as "createdAt"
      from kasirkita_backups
      where id = ${id}
      limit 1
    ` as Array<BackupInfo & { data: AppDb }>;
    const row = rows[0];
    if (!row) return null;
    return {
      info: { id: row.id, reason: row.reason, sizeBytes: row.sizeBytes, createdAt: new Date(row.createdAt).toISOString() },
      data: row.data,
    };
  }

  if (hasCloudStorage()) {
    const stored = await readCloudValue<string>(`${CLOUD_DB_KEY}:backup:${id}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { info: BackupInfo; data: AppDb };
    return {
      info: { ...parsed.info, createdAt: new Date(parsed.info.createdAt).toISOString() },
      data: normalizeDb(parsed.data),
    };
  }

  const file = path.join(DATA_DIR, "backups", `${id}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as { id: string; reason: string; createdAt: string; data: AppDb };
  return {
    info: { id: parsed.id, reason: parsed.reason, sizeBytes: Buffer.byteLength(raw, "utf8"), createdAt: parsed.createdAt },
    data: parsed.data,
  };
}

export function normalizeRestoredDb(data: unknown): AppDb {
  if (!data || typeof data !== "object") {
    throw Object.assign(new Error("File backup tidak valid."), { status: 422 });
  }

  const db = data as Partial<AppDb>;
  const requiredArrays: Array<keyof AppDb> = [
    "users",
    "sessions",
    "shops",
    "adminProfiles",
    "cashierProfiles",
    "paymentConfigs",
    "products",
    "transactions",
    "transactionItems",
    "balances",
    "withdrawals",
    "debts",
    "debtPayments",
  ];

  const missingArray = requiredArrays.find((key) => !Array.isArray(db[key]));
  if (missingArray) {
    throw Object.assign(new Error(`File backup tidak valid. Bagian ${missingArray} tidak ditemukan.`), { status: 422 });
  }

  if (!db.users?.some((user) => user.role === "owner")) {
    throw Object.assign(new Error("File backup tidak memiliki akun Owner."), { status: 422 });
  }

  return normalizeDb(db as AppDb);
}

export async function restoreBackupData(data: unknown, audit?: { actorId: string; actorRole: UserRole }): Promise<{ backupBeforeRestore: BackupInfo; restored: AppDb }> {
  const restored = normalizeRestoredDb(data);
  const backupBeforeRestore = await createBackup("before-restore");
  if (audit) {
    addAuditLog(restored, {
      actorId: audit.actorId,
      actorRole: audit.actorRole,
      action: "restore_backup",
      entityType: "backup",
      entityId: backupBeforeRestore.id,
      message: "Owner melakukan restore backup JSON.",
      metadata: { backupBeforeRestoreId: backupBeforeRestore.id },
    });
  }
  await writeDb(restored);
  return { backupBeforeRestore, restored };
}

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
    return normalizeDb(fresh);
  }
  return normalizeDb(JSON.parse(stored) as AppDb);
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
      return normalizeDb(JSON.parse(stored) as AppDb);
    }

    return normalizeDb(stored as AppDb);
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

function hasCloudStorage() {
  return Boolean(getRedisConfig() || process.env.REDIS_URL);
}

async function readCloudValue<T = unknown>(key: string): Promise<T | null> {
  const config = getRedisConfig();
  if (config) {
    return await redisCommand<T | null>(["GET", key]);
  }

  if (process.env.REDIS_URL) {
    return await redisUrlCommand<T | null>(["GET", key]);
  }

  return null;
}

async function writeCloudValue(key: string, value: string): Promise<boolean> {
  const config = getRedisConfig();
  if (config) {
    await redisCommand(["SET", key, value]);
    return true;
  }

  if (process.env.REDIS_URL) {
    await redisUrlCommand(["SET", key, value]);
    return true;
  }

  return false;
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
  const postgresDb = await readPostgresDb();
  if (postgresDb) return postgresDb;

  const cloudDb = await readCloudDb();
  if (cloudDb) return cloudDb;

  const file = ensureDbFile();
  const raw = fs.readFileSync(file, "utf8");
  return normalizeDb(JSON.parse(raw) as AppDb);
}

export async function writeDb(db: AppDb): Promise<void> {
  const wrotePostgres = await writePostgresDb(db);
  if (wrotePostgres) return;

  const wroteCloud = await writeCloudDb(db);
  if (wroteCloud) return;

  const file = ensureDbFile();
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

export async function resetDb() {
  const fresh = defaultDb();
  const wrotePostgres = await writePostgresDb(fresh);
  if (wrotePostgres) return "postgres";

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

export function addAuditLog(
  db: AppDb,
  input: Omit<AuditLog, "id" | "createdAt"> & { id?: string; createdAt?: string },
) {
  const log: AuditLog = {
    id: input.id ?? createDataId("audit"),
    actorId: input.actorId,
    actorRole: input.actorRole,
    shopId: input.shopId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    message: input.message,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt ?? now(),
  };
  db.auditLogs.push(log);
  return log;
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
