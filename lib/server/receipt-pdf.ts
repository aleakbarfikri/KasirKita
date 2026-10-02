import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import type { buildReceipt } from "@/lib/server/receipt";
import { formatCurrency } from "@/lib/utils";

type Receipt = ReturnType<typeof buildReceipt>;

const pageWidth = 595.28;
const pageHeight = 841.89;
const left = 42;
const right = pageWidth - left;
const green = rgb(0.02, 0.43, 0.29);
const ink = rgb(0.08, 0.13, 0.19);
const muted = rgb(0.33, 0.39, 0.45);
const border = rgb(0.82, 0.87, 0.84);

function pdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = pdfText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const original of words) {
    let word = original;
    while (font.widthOfTextAtSize(word, size) > width) {
      let length = word.length;
      while (length > 1 && font.widthOfTextAtSize(word.slice(0, length), size) > width) length -= 1;
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, length));
      word = word.slice(length);
    }
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function draw(page: PDFPage, font: PDFFont, text: unknown, x: number, y: number, size = 10, color = ink) {
  page.drawText(pdfText(text), { x, y, size, font, color });
}

function drawRight(page: PDFPage, font: PDFFont, text: unknown, rightEdge: number, y: number, size = 10, color = ink) {
  const safe = pdfText(text);
  draw(page, font, safe, rightEdge - font.widthOfTextAtSize(safe, size), y, size, color);
}

