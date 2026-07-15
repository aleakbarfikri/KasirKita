import QRCode from "qrcode";

const PAKASIR_TIMEOUT_MS = 8_000;

export type PakasirCreateInput = {
  slug: string;
  apiKey: string;
  orderId: string;
  amount: number;
};

export type PakasirCreateResult = {
  orderId: string;
  amount: number;
  totalPayment: number;
  fee: number;
  qrString: string;
  qrImageDataUrl: string;
  paymentUrl: string;
  expiredAt?: string | null;
};

export type PakasirStatusResult = {
  status: string;
  isPaid: boolean;
};

type PakasirValidatedPayment = {
  totalPayment: number;
  fee: number;
  qrString: string;
  expiredAt: string | null;
};

export class PakasirIntegrityError extends Error {
  constructor() {
    super("Respons pembayaran Pakasir tidak cocok dengan transaksi KasirKita.");
    this.name = "PakasirIntegrityError";
  }
}

function cleanCredential(value: string) {
  return value.trim();
}

async function pakasirRequest(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAKASIR_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw new Error("Pakasir tidak merespons dalam batas waktu yang aman.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getPakasirMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.errors;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(", ");
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asFiniteInteger(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) ? number : null;
}

function normalizedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function assertProviderIdentity(record: Record<string, unknown>, input: PakasirCreateInput) {
  const orderId = normalizedString(record.order_id);
  const project = normalizedString(record.project);
  const paymentMethod = normalizedString(record.payment_method).toLowerCase();
  const amount = asFiniteInteger(record.amount);

  if (orderId !== input.orderId || project !== cleanCredential(input.slug) || amount !== input.amount || paymentMethod !== "qris") {
    throw new PakasirIntegrityError();
  }
}

/** Validates every provider-controlled field before it is used by checkout. */
export function validatePakasirCreatePayload(input: PakasirCreateInput, payload: unknown): PakasirValidatedPayment {
  const payment = asRecord(asRecord(payload)?.payment);
  if (!payment) throw new PakasirIntegrityError();
  assertProviderIdentity(payment, input);

  const qrString = normalizedString(payment.payment_number);
  const totalPayment = asFiniteInteger(payment.total_payment);
  const fee = asFiniteInteger(payment.fee);
  const expiredAt = payment.expired_at === null || payment.expired_at === undefined ? null : normalizedString(payment.expired_at);
  const expiredAtMs = expiredAt ? new Date(expiredAt).getTime() : null;

  if (!qrString || totalPayment === null || fee === null || fee < 0 || totalPayment !== input.amount + fee || (expiredAt && !Number.isFinite(expiredAtMs))) {
    throw new PakasirIntegrityError();
  }
  return { totalPayment, fee, qrString, expiredAt };
}

/** Transaction Detail is authoritative only after its identity matches the local transaction. */
export function validatePakasirStatusPayload(input: PakasirCreateInput, payload: unknown): PakasirStatusResult {
  const transaction = asRecord(asRecord(payload)?.transaction);
  if (!transaction) throw new PakasirIntegrityError();
  assertProviderIdentity(transaction, input);

  const status = normalizedString(transaction.status).toLowerCase();
  if (!status) throw new PakasirIntegrityError();
  return { status, isPaid: status === "completed" };
}

export async function createPakasirQris(input: PakasirCreateInput): Promise<PakasirCreateResult> {
  const slug = cleanCredential(input.slug);
  const apiKey = cleanCredential(input.apiKey);

  if (!slug || !apiKey) {
    throw new Error("Slug dan API Key Pakasir wajib diisi di menu Owner > API Config.");
  }

  const { response, text } = await pakasirRequest("https://app.pakasir.com/api/transactioncreate/qris", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      project: slug,
      order_id: input.orderId,
      amount: input.amount,
      api_key: apiKey,
    }),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(getPakasirMessage(payload) || `Pakasir menolak request dengan status ${response.status}. Cek slug dan API key.`);
  }

  const { totalPayment, fee, qrString, expiredAt } = validatePakasirCreatePayload({ ...input, slug }, payload);
  const qrImageDataUrl = await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
    color: {
      dark: "#0b1c30",
      light: "#ffffff",
    },
  });

  return {
    orderId: input.orderId,
    amount: input.amount,
    totalPayment,
    fee,
    qrString,
    qrImageDataUrl,
    paymentUrl: `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${input.amount}?order_id=${encodeURIComponent(input.orderId)}&qris_only=1`,
    expiredAt,
  };
}

export async function getPakasirTransactionStatus(input: PakasirCreateInput): Promise<PakasirStatusResult> {
  const slug = cleanCredential(input.slug);
  const apiKey = cleanCredential(input.apiKey);

  if (!slug || !apiKey) {
    throw new Error("Slug dan API Key Pakasir belum dikonfigurasi.");
  }

  const params = new URLSearchParams({
    project: slug,
    amount: String(input.amount),
    order_id: input.orderId,
    api_key: apiKey,
  });

  const { response, text } = await pakasirRequest(`https://app.pakasir.com/api/transactiondetail?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(getPakasirMessage(payload) || `Gagal cek status Pakasir (${response.status}).`);
  }

  return validatePakasirStatusPayload({ ...input, slug }, payload);
}
