/** Parse prices from Excel CSVs that use either Indonesian or English separators. */
export function parseCsvNumber(value: string, rowNumber: number, label: string) {
  const text = value.trim().replace(/^(?:Rp\s*)/i, "").replace(/\s/g, "");
  const invalid = () => Object.assign(new Error(`Baris ${rowNumber}: ${label} harus angka 0 atau lebih.`), { status: 422 });
  if (!/^\d[\d.,]*$/.test(text)) throw invalid();

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  let normalized: string;
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = text.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, "");
  } else {
    normalized = text;
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw invalid();
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(Math.round(parsed)) || parsed < 0) throw invalid();
  return Math.round(parsed);
}

/** Value produced by the old importer when it deleted a decimal comma. */
export function legacyCsvNumber(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
