import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categorize } from "./categorize";
import { reconcile, type Invoice } from "./invoice";
import { deserializeLines, readPdfLines, type TextLine } from "./pdf-lines";
import { NotAWalmartOrder, parseWalmart, splitTitle } from "./walmart";

const TEXT = "fixtures/walmart-2026-11-02.txt";
// The real PDF has a home address on it, so it's gitignored. This test runs only where it exists.
const PDF = "fixtures/walmart-2026-11-02.pdf";

function expectNov2Order(inv: Invoice) {
  expect(inv.items).toHaveLength(34);
  expect(inv.orderDate).toBe("2026-11-02");
  expect(inv.subtotal).toBe(14039);
  expect(inv.total).toBe(14207);
  expect(inv.adjustments.map((a) => [a.kind, a.label, a.amount])).toEqual([
    ["savings", "Savings", -63],
    ["delivery", "Delivery (waived)", 0],
    ["bag_fee", "Bag fee", 128],
    ["tax", "Taxes", 103],
  ]);
  expect(reconcile(inv)).toMatchObject({ itemsSum: 14039, adjSum: 168, ok: true });
}

describe("the Nov 2 order", () => {
  const inv = parseWalmart(deserializeLines(readFileSync(TEXT, "utf8")));

  it("has every item, fee and total", () => {
    expectNov2Order(inv);
    expect(inv.orderNumber).toBe("1234567-89012345");
  });

  it("reads names, sizes, quantities and flags", () => {
    const byName = (n: string) => inv.items.find((i) => i.name === n);
    expect(byName("Great Value Greek Plain Nonfat Yogurt")).toMatchObject({ qty: 6, price: 1968, note: "32 oz Tub", category: "dairy" });
    expect(byName("Roxy, Organic, Free Range, Fresh Boneless Skinless Chicken Thighs")).toMatchObject({
      note: "1.00-2.20 lbs. Tray · substituted",
      category: "meat",
    });
    expect(byName("Fresh Banana")).toMatchObject({ qty: 22, price: 214, note: "Each · weight adjusted", category: "produce" });
    expect(byName("Toilet Paper")).toMatchObject({ qty: 2, note: "4 Rolls · 150 2-Ply Sheets per Roll", category: "household" });
    expect(byName("FESTIVE Ground Turkey, Frozen")).toMatchObject({ qty: 3, price: 594, category: "meat" });
  });

  it("puts most items in the right aisle", () => {
    const count = (c: string) => inv.items.filter((i) => i.category === c).length;
    expect(count("other")).toBe(0);
    expect(count("household")).toBe(3);
    expect(count("bakery")).toBe(4);
    expect(count("meat")).toBe(3);
  });

  it("uses remembered category fixes", () => {
    const key = inv.items.find((i) => i.name === "Great Value Sliced Bananas")!.key;
    const again = parseWalmart(deserializeLines(readFileSync(TEXT, "utf8")), { [key]: "frozen" });
    expect(again.items.find((i) => i.key === key)!.category).toBe("frozen");
  });
});

describe.skipIf(!existsSync(PDF))("the real PDF", () => {
  it("parses the same as the text fixture", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const inv = parseWalmart(await readPdfLines(new Uint8Array(readFileSync(PDF)), pdfjs));
    expectNov2Order(inv);
    expect(inv.orderNumber).toMatch(/^\d{7}-\d{8}$/);
    const fromText = parseWalmart(deserializeLines(readFileSync(TEXT, "utf8")));
    expect(inv.items).toEqual(fromText.items);
  });
});

const row = (y: number, ...cells: string[]): TextLine => ({ page: 1, y, cells });

describe("parseWalmart on other layouts", () => {
  const totals = (y: number, sub: string, total: string) => [row(y, "Subtotal", sub), row(y - 20, "Total", total)];

  it("joins a title that wraps around its price row", () => {
    const inv = parseWalmart([
      row(906, "Great Value Frozen California Style"),
      row(900, "52 shopped", "Qty 6", "$6.96"),
      row(894, "Vegetable Mix, 12 oz (Frozen)"),
      row(870, "Fresh Banana, Each", "Qty 3", "$0.75"),
      ...totals(800, "$7.71", "$7.71"),
    ]);
    expect(inv.items.map((i) => [i.name, i.note])).toEqual([
      ["Great Value Frozen California Style Vegetable Mix", "12 oz (Frozen)"],
      ["Fresh Banana", "Each"],
    ]);
  });

  it("skips items that weren't charged", () => {
    const inv = parseWalmart([
      row(900, "Fresh Gala Apples, 3 lb Bag", "Unavailable", "Qty 1", "$4.76"),
      row(880, "Fresh Banana, Each", "52 shopped", "Qty 1", "$0.25"),
      ...totals(800, "$0.25", "$0.25"),
    ]);
    expect(inv.items.map((i) => i.name)).toEqual(["Fresh Banana"]);
  });

  it("adds a tip charged after delivery to the total", () => {
    const inv = parseWalmart([
      row(900, "Fresh Banana, Each", "Qty 4", "$1.00"),
      row(800, "Subtotal", "$1.00"),
      row(780, "Driver tip", "$5.00"),
      row(770, "(charged separately after delivery)"),
      row(740, "Total", "$1.00"),
    ]);
    expect(inv.adjustments).toEqual([{ id: "a1", kind: "tip", label: "Driver tip", amount: 500 }]);
    expect(inv.total).toBe(600);
    expect(reconcile(inv).ok).toBe(true);
  });

  it("keeps unknown fees so the total check can catch them", () => {
    const inv = parseWalmart([
      row(900, "Fresh Banana, Each", "Qty 4", "$1.00"),
      row(800, "Subtotal", "$1.00"),
      row(780, "Express fee", "$9.95"),
      row(740, "Total", "$10.95"),
    ]);
    expect(inv.adjustments).toEqual([{ id: "a1", kind: "other", label: "Express fee", amount: 995 }]);
    expect(reconcile(inv).ok).toBe(true);
  });

  it("rejects a PDF with no item rows", () => {
    expect(() => parseWalmart([row(900, "Hello"), row(800, "Total", "$1.00")])).toThrow(NotAWalmartOrder);
  });
});

describe("splitTitle", () => {
  it("moves sizes out of the name", () => {
    expect(splitTitle("Franz Premium Everything Bagels, 18 oz, 6 Count")).toEqual({
      name: "Franz Premium Everything Bagels",
      size: ["18 oz", "6 Count"],
    });
    expect(splitTitle("Fresh Whole Green Cilantro Bunch, 1 Bunch, Fresh Produce")).toEqual({
      name: "Fresh Whole Green Cilantro Bunch, Fresh Produce",
      size: ["1 Bunch"],
    });
    expect(splitTitle("Yellow Potatoes Whole Fresh, 3lb Bag").size).toEqual(["3lb Bag"]);
  });
});

describe("categorize", () => {
  it("checks spices before produce and meat before frozen", () => {
    expect(categorize("Great Value Ground Ginger, 1.5 oz")).toBe("pantry");
    expect(categorize("FESTIVE Ground Turkey, Frozen, 1 lb Roll")).toBe("meat");
    expect(categorize("Great Value Complete Pancake & Waffle Mix, Buttermilk, 32 oz")).toBe("bakery");
    expect(categorize("Mystery Gadget")).toBe("other");
  });
});
