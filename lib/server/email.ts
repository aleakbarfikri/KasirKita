type SendVerificationCodeInput = {
  to: string;
  code: string;
  shopName?: string;
};

const defaultFrom = "KasirKita <customercare@kasir-kita.com>";

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
