type SendVerificationCodeInput = {
  to: string;
  code: string;
  shopName?: string;
};

const defaultFrom = "KasirKita <customercare@kasir-kita.com>";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

export function emailProviderConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendVerificationCodeEmail(input: SendVerificationCodeInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("Email verifikasi belum dikonfigurasi. Isi RESEND_API_KEY dan verifikasi domain kasir-kita.com terlebih dahulu."), { status: 503 });
  }

  const from = process.env.KASIRKITA_EMAIL_FROM || defaultFrom;
  const subject = "Kode Verifikasi Daftar KasirKita";
  const shopLabel = input.shopName ? ` untuk ${input.shopName}` : "";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1c30">
      <h2 style="margin:0 0 12px">Kode Verifikasi KasirKita</h2>
      <p>Gunakan kode berikut untuk menyelesaikan pendaftaran paket Free KasirKita${shopLabel}.</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#eff4ff;border:1px solid #bccac0;border-radius:16px;padding:16px 20px;text-align:center">${input.code}</div>
      <p style="font-size:13px;color:#3d4a42">Kode berlaku 10 menit. Abaikan email ini jika kamu tidak meminta pendaftaran.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Gagal mengirim email verifikasi (${response.status}).`;
    try {
      const payload = await response.json() as { message?: string; error?: string };
      message = payload.message || payload.error || message;
    } catch {
      // keep default message
    }
    throw Object.assign(new Error(message), { status: 502 });
  }
}

export async function sendPasswordResetCodeEmail(input: Omit<SendVerificationCodeInput, "shopName">) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Email pemulihan akun belum dikonfigurasi."), { status: 503 });
  const from = process.env.KASIRKITA_EMAIL_FROM || defaultFrom;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Kode Pemulihan Akun KasirKita",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1c30"><h2>Pemulihan Akun KasirKita</h2><p>Gunakan kode berikut untuk membuat password baru.</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#eff4ff;border:1px solid #bccac0;border-radius:16px;padding:16px 20px;text-align:center">${input.code}</div><p style="font-size:13px;color:#3d4a42">Kode berlaku 10 menit. Abaikan email ini jika kamu tidak meminta perubahan password.</p></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw Object.assign(new Error(`Gagal mengirim email pemulihan (${response.status}).`), { status: 502 });
}

export async function sendEmailChangeCodeEmail(input: Omit<SendVerificationCodeInput, "shopName">) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Email verifikasi akun belum dikonfigurasi."), { status: 503 });
  const from = process.env.KASIRKITA_EMAIL_FROM || defaultFrom;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Verifikasi Email Baru KasirKita",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1c30"><h2>Verifikasi Email Baru</h2><p>Gunakan kode berikut untuk mengubah email akun KasirKita.</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#eff4ff;border:1px solid #bccac0;border-radius:16px;padding:16px 20px;text-align:center">${input.code}</div><p style="font-size:13px;color:#3d4a42">Kode berlaku 10 menit. Abaikan email ini jika kamu tidak meminta perubahan email.</p></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw Object.assign(new Error(`Gagal mengirim verifikasi email (${response.status}).`), { status: 502 });
}

export async function sendOnlineOrderInvoiceEmail(input: {
  to: string;
  customerName: string;
  shopName: string;
  invoiceNumber: string;
  total: number;
  receiptUrl?: string | null;
  items: Array<{ name: string; quantity: number; price: number }>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Email invoice belum dikonfigurasi."), { status: 503 });
  const from = process.env.KASIRKITA_EMAIL_FROM || defaultFrom;
  const rows = input.items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(item.name)} × ${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">Rp ${Math.round(item.price * item.quantity).toLocaleString("id-ID")}</td></tr>`).join("");
  const receiptLink = input.receiptUrl ? `<p><a href="${escapeHtml(input.receiptUrl)}" style="display:inline-block;background:#0f7a53;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Lihat struk digital</a></p>` : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: `Pembayaran Pesanan Online ${input.invoiceNumber} Berhasil`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b1c30;max-width:640px;margin:auto"><h2>Pembayaran berhasil</h2><p>Halo ${escapeHtml(input.customerName)}, pesanan online Anda di <b>${escapeHtml(input.shopName)}</b> sudah terbayar dan akan diproses untuk diambil di toko.</p><p><b>Invoice:</b> ${escapeHtml(input.invoiceNumber)}</p><table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding:12px 8px;font-weight:800">Total</td><td style="padding:12px 8px;text-align:right;font-weight:800">Rp ${Math.round(input.total).toLocaleString("id-ID")}</td></tr></table>${receiptLink}<p style="font-size:13px;color:#64748b">Pesanan hanya tersedia untuk ambil di toko. Anda dapat mengatur pengambilan sendiri atau menggunakan ojek online.</p></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw Object.assign(new Error(`Gagal mengirim invoice pesanan (${response.status}).`), { status: 502 });
}
