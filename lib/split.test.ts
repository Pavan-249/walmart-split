import { describe, expect, it } from "vitest";
import { allocate, computeSplit, type Assignment, type SplitInput, type SplitResult } from "./split";

const P = ["n", "p", "s"];
const all = (): Assignment => ({ mode: "even", who: [...P] });

function totals(r: SplitResult) {
  return Object.fromEntries(Object.entries(r.people).map(([id, t]) => [id, t.total]));
}

function expectBalanced(r: SplitResult) {
  const people = Object.values(r.people).reduce((a, t) => a + t.total, 0);
  expect(people + r.unassigned.total).toBe(r.total);
  for (const t of Object.values(r.people)) {
    expect(t.items.reduce((a, s) => a + s.cents, 0)).toBe(t.itemsCents);
    expect(t.itemsCents + t.feesCents).toBe(t.total);
  }
}

function split(partial: Partial<SplitInput> & Pick<SplitInput, "items" | "assign">): SplitResult {
  const r = computeSplit({ people: P, fees: 0, feeMode: "proportional", ...partial });
  expectBalanced(r);
  return r;
}

describe("allocate", () => {
  it("always sums to the amount", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(797, [1, 1, 1])).toEqual([266, 266, 265]);
    expect(allocate(5, [0, 3, 0])).toEqual([0, 5, 0]);
  });

  it("gives the leftover cent to the largest remainder first", () => {
    // 100 × 2/3 = 66.67, 100 × 1/3 = 33.33 → the 2/3 share takes the cent
    expect(allocate(100, [1, 2])).toEqual([33, 67]);
  });

  it("rotates ties", () => {
    expect(allocate(100, [1, 1, 1], 1)).toEqual([33, 34, 33]);
    expect(allocate(100, [1, 1, 1], 2)).toEqual([33, 33, 34]);
  });

  it("mirrors negative amounts", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });
});

