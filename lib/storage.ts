import type { SplitDoc } from "./doc";
import { ADJ_KINDS, CATEGORIES, type Category } from "./invoice";

const DOC_KEY = "walmart-split:doc:v1";
const CATEGORY_KEY = "walmart-split:categories:v1";

// localStorage can be missing, full, or blocked (private mode); every access is best effort.

export function loadDoc(): SplitDoc | null {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    return raw ? asDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveDoc(doc: SplitDoc | null): void {
  try {
    if (doc) localStorage.setItem(DOC_KEY, JSON.stringify(doc));
    else localStorage.removeItem(DOC_KEY);
  } catch {}
}

export function loadCategoryMemory(): Record<string, Category> {
  try {
    const raw = JSON.parse(localStorage.getItem(CATEGORY_KEY) ?? "{}");
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isCategory(v))) as Record<string, Category>;
  } catch {
    return {};
  }
}

export function rememberCategory(key: string, category: Category): void {
  if (!key) return;
  try {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify({ ...loadCategoryMemory(), [key]: category }));
  } catch {}
}

// ---- validation: stored data is only trusted after it checks out ----

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const isInt = (x: unknown): x is number => Number.isInteger(x);
const isCategory = (x: unknown): x is Category => CATEGORIES.some((c) => c.id === x);
const strOrNull = (x: unknown) => x === null || isStr(x);

export function asDoc(x: unknown): SplitDoc | null {
  if (!isObj(x) || x.v !== 1 || !isObj(x.invoice) || !isObj(x.split)) return null;
  const inv = x.invoice;
  const split = x.split;
  const itemsOk =
    Array.isArray(inv.items) &&
    inv.items.every(
      (i: unknown) =>
        isObj(i) && isStr(i.id) && isStr(i.name) && isStr(i.note) && isStr(i.key) && isInt(i.qty) && (i.qty as number) >= 1 && isInt(i.price) && isCategory(i.category),
    );
  const adjOk =
    Array.isArray(inv.adjustments) &&
    inv.adjustments.every((a: unknown) => isObj(a) && isStr(a.id) && isStr(a.label) && isInt(a.amount) && ADJ_KINDS.includes(a.kind as never));
  const invOk = itemsOk && adjOk && isStr(inv.store) && strOrNull(inv.orderDate) && strOrNull(inv.orderNumber) && isInt(inv.subtotal) && isInt(inv.total);

  const peopleOk = Array.isArray(split.people) && split.people.length > 0 && split.people.every((p: unknown) => isObj(p) && isStr(p.id) && isStr(p.name));
  const assignOk =
    isObj(split.assign) &&
    Object.values(split.assign).every(
      (a) =>
        isObj(a) &&
        ((a.mode === "even" && Array.isArray(a.who) && a.who.every(isStr)) ||
          (a.mode === "count" && isObj(a.counts) && Object.values(a.counts).every((c) => isInt(c) && c >= 0))),
    );
  const splitOk = peopleOk && assignOk && isStr(split.payerId) && (split.feeMode === "proportional" || split.feeMode === "equal");

  return invOk && splitOk ? (x as unknown as SplitDoc) : null;
}
