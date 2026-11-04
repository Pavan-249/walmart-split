/** Integer cents. Every stored and computed amount in the app is one. */
export type Cents = number;

export type Assignment =
  | { mode: "even"; who: string[] }
  | { mode: "count"; counts: Record<string, number> };

export type FeeMode = "proportional" | "equal";

export interface SplitInput {
  /** Person ids in display order. */
  people: string[];
  items: { id: string; qty: number; price: Cents }[];
  assign: Record<string, Assignment | undefined>;
  /** Net of every fee, tax and saving on the invoice. Negative when savings win. */
  fees: Cents;
  feeMode: FeeMode;
}

export type How =
  | { kind: "even"; of: number }
  | { kind: "count"; units: number; of: number };

export interface Share {
  itemId: string;
  cents: Cents;
  how: How;
}

export interface PersonTotal {
  items: Share[];
  itemsCents: Cents;
  feesCents: Cents;
  total: Cents;
}

export interface SplitResult {
  people: Record<string, PersonTotal>;
  /** Items (or leftover units) nobody has taken yet, with their share of the fees. */
  unassigned: { itemIds: string[]; itemsCents: Cents; feesCents: Cents; total: Cents };
  /** Items plus fees. Always equals the people's totals plus unassigned.total. */
  total: Cents;
}

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

/**
 * Split `amount` into integer parts in proportion to non-negative integer
 * `weights`, using largest-remainder rounding, so the parts always add up to
 * `amount` exactly. A leftover cent that ties goes to the earliest index after
 * rotating the order by `rotate`.
 */
export function allocate(amount: Cents, weights: number[], rotate = 0): Cents[] {
  return allocateCounting(amount, weights, rotate).parts;
}

function allocateCounting(amount: Cents, weights: number[], rotate: number): { parts: Cents[]; extra: number } {
  const n = weights.length;
  const total = sum(weights);
  if (n === 0 || total <= 0) throw new Error("allocate needs a positive total weight");
  if (amount < 0) {
    const { parts, extra } = allocateCounting(-amount, weights, rotate);
    return { parts: parts.map((c) => (c === 0 ? 0 : -c)), extra };
  }

  const rems = weights.map((w) => (amount * w) % total);
  const parts = weights.map((w, i) => (amount * w - rems[i]) / total);
  const extra = amount - sum(parts);
  const turn = (i: number) => (((i - rotate) % n) + n) % n;
  const order = weights.map((_, i) => i).sort((a, b) => rems[b] - rems[a] || turn(a) - turn(b));
  for (let k = 0; k < extra; k++) parts[order[k]]++;
  return { parts, extra };
}

export function computeSplit({ people, items, assign, fees, feeMode }: SplitInput): SplitResult {
  const out: Record<string, PersonTotal> = Object.fromEntries(
    people.map((id) => [id, { items: [], itemsCents: 0, feesCents: 0, total: 0 }]),
  );
  const unassigned = { itemIds: [] as string[], itemsCents: 0, feesCents: 0, total: 0 };
  // Leftover pennies go round-robin across the whole receipt, so people who
  // share everything end up within a cent of each other.
  let penny = 0;

  items.forEach((item) => {
    const a = assign[item.id];
    let weights: number[];
    let unWeight = 0;
    let how: (units: number) => How;

    if (a?.mode === "count") {
      weights = people.map((id) => Math.max(0, Math.floor(a.counts[id] ?? 0)));
      const used = sum(weights);
      unWeight = Math.max(0, item.qty - used);
      const of = Math.max(item.qty, used);
      how = (units) => ({ kind: "count", units, of });
    } else {
      const who = new Set(a?.who ?? []);
      weights = people.map((id) => (who.has(id) ? 1 : 0));
      const of = sum(weights);
      how = () => ({ kind: "even", of });
    }
    if (sum(weights) + unWeight === 0) unWeight = 1;

    const { parts, extra } = allocateCounting(item.price, [...weights, unWeight], people.length ? penny % people.length : 0);
    penny += extra;
    people.forEach((id, i) => {
      if (weights[i] === 0) return;
      out[id].items.push({ itemId: item.id, cents: parts[i], how: how(weights[i]) });
      out[id].itemsCents += parts[i];
    });
    if (unWeight > 0) {
      unassigned.itemIds.push(item.id);
      unassigned.itemsCents += parts[people.length];
    }
  });

  // Fees follow what each person bought, unassigned items included, so the
  // numbers don't jump when the last item gets someone. Equal split, or a
  // receipt where nothing has a positive price yet, shares them evenly.
  let weights =
    feeMode === "proportional"
      ? [...people.map((id) => Math.max(0, out[id].itemsCents)), Math.max(0, unassigned.itemsCents)]
      : [];
  if (sum(weights) === 0) weights = people.length ? [...people.map(() => 1), 0] : [1];
  const feeParts = allocate(fees, weights);
  people.forEach((id, i) => {
    out[id].feesCents = feeParts[i];
    out[id].total = out[id].itemsCents + feeParts[i];
  });
  unassigned.feesCents = feeParts[people.length] ?? 0;
  unassigned.total = unassigned.itemsCents + unassigned.feesCents;

  return { people: out, unassigned, total: sum(items.map((i) => i.price)) + fees };
}
