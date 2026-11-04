import type { Cents } from "./split";

const MINUS = "−";

/** 14207 → "$142.07", -63 → "−$0.63" */
export function fmt(c: Cents): string {
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${c < 0 ? MINUS : ""}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/** The plain form shown in a price field: -63 → "-0.63" */
export function toInput(c: Cents): string {
  const abs = Math.abs(c);
  return `${c < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "$1,234.5" → 123450, "-$0.63" → -63, "7" → 700. Null when it isn't an amount. */
export function parseMoney(raw: string): Cents | null {
  const s = raw.trim().replace(/[−–]/g, "-").replace(/[$,\s]/g, "");
  const m = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (m[2] === "" && !m[3])) return null;
  const cents = Number(m[2] || "0") * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return m[1] && cents ? -cents : cents;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-02" → "Nov 2" */
export function shortDate(iso: string | null): string | null {
  const m = iso && /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : null;
}
