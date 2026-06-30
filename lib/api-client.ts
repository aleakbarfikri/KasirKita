export type UserRole = "owner" | "admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  displayUsername?: string | null;
  role?: UserRole;
  shopName?: string | null;
};

export type MeResponse = {
  user: SessionUser;
  session: unknown;
  shop?: ShopRecord | null;
};

export type ProfileUpdateResponse = {
  user: SessionUser;
  shop?: ShopRecord | null;
  changed: boolean;
};

export type ProductRecord = {
  id: string;
  shopId?: string;
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock?: number | null;
  photoUrl?: string | null;
  isActive?: boolean;
  shopName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TransactionStatus = "pending" | "success" | "failed" | "cancelled";
export type PaymentMethod = "cash" | "qris_static" | "qris_pakasir" | "debt";

export type TransactionRecord = {
  id: string;
  shopId?: string;
  cashierId?: string;
  paymentMethod: PaymentMethod;
  total: number;
  paidAmount?: number | null;
  changeAmount?: number | null;
  status: TransactionStatus;
  externalRef?: string | null;
  note?: string | null;
  shopName?: string;
  createdAt: string;
  updatedAt?: string;
};

export type DebtStatus = "open" | "partial" | "paid";

export type DebtRecord = {
  id: string;
  shopId?: string;
  adminId?: string;
  transactionId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  amount: number;
  paidAmount: number;
  status: DebtStatus;
  dueDate?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type OwnerDebtRow = {
  debt: DebtRecord;
  shop: { id: string; name: string; address?: string | null };
  admin: SessionUser;
};

export type WithdrawalStatus = "pending" | "processed" | "completed" | "rejected";

export type WithdrawalRecord = {
  id: string;
  adminId: string;
  ownerId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: WithdrawalStatus;
  createdAt: string;
  processedAt?: string | null;
  completedAt?: string | null;
};

export type OwnerWithdrawalRow = {
  withdrawal: WithdrawalRecord;
  admin: SessionUser;
};

export type AdminProfile = {
  userId: string;
  ownerId: string;
  shopId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ShopRecord = {
  id: string;
  ownerId: string;
  name: string;
  address?: string | null;
  qrisStaticImageUrl?: string | null;
};

export type BalanceRecord = {
  adminId: string;
  totalEarnedQrisApi: number;
  totalWithdrawn: number;
  updatedAt?: string;
};

export type OwnerAdminRow = {
  admin: SessionUser;
  profile: AdminProfile;
  shop: ShopRecord;
  balance?: BalanceRecord | null;
};

export type PaymentConfig = {
  id?: string;
  ownerId?: string;
  pakasirSlug?: string | null;
  pakasirApiKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
} | null;

export type CheckoutItem = {
  productId?: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
};

export type CheckoutPayload = {
  paymentMethod: PaymentMethod;
  paidAmount?: number;
  note?: string;
  customerName?: string;
  customerPhone?: string;
  debtDueDate?: string;
  items: CheckoutItem[];
};

export type CheckoutResponse = {
  transaction: TransactionRecord;
  items: unknown[];
  debt?: DebtRecord | null;
  payment?: {
    provider: "pakasir";
    status: "pending";
    orderId: string;
    reference: string;
    amount: number;
    totalPayment?: number;
    fee?: number;
    qrString: string;
    qrImageDataUrl?: string;
    paymentUrl: string;
    expiredAt?: string | null;
    pollEveryMs: number;
  };
};

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error?: { message?: string; details?: unknown } };

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const controller = new AbortController();
  const timeoutMs = Number((init as RequestInit & { timeoutMs?: number }).timeoutMs ?? 12000);
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timeout. Coba refresh halaman.", 408);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Some auth endpoints can return an empty body. Keep a useful error below.
  }

  if (!response.ok || payload?.ok === false) {
    const message = payload && "error" in payload ? payload.error?.message : undefined;
    const details = payload && "error" in payload ? payload.error?.details : undefined;
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status, details);
  }

  if (!payload || payload.ok !== true) {
    throw new ApiError("Invalid API response", response.status || 500);
  }

  return payload.data;
}

