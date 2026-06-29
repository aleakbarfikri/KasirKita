import QRCode from "qrcode";

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
  raw: unknown;
};

export type PakasirStatusResult = {
  status: string;
  isPaid: boolean;
  raw: unknown;
};

function cleanCredential(value: string) {
  return value.trim();
}

function getPakasirMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.errors;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(", ");
  return null;
}

export async function createPakasirQris(input: PakasirCreateInput): Promise<PakasirCreateResult> {
  const slug = cleanCredential(input.slug);
  const apiKey = cleanCredential(input.apiKey);

  if (!slug || !apiKey) {
    throw new Error("Slug dan API Key Pakasir wajib diisi di menu Owner > API Config.");
  }

  const response = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
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

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(getPakasirMessage(payload) || `Pakasir menolak request dengan status ${response.status}. Cek slug dan API key.`);
  }

  const payment = (payload as { payment?: Record<string, unknown> } | null)?.payment;
  const qrString = typeof payment?.payment_number === "string" ? payment.payment_number : "";

  if (!payment || !qrString) {
    throw new Error("Response Pakasir tidak berisi QR string. Cek mode project, slug, API key, dan metode qris.");
  }

  const totalPayment = Number(payment.total_payment ?? payment.amount ?? input.amount);
  const fee = Number(payment.fee ?? Math.max(0, totalPayment - input.amount));
  const expiredAt = typeof payment.expired_at === "string" ? payment.expired_at : null;
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
    totalPayment: Number.isFinite(totalPayment) ? totalPayment : input.amount,
    fee: Number.isFinite(fee) ? fee : 0,
    qrString,
    qrImageDataUrl,
    paymentUrl: `https://app.pakasir.com/pay/${encodeURIComponent(slug)}/${input.amount}?order_id=${encodeURIComponent(input.orderId)}&qris_only=1`,
    expiredAt,
    raw: payload,
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

  const response = await fetch(`https://app.pakasir.com/api/transactiondetail?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(getPakasirMessage(payload) || `Gagal cek status Pakasir (${response.status}).`);
  }

  const transaction = (payload as { transaction?: Record<string, unknown> } | null)?.transaction;
  const status = typeof transaction?.status === "string" ? transaction.status.toLowerCase() : "pending";
  const isPaid = ["completed", "success", "paid", "settlement"].includes(status);

  return { status, isPaid, raw: payload };
}