describe("computeSplit", () => {
  it("splits evenly", () => {
    const r = split({ items: [{ id: "a", qty: 1, price: 900 }], assign: { a: all() } });
    expect(totals(r)).toEqual({ n: 300, p: 300, s: 300 });
    expect(r.people.n.items[0].how).toEqual({ kind: "even", of: 3 });
  });

  it("splits uneven counts", () => {
    const r = split({
      items: [
        { id: "yogurt", qty: 6, price: 1968 },
        { id: "salsa", qty: 3, price: 1000 },
      ],
      assign: {
        yogurt: { mode: "count", counts: { p: 4, s: 2 } },
        salsa: { mode: "count", counts: { n: 2, s: 1 } },
      },
    });
    expect(totals(r)).toEqual({ n: 667, p: 1312, s: 656 + 333 });
    expect(r.people.p.items[0].how).toEqual({ kind: "count", units: 4, of: 6 });
    expect(r.people.n.items.map((s) => s.itemId)).toEqual(["salsa"]);
  });

  it("spreads fees by what each person bought", () => {
    const r = split({
      items: [
        { id: "a", qty: 1, price: 1000 },
        { id: "b", qty: 1, price: 3000 },
      ],
      assign: { a: { mode: "even", who: ["n"] }, b: { mode: "even", who: ["p"] } },
      fees: 168,
    });
    expect(r.people.n.feesCents).toBe(42);
    expect(r.people.p.feesCents).toBe(126);
    expect(r.people.s.feesCents).toBe(0);
    expect(totals(r)).toEqual({ n: 1042, p: 3126, s: 0 });
  });

  it("splits fees equally", () => {
    const r = split({
      items: [{ id: "a", qty: 1, price: 1000 }],
      assign: { a: { mode: "even", who: ["n"] } },
      fees: 100,
      feeMode: "equal",
    });
    expect([r.people.n.feesCents, r.people.p.feesCents, r.people.s.feesCents]).toEqual([34, 33, 33]);
    expect(totals(r)).toEqual({ n: 1034, p: 33, s: 33 });
  });

  it("handles savings that outweigh fees", () => {
    const items = [
      { id: "a", qty: 1, price: 2000 },
      { id: "b", qty: 1, price: 1000 },
    ];
    const assign = { a: { mode: "even", who: ["n", "p"] } as Assignment, b: { mode: "even", who: ["s"] } as Assignment };
    const prop = split({ items, assign, fees: -250 });
    expect(prop.people.n.feesCents + prop.people.p.feesCents + prop.people.s.feesCents).toBe(-250);
    for (const t of Object.values(prop.people)) expect(t.feesCents).toBeLessThanOrEqual(0);
    expect(prop.people.s.feesCents).toBe(-83);
    expect(prop.total).toBe(2750);

    const eq = split({ items, assign, fees: -100, feeMode: "equal" });
    expect([eq.people.n.feesCents, eq.people.p.feesCents, eq.people.s.feesCents]).toEqual([-34, -33, -33]);
  });

  it("splits $1.00 three ways and rotates the extra cent", () => {
    const one = split({ items: [{ id: "a", qty: 1, price: 100 }], assign: { a: all() } });
    expect(totals(one)).toEqual({ n: 34, p: 33, s: 33 });

    const three = split({
      items: ["a", "b", "c"].map((id) => ({ id, qty: 1, price: 100 })),
      assign: { a: all(), b: all(), c: all() },
    });
    expect(totals(three)).toEqual({ n: 100, p: 100, s: 100 });
  });

  it("keeps unassigned items and leftover units apart", () => {
    const r = split({
      items: [
        { id: "a", qty: 1, price: 900 },
        { id: "b", qty: 1, price: 500 },
        { id: "c", qty: 6, price: 600 },
      ],
      assign: {
        a: all(),
        b: { mode: "even", who: [] },
        c: { mode: "count", counts: { p: 4 } },
      },
      fees: 200,
    });
    expect(r.unassigned.itemIds).toEqual(["b", "c"]);
    expect(r.unassigned.itemsCents).toBe(500 + 200);
    expect(r.unassigned.feesCents).toBe(70);
    expect(r.unassigned.total).toBe(770);
    expect(totals(r)).toEqual({ n: 300 + 30, p: 300 + 400 + 70, s: 300 + 30 });
    expect(r.total).toBe(2200);
  });

  it("treats an item with no assignment as unassigned", () => {
    const r = split({ items: [{ id: "a", qty: 1, price: 250 }], assign: {}, fees: 30 });
    expect(r.unassigned.total).toBe(280);
    expect(totals(r)).toEqual({ n: 0, p: 0, s: 0 });
  });

  it("matches the invoice total on the Walmart order", () => {
    // 34 items, $140.39, net fees $1.68, total $142.07
    const prices = [797, 697, 297, 172, 196, 492, 247, 696, 98, 100, 232, 188, 228, 413, 596, 202, 297, 197, 212,
      594, 208, 804, 1968, 257, 392, 97, 264, 298, 197, 476, 1357, 392, 214, 164];
    const items = prices.map((price, i) => ({ id: `i${i}`, qty: 1, price }));
    const assign = Object.fromEntries(items.map((it, i) => [it.id, i === 30 ? { mode: "even", who: ["p"] } as Assignment : all()]));
    for (const feeMode of ["proportional", "equal"] as const) {
      const r = split({ items, assign, fees: -63 + 128 + 103, feeMode });
      expect(r.total).toBe(14207);
      expect(r.unassigned.total).toBe(0);
      expect(Object.values(totals(r)).reduce((a, c) => a + c, 0)).toBe(14207);
    }
  });

  it("keeps people who share everything within a cent", () => {
    const prices = [797, 697, 297, 172, 196, 492, 247, 696, 98, 100, 232, 188, 228, 413, 596, 202, 297, 197, 212,
      594, 208, 804, 1968, 257, 392, 97, 264, 298, 197, 476, 1357, 392, 214, 164];
    const items = prices.map((price, i) => ({ id: `i${i}`, qty: 1, price }));
    const r = split({ items, assign: Object.fromEntries(items.map((it) => [it.id, all()])), fees: 168 });
    const t = Object.values(totals(r));
    expect(Math.max(...t) - Math.min(...t)).toBeLessThanOrEqual(1);
  });

  it("stays balanced on random splits", () => {
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    for (let round = 0; round < 300; round++) {
      const items = Array.from({ length: 1 + rand(12) }, (_, i) => {
        const qty = 1 + rand(8);
        return { id: `i${i}`, qty, price: rand(5000) - (rand(10) === 0 ? 2000 : 0) };
      });
      const assign: Record<string, Assignment> = {};
      for (const it of items) {
        assign[it.id] =
          rand(2) === 0
            ? { mode: "even", who: P.filter(() => rand(3) > 0) }
            : { mode: "count", counts: Object.fromEntries(P.map((p) => [p, rand(it.qty + 1)])) };
      }
      split({ items, assign, fees: rand(1000) - 500, feeMode: rand(2) ? "proportional" : "equal" });
    }
  });
});