export async function generateReceiptPdf(receipt: Receipt) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Struk ${receipt.transaction.invoiceNumber}`);
  pdf.setAuthor("KasirKita");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  const logoData = receipt.settings.logoDataUrl;
  if (logoData?.startsWith("data:image/") && logoData.length < 1_000_000) {
    try {
      const source = Buffer.from(logoData.slice(logoData.indexOf(",") + 1), "base64");
      const png = await sharp(source, { limitInputPixels: 4_000_000 }).resize(160, 160, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
      logo = await pdf.embedPng(png);
    } catch { /* Older or invalid logos should not prevent downloading the receipt. */ }
  }
  let page!: PDFPage;
  let y = 0;

  function newPage(continued = false) {
    page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 0, y: pageHeight - 9, width: pageWidth, height: 9, color: green });
    draw(page, bold, continued ? "STRUK DIGITAL - LANJUTAN" : "STRUK DIGITAL", left, 797, 11, green);
    drawRight(page, regular, receipt.transaction.invoiceNumber, right, 797, 10, muted);

    if (!continued) {
      if (logo) page.drawImage(logo, { x: right - 60, y: 725, width: 55, height: 55 });
      const shopLines = wrap(receipt.shop.name, bold, 19, 400).slice(0, 2);
      let shopY = 766;
      for (const line of shopLines) { draw(page, bold, line, left, shopY, 19, ink); shopY -= 22; }
      if (receipt.shop.address) { for (const line of wrap(receipt.shop.address, regular, 9, 440).slice(0, 2)) { draw(page, regular, line, left, shopY, 9, muted); shopY -= 12; } }
      if (receipt.shop.phone) { draw(page, regular, `Telp: ${receipt.shop.phone}`, left, shopY, 9, muted); shopY -= 12; }
      const dividerY = Math.min(shopY - 8, 710);
      page.drawLine({ start: { x: left, y: dividerY }, end: { x: right, y: dividerY }, thickness: 1, color: border });
      const date = new Date(receipt.transaction.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
      draw(page, regular, "Tanggal", left, dividerY - 22, 9, muted);
      draw(page, bold, date, left + 72, dividerY - 22, 9);
      draw(page, regular, "Kasir", left, dividerY - 39, 9, muted);
      draw(page, bold, receipt.cashier.name, left + 72, dividerY - 39, 9);
      draw(page, regular, "Metode", 325, dividerY - 22, 9, muted);
      draw(page, bold, receipt.transaction.paymentMethod === "qris_pakasir" ? "QRIS KasirKita" : receipt.transaction.paymentMethod, 383, dividerY - 22, 9);
      if (receipt.queueNumber) { draw(page, regular, "Antrean", 325, dividerY - 39, 9, muted); draw(page, bold, String(receipt.queueNumber), 383, dividerY - 39, 9); }
      if (receipt.onlineOrder) {
        draw(page, regular, "Order online", left, dividerY - 56, 9, muted);
        draw(page, bold, receipt.onlineOrder.orderNumber, left + 72, dividerY - 56, 9);
        draw(page, regular, "Pemesan", left, dividerY - 73, 9, muted);
        draw(page, bold, wrap(`${receipt.onlineOrder.customerName} / ${receipt.onlineOrder.customerPhone}`, bold, 9, 400)[0], left + 72, dividerY - 73, 9);
        draw(page, regular, "Status", left, dividerY - 90, 9, muted);
        draw(page, bold, receipt.onlineOrder.status, left + 72, dividerY - 90, 9);
      }
      y = dividerY - (receipt.onlineOrder ? 121 : 70);
    } else {
      y = 761;
    }

    page.drawRectangle({ x: left, y: y - 5, width: right - left, height: 25, color: rgb(0.93, 0.96, 0.94) });
    draw(page, bold, "BARANG", left + 8, y + 3, 9, green);
    drawRight(page, bold, "QTY", 354, y + 3, 9, green);
    drawRight(page, bold, "HARGA", 447, y + 3, 9, green);
    drawRight(page, bold, "JUMLAH", right - 8, y + 3, 9, green);
    y -= 28;
  }

  newPage();
  for (const item of receipt.items) {
    const nameLines = wrap(item.name, bold, 10, 255);
    const detail = [item.discountAmount ? `Diskon ${formatCurrency(item.discountAmount)} / item` : "", (item.subtotal ?? item.price * item.quantity) < item.price * item.quantity ? "Harga paket" : ""].filter(Boolean).join(" - ");
    const height = Math.max(31, nameLines.length * 14 + (detail ? 12 : 0) + 12);
    if (y - height < 230) newPage(true);
    const top = y;
    nameLines.forEach((line, index) => draw(page, bold, line, left + 8, top - index * 14, 10));
    drawRight(page, regular, item.quantity, 354, top, 10);
    drawRight(page, regular, formatCurrency(item.price), 447, top, 10);
    drawRight(page, bold, formatCurrency(item.subtotal ?? item.price * item.quantity), right - 8, top, 10);
    if (detail) draw(page, regular, detail, left + 8, top - nameLines.length * 14, 8, muted);
    y -= height;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.5, color: border });
    y -= 12;
  }

  if (y < 360) newPage(true);
  y -= 13;
  const totalRow = (label: string, value: number, emphasis = false) => {
    draw(page, emphasis ? bold : regular, label, 328, y, emphasis ? 13 : 10, emphasis ? green : muted);
    drawRight(page, emphasis ? bold : regular, formatCurrency(value), right - 8, y, emphasis ? 13 : 10, emphasis ? green : ink);
    y -= emphasis ? 24 : 19;
  };
  totalRow("Subtotal", receipt.transaction.subtotal ?? receipt.transaction.total);
  if (receipt.transaction.discountAmount) totalRow("Diskon transaksi", -receipt.transaction.discountAmount);
  page.drawLine({ start: { x: 328, y: y + 18 }, end: { x: right, y: y + 18 }, thickness: 1, color: border });
  totalRow("TOTAL", receipt.transaction.total, true);
  if (receipt.transaction.paidAmount !== null && receipt.transaction.paidAmount !== undefined) totalRow("Dibayar", receipt.transaction.paidAmount);
  if (receipt.transaction.changeAmount !== null && receipt.transaction.changeAmount !== undefined) totalRow("Kembalian", receipt.transaction.changeAmount);

  if (receipt.publicUrl) {
    const qrDataUrl = await QRCode.toDataURL(receipt.publicUrl, { margin: 1, width: 200 });
    const qr = await pdf.embedPng(qrDataUrl);
    page.drawImage(qr, { x: left, y: 96, width: 94, height: 94 });
    draw(page, bold, "Struk digital", left + 108, 158, 10, green);
    draw(page, regular, "Scan QR untuk membuka struk ini kembali.", left + 108, 143, 9, muted);
  }
  draw(page, regular, "Terima kasih sudah berbelanja.", left, 73, 9, muted);
  if (receipt.showWatermark) drawRight(page, bold, receipt.watermarkText || "www.kasir-kita.com", right, 73, 8, muted);

  pdf.getPages().forEach((current, index) => {
    current.drawLine({ start: { x: left, y: 53 }, end: { x: right, y: 53 }, thickness: 0.5, color: border });
    drawRight(current, regular, `Halaman ${index + 1} / ${pdf.getPageCount()}`, right, 38, 8, muted);
  });

  return pdf.save();
}
