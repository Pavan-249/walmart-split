import type { Cents } from "./split";

export const CATEGORIES = [
  { id: "meat", label: "Meat" },
  { id: "produce", label: "Produce" },
  { id: "dairy", label: "Dairy & eggs" },
  { id: "frozen", label: "Frozen" },
  { id: "bakery", label: "Bakery & breakfast" },
  { id: "pantry", label: "Pantry" },
  { id: "household", label: "Household" },
  { id: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

export const ADJ_KINDS = ["savings", "bag_fee", "delivery", "service_fee", "tip", "tax", "other"] as const;
export type AdjKind = (typeof ADJ_KINDS)[number];

export interface LineItem {
  id: string;
  name: string;
  /** Size, and anything Walmart flagged ("substituted", "weight adjusted"). */
  note: string;
  qty: number;
  /** Line total as charged, for all units. */
  price: Cents;
  category: Category;
  /** The product title as printed, lowercased. Remembers category fixes across orders. */
  key: string;
}

export interface Adjustment {
  id: string;
  kind: AdjKind;
  label: string;
  /** Negative for savings. */
  amount: Cents;
}

export interface Invoice {
  store: string;
  /** YYYY-MM-DD */
  orderDate: string | null;
  orderNumber: string | null;
  items: LineItem[];
  adjustments: Adjustment[];
  subtotal: Cents;
  total: Cents;
}

export const sumItems = (inv: Invoice): Cents => inv.items.reduce((a, i) => a + i.price, 0);
export const sumAdjustments = (inv: Invoice): Cents => inv.adjustments.reduce((a, x) => a + x.amount, 0);

export interface Reconciliation {
  itemsSum: Cents;
  adjSum: Cents;
  /** Items minus the printed subtotal. Positive means the items add up to more. */
  subtotalGap: Cents;
  /** Subtotal plus adjustments minus the printed total. */
  totalGap: Cents;
  ok: boolean;
}

export function reconcile(inv: Invoice): Reconciliation {
  const itemsSum = sumItems(inv);
  const adjSum = sumAdjustments(inv);
  const subtotalGap = itemsSum - inv.subtotal;
  const totalGap = inv.subtotal + adjSum - inv.total;
  return { itemsSum, adjSum, subtotalGap, totalGap, ok: subtotalGap === 0 && totalGap === 0 };
}

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}
