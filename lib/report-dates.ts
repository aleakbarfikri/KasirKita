const jakartaDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function jakartaDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = jakartaDateFormatter.formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((row) => row.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDateKey(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
