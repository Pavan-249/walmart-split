import { categorize, productKey } from "./categorize";
import { parseMoney } from "./format";
import type { AdjKind, Adjustment, Category, Invoice, LineItem } from "./invoice";
import type { TextLine } from "./pdf-lines";

// Reads the PDF you get from printing a walmart.com order page. Item rows look like
//   <title>   <n> shopped | substituted | weight adjusted   Qty <n>   $<line total>
// and the totals block below them like
//   Subtotal $140.39 · Savings -$0.63 · Free delivery from store $9.95 $0 · Bag fee $1.28 · Taxes $1.03 · Driver tip $0.00 · Total $142.07
// The Buyer block (name and address) sits above the first item and is never read.

export class NotAWalmartOrder extends Error {}

const MONEY = /^[-−]?\$\s?\d[\d,]*(?:\.\d{2})?$/;
const QTY = /^Qty\s*(\d+)$/i;
const STATUS = /^(?:\d+\s+)?(shopped|substituted|weight adjusted|unavailable|out of stock|refunded|returned|cancell?ed)$/i;
const NOT_CHARGED = /unavailable|out of stock|refunded|returned|cancel/i;
const SIZE =
  /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*-?\s*(?:fl\.?\s*oz|oz|lbs?\.?|count|ct|grams?|g|kg|ml|l|pack|pk|rolls?|ply|bunch|each)\b|^(?:each|bunch)$/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const isMoney = (s: string) => MONEY.test(s);
const text = (l: TextLine) => l.cells.join(" ");

/** Splits "Fresh Banana $2.14"-style cells so every dollar amount is a cell of its own. */
function normalize(lines: TextLine[]): TextLine[] {
  return lines.map((l) => ({ ...l, cells: l.cells.flatMap((c) => c.split(/\s+(?=[-−]?\$\d)/)) }));
}

function isItemRow(l: TextLine): boolean {
  const q = l.cells.findIndex((c) => QTY.test(c));
  return q !== -1 && l.cells.slice(q + 1).some(isMoney);
}

/** "Great Value Greek Plain Nonfat Yogurt, 32 oz Tub" → name + "32 oz Tub". The first part always stays in the name. */
export function splitTitle(title: string): { name: string; size: string[] } {
  const [first, ...rest] = title.split(/,\s+/);
  const name = [first];
  const size: string[] = [];
  for (const part of rest) (SIZE.test(part) ? size : name).push(part);
  return { name: name.join(", "), size };
}

function parseDate(lines: TextLine[]): string | null {
  for (const l of lines) {
    const m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4})(?: order)?$/i.exec(text(l));
    const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    if (m && month !== -1) return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function parseOrderNumber(lines: TextLine[]): string | null {
  for (const l of lines) {
    const m = /^Order\s*#\s*([\d-]+)$/i.exec(text(l));
    if (m) return m[1];
  }
  return null;
}

function adjustmentKind(label: string): AdjKind {
  if (/saving|discount|promo|coupon/i.test(label)) return "savings";
  if (/deliver/i.test(label)) return "delivery";
  if (/\bbag/i.test(label)) return "bag_fee";
  if (/tax/i.test(label)) return "tax";
  if (/\btip\b/i.test(label)) return "tip";
  if (/service/i.test(label)) return "service_fee";
  return "other";
}

export function parseWalmart(raw: TextLine[], remembered: Record<string, Category> = {}): Invoice {
  const lines = normalize(raw);
  const subIdx = lines.findIndex((l) => /^subtotal$/i.test(l.cells[0] ?? ""));
  const body = subIdx === -1 ? lines : lines.slice(0, subIdx);
  const footer = subIdx === -1 ? [] : lines.slice(subIdx);

  const anchors = body.filter(isItemRow);
  if (anchors.length === 0) {
    throw new NotAWalmartOrder("No items found. This doesn't look like a walmart.com order PDF.");
  }

  // A long title can wrap onto rows of its own above or below the row with the
  // quantity and price. Give each text-only row to the nearest item row on the
  // same page, if it's close enough to be part of it.
  const gaps = anchors
    .slice(1)
    .map((a, i) => (a.page === anchors[i].page ? anchors[i].y - a.y : Infinity))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const reach = Math.min(14, gaps.length ? gaps[Math.floor(gaps.length / 2)] * 0.6 : 14);
  const wraps = new Map<TextLine, TextLine[]>(anchors.map((a) => [a, []]));
  for (const l of body) {
    if (wraps.has(l) || l.cells.some(isMoney) || l.cells.every((c) => STATUS.test(c))) continue;
    let best: TextLine | null = null;
    for (const a of anchors) {
      if (a.page === l.page && Math.abs(a.y - l.y) <= reach && (!best || Math.abs(a.y - l.y) < Math.abs(best.y - l.y))) best = a;
    }
    if (best) wraps.get(best)!.push(l);
  }

  const items: LineItem[] = [];
  for (const a of anchors) {
    const q = a.cells.findIndex((c) => QTY.test(c));
    const status = a.cells.filter((c) => STATUS.test(c)).map((c) => c.replace(/^\d+\s+/, "").toLowerCase());
    const amounts = a.cells.slice(q + 1).filter(isMoney);
    const price = parseMoney(amounts[amounts.length - 1]);
    if (price === null || status.some((s) => NOT_CHARGED.test(s))) continue;

    const own = a.cells.slice(0, q).filter((c) => !STATUS.test(c) && !isMoney(c)).join(" ");
    const parts = [...wraps.get(a)!.map((l) => ({ y: l.y, s: text(l) })), { y: a.y, s: own }]
      .filter((p) => p.s)
      .sort((x, y) => y.y - x.y);
    const title = parts.map((p) => p.s).join(" ");
    const { name, size } = splitTitle(title);
    const key = productKey(title);
    items.push({
      id: `i${items.length + 1}`,
      name,
      note: [...size, ...status.filter((s) => s !== "shopped")].join(" · "),
      qty: Number(QTY.exec(a.cells[q])![1]),
      price,
      category: remembered[key] ?? categorize(title),
      key,
    });
  }

  let subtotal: number | null = null;
  let total: number | null = null;
  let tipAfterTotal = 0;
  const adjustments: Adjustment[] = [];
  footer.forEach((l, i) => {
    const amounts = l.cells.filter(isMoney).map((c) => parseMoney(c)!);
    const label = l.cells.filter((c) => !isMoney(c)).join(" ").trim();
    if (!amounts.length || !label) return; // e.g. the unlabeled subtotal-after-savings line
    const amount = amounts[amounts.length - 1];
    if (/^subtotal$/i.test(label)) subtotal ??= amount;
    else if (/^total$/i.test(label)) total ??= amount;
    else {
      const kind = adjustmentKind(label);
      if (kind === "tip") {
        if (amount === 0) return;
        if (/charged separately/i.test(footer[i + 1] ? text(footer[i + 1]) : "")) tipAfterTotal += amount;
      }
      adjustments.push({
        id: `a${adjustments.length + 1}`,
        kind,
        // "Free delivery from store $9.95 $0": the first amount is struck through
        label: kind === "delivery" && amount === 0 ? "Delivery (waived)" : kind === "tip" ? "Driver tip" : label,
        amount: kind === "savings" ? -Math.abs(amount) : amount,
      });
    }
  });

  return {
    store: "Walmart",
    orderDate: parseDate(body),
    orderNumber: parseOrderNumber(body),
    items,
    adjustments,
    subtotal: subtotal ?? 0,
    // A tip charged after delivery isn't in Walmart's total, but it's still part of the bill.
    total: (total ?? 0) + tipAfterTotal,
  };
}
