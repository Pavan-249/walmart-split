import { sumAdjustments, type Adjustment, type Invoice, type LineItem } from "./invoice";
import { computeSplit, type Assignment, type Cents, type FeeMode, type SplitResult } from "./split";

export interface Person {
  id: string;
  name: string;
}

export interface SplitState {
  people: Person[];
  payerId: string;
  assign: Record<string, Assignment>;
  feeMode: FeeMode;
}

/**
 * Everything one split needs, and nothing derived from it, so it can go into
 * localStorage now and into a read-only share link later as is.
 */
export interface SplitDoc {
  v: 1;
  invoice: Invoice;
  split: SplitState;
}

export const DEFAULT_PEOPLE = ["Nithish", "Pavan", "Sai"];
export const DEFAULT_PAYER = "Pavan";

function nextId(prefix: string, taken: string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const everyone = (doc: SplitDoc): Assignment => ({ mode: "even", who: doc.split.people.map((p) => p.id) });

export function newDoc(invoice: Invoice): SplitDoc {
  const people = DEFAULT_PEOPLE.map((name, i) => ({ id: `p${i + 1}`, name }));
  const who = people.map((p) => p.id);
  return {
    v: 1,
    invoice,
    split: {
      people,
      payerId: people.find((p) => p.name === DEFAULT_PAYER)!.id,
      assign: Object.fromEntries(invoice.items.map((it) => [it.id, { mode: "even", who: [...who] }])),
      feeMode: "proportional",
    },
  };
}

export function runSplit(doc: SplitDoc): SplitResult {
  return computeSplit({
    people: doc.split.people.map((p) => p.id),
    items: doc.invoice.items,
    assign: doc.split.assign,
    fees: sumAdjustments(doc.invoice),
    feeMode: doc.split.feeMode,
  });
}

function withInvoice(doc: SplitDoc, invoice: Partial<Invoice>): SplitDoc {
  return { ...doc, invoice: { ...doc.invoice, ...invoice } };
}

function withAssign(doc: SplitDoc, itemId: string, a: Assignment): SplitDoc {
  return { ...doc, split: { ...doc.split, assign: { ...doc.split.assign, [itemId]: a } } };
}

function whoFromCounts(doc: SplitDoc, counts: Record<string, number>): string[] {
  return doc.split.people.map((p) => p.id).filter((id) => (counts[id] ?? 0) > 0);
}

// ---- invoice edits ----

export function updateItem(doc: SplitDoc, id: string, patch: Partial<Pick<LineItem, "name" | "qty" | "price" | "category">>): SplitDoc {
  let next = withInvoice(doc, { items: doc.invoice.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const a = doc.split.assign[id];
  // Unit counts stop making sense when the quantity changes; keep the same people, split evenly.
  if (patch.qty !== undefined && a?.mode === "count") next = withAssign(next, id, { mode: "even", who: whoFromCounts(doc, a.counts) });
  return next;
}

export function addItem(doc: SplitDoc): SplitDoc {
  const id = nextId("i", doc.invoice.items.map((i) => i.id));
  const item: LineItem = { id, name: "", note: "", qty: 1, price: 0, category: "other", key: "" };
  return withAssign(withInvoice(doc, { items: [...doc.invoice.items, item] }), id, everyone(doc));
}

export function removeItem(doc: SplitDoc, id: string): SplitDoc {
  const assign = { ...doc.split.assign };
  delete assign[id];
  return { ...withInvoice(doc, { items: doc.invoice.items.filter((i) => i.id !== id) }), split: { ...doc.split, assign } };
}

export function updateAdjustment(doc: SplitDoc, id: string, patch: Partial<Pick<Adjustment, "label" | "amount">>): SplitDoc {
  return withInvoice(doc, { adjustments: doc.invoice.adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

export function addAdjustment(doc: SplitDoc): SplitDoc {
  const id = nextId("a", doc.invoice.adjustments.map((a) => a.id));
  return withInvoice(doc, { adjustments: [...doc.invoice.adjustments, { id, kind: "other", label: "Other fee", amount: 0 }] });
}

export function removeAdjustment(doc: SplitDoc, id: string): SplitDoc {
  return withInvoice(doc, { adjustments: doc.invoice.adjustments.filter((a) => a.id !== id) });
}

export function setPrinted(doc: SplitDoc, patch: { subtotal?: Cents; total?: Cents }): SplitDoc {
  return withInvoice(doc, patch);
}

// ---- who shares what ----

export function togglePerson(doc: SplitDoc, itemId: string, personId: string): SplitDoc {
  const a = doc.split.assign[itemId];
  const who = a?.mode === "even" ? a.who : [];
  const on = !who.includes(personId);
  const next = doc.split.people.map((p) => p.id).filter((id) => (id === personId ? on : who.includes(id)));
  return withAssign(doc, itemId, { mode: "even", who: next });
}

export function setCountMode(doc: SplitDoc, itemId: string, on: boolean): SplitDoc {
  const a = doc.split.assign[itemId] ?? { mode: "even", who: [] };
  const item = doc.invoice.items.find((i) => i.id === itemId);
  if (!item) return doc;
  if (!on) return withAssign(doc, itemId, { mode: "even", who: a.mode === "count" ? whoFromCounts(doc, a.counts) : a.who });
  if (a.mode === "count") return doc;
  // Start from an even split of the units across whoever shares it now.
  const who = a.who.length ? a.who : doc.split.people.map((p) => p.id);
  const base = Math.floor(item.qty / who.length);
  const extra = item.qty - base * who.length;
  const counts = Object.fromEntries(who.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
  return withAssign(doc, itemId, { mode: "count", counts });
}

export function stepCount(doc: SplitDoc, itemId: string, personId: string, delta: 1 | -1): SplitDoc {
  const a = doc.split.assign[itemId];
  const item = doc.invoice.items.find((i) => i.id === itemId);
  if (a?.mode !== "count" || !item) return doc;
  const used = Object.values(a.counts).reduce((s, c) => s + c, 0);
  const mine = a.counts[personId] ?? 0;
  if ((delta > 0 && used >= item.qty) || (delta < 0 && mine === 0)) return doc;
  return withAssign(doc, itemId, { mode: "count", counts: { ...a.counts, [personId]: mine + delta } });
}

export function resetAssignments(doc: SplitDoc): SplitDoc {
  return { ...doc, split: { ...doc.split, assign: Object.fromEntries(doc.invoice.items.map((i) => [i.id, everyone(doc)])) } };
}

export function setFeeMode(doc: SplitDoc, feeMode: FeeMode): SplitDoc {
  return { ...doc, split: { ...doc.split, feeMode } };
}

// ---- people ----

/** The new person joins every item that everyone currently shares. Items split some other way stay as they are. */
export function addPerson(doc: SplitDoc, name: string): SplitDoc {
  const ids = doc.split.people.map((p) => p.id);
  const id = nextId("p", ids);
  const assign = Object.fromEntries(
    Object.entries(doc.split.assign).map(([itemId, a]) => [
      itemId,
      a.mode === "even" && ids.every((p) => a.who.includes(p)) ? { mode: "even", who: [...a.who, id] } : a,
    ]),
  ) as Record<string, Assignment>;
  return { ...doc, split: { ...doc.split, people: [...doc.split.people, { id, name }], assign } };
}

export function renamePerson(doc: SplitDoc, id: string, name: string): SplitDoc {
  return { ...doc, split: { ...doc.split, people: doc.split.people.map((p) => (p.id === id ? { ...p, name } : p)) } };
}

export function removePerson(doc: SplitDoc, id: string): SplitDoc {
  const people = doc.split.people.filter((p) => p.id !== id);
  if (people.length === 0) return doc;
  const assign = Object.fromEntries(
    Object.entries(doc.split.assign).map(([itemId, a]) => {
      if (a.mode === "even") return [itemId, { mode: "even", who: a.who.filter((w) => w !== id) }];
      const counts = { ...a.counts };
      delete counts[id];
      return [itemId, { mode: "count", counts }];
    }),
  ) as Record<string, Assignment>;
  const payerId = doc.split.payerId === id ? people[0].id : doc.split.payerId;
  return { ...doc, split: { ...doc.split, people, assign, payerId } };
}

export function setPayer(doc: SplitDoc, payerId: string): SplitDoc {
  return { ...doc, split: { ...doc.split, payerId } };
}