export const api = {
  me: () => apiFetch<MeResponse>("/api/me"),
  profile: {
    update: (body: { name?: string; shopName?: string; currentPassword?: string; newPassword?: string; confirmPassword?: string }) =>
      apiFetch<ProfileUpdateResponse>("/api/profile", { method: "PATCH", body: JSON.stringify(body) }),
  },

  products: {
    list: () => apiFetch<ProductRecord[]>("/api/products"),
    create: (body: Partial<ProductRecord>) => apiFetch<ProductRecord>("/api/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<ProductRecord>) => apiFetch<ProductRecord>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => apiFetch<ProductRecord>(`/api/products/${id}`, { method: "DELETE" }),
  },

  checkout: (body: CheckoutPayload) => apiFetch<CheckoutResponse>("/api/pos/checkout", { method: "POST", body: JSON.stringify(body) }),
  pollPakasir: (reference: string) => apiFetch<{ status: "pending" | "paid" | "failed" | "cancelled"; providerStatus?: string; warning?: string; transaction: TransactionRecord }>(`/api/pakasir/status/${reference}`),

  transactions: {
    list: () => apiFetch<TransactionRecord[]>("/api/transactions"),
  },

  debts: {
    list: () => apiFetch<DebtRecord[]>("/api/debts"),
    create: (body: { customerName: string; customerPhone?: string; amount: number; dueDate?: string; note?: string }) =>
      apiFetch<DebtRecord>("/api/debts", { method: "POST", body: JSON.stringify(body) }),
    pay: (id: string, body: { amount: number; note?: string }) =>
      apiFetch<{ debt: DebtRecord; payment: unknown }>(`/api/debts/${id}/pay`, { method: "POST", body: JSON.stringify(body) }),
  },

  withdrawals: {
    list: () => apiFetch<WithdrawalRecord[]>("/api/withdrawals"),
    create: (body: { amount: number; bankName: string; accountNumber: string; accountName: string; adminPassword: string }) =>
      apiFetch<WithdrawalRecord>("/api/withdrawals", { method: "POST", body: JSON.stringify(body) }),
  },

  owner: {
    admins: {
      list: () => apiFetch<OwnerAdminRow[]>("/api/owner/admins"),
      create: (body: { name: string; username: string; email: string; password: string; shopName: string; shopAddress?: string }) =>
        apiFetch<OwnerAdminRow>("/api/owner/admins", { method: "POST", body: JSON.stringify(body) }),
      update: (id: string, body: { name?: string; username?: string; shopName?: string; shopAddress?: string; qrisStaticImageUrl?: string }) =>
        apiFetch<OwnerAdminRow>(`/api/owner/admins/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
      deactivate: (id: string) => apiFetch<AdminProfile>(`/api/owner/admins/${id}`, { method: "DELETE" }),
    },
    paymentConfig: {
      get: () => apiFetch<PaymentConfig>("/api/owner/payment-config"),
      save: (body: Exclude<PaymentConfig, null>) => apiFetch<Exclude<PaymentConfig, null>>("/api/owner/payment-config", { method: "PUT", body: JSON.stringify(body) }),
    },
    withdrawals: {
      list: () => apiFetch<OwnerWithdrawalRow[]>("/api/owner/withdrawals"),
      complete: (id: string) => apiFetch<WithdrawalRecord>(`/api/owner/withdrawals/${id}/complete`, { method: "POST" }),
    },
    debts: {
      list: () => apiFetch<OwnerDebtRow[]>("/api/owner/debts"),
    },
  },
};

export function paymentMethodLabel(method: PaymentMethod) {
  const map: Record<PaymentMethod, string> = {
    cash: "Tunai",
    qris_static: "QRIS Statis",
    qris_pakasir: "QRIS Pakasir",
    debt: "Hutang",
  };
  return map[method];
}

export function transactionStatusLabel(status: TransactionStatus) {
  const map: Record<TransactionStatus, string> = {
    pending: "Menunggu",
    success: "Sukses",
    failed: "Gagal",
    cancelled: "Dibatalkan",
  };
  return map[status];
}

export function withdrawalStatusLabel(status: WithdrawalStatus) {
  const map: Record<WithdrawalStatus, string> = {
    pending: "Menunggu",
    processed: "Diproses",
    completed: "Selesai",
    rejected: "Ditolak",
  };
  return map[status];
}

export function debtStatusLabel(status: DebtStatus) {
  const map: Record<DebtStatus, string> = {
    open: "Belum Lunas",
    partial: "Sebagian",
    paid: "Lunas",
  };
  return map[status];
}
