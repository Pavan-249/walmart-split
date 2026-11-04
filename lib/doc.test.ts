import { describe, expect, it } from "vitest";
import { addPerson, newDoc, removePerson, runSplit, setCountMode, stepCount, togglePerson, updateItem } from "./doc";
import type { Invoice } from "./invoice";
import { asDoc } from "./storage";
import { summaryText } from "./summary";

const invoice: Invoice = {
  store: "Walmart",
  orderDate: "2026-11-02",
  orderNumber: null,
  items: [
    { id: "i1", name: "Yogurt", note: "", qty: 6, price: 1968, category: "dairy", key: "yogurt" },
    { id: "i2", name: "Chicken", note: "", qty: 1, price: 1357, category: "meat", key: "chicken" },
  ],
  adjustments: [{ id: "a1", kind: "tax", label: "Taxes", amount: 103 }],
  subtotal: 3325,
  total: 3428,
};

describe("SplitDoc edits", () => {
  it("starts with everyone on everything and Pavan paying", () => {
    const d = newDoc(invoice);
    expect(d.split.people.map((p) => p.name)).toEqual(["Nithish", "Pavan", "Sai"]);
    expect(d.split.payerId).toBe("p2");
    expect(d.split.assign.i1).toEqual({ mode: "even", who: ["p1", "p2", "p3"] });
  });

  it("splits units evenly when switching to By count", () => {
    let d = setCountMode(newDoc(invoice), "i1", true);
    expect(d.split.assign.i1).toEqual({ mode: "count", counts: { p1: 2, p2: 2, p3: 2 } });
    d = stepCount(stepCount(d, "i1", "p1", -1), "i1", "p1", -1);
    d = stepCount(stepCount(d, "i1", "p2", 1), "i1", "p2", 1);
    d = stepCount(d, "i1", "p2", 1); // all six are used: no seventh
    expect(d.split.assign.i1).toEqual({ mode: "count", counts: { p1: 0, p2: 4, p3: 2 } });
    expect(setCountMode(d, "i1", false).split.assign.i1).toEqual({ mode: "even", who: ["p2", "p3"] });
  });

  it("drops unit counts when the quantity changes", () => {
    const d = updateItem(setCountMode(newDoc(invoice), "i1", true), "i1", { qty: 5 });
    expect(d.split.assign.i1).toEqual({ mode: "even", who: ["p1", "p2", "p3"] });
  });

  it("adds a new person only to items everyone shares", () => {
    const d = addPerson(togglePerson(newDoc(invoice), "i2", "p1"), "Ravi");
    expect(d.split.assign.i1).toEqual({ mode: "even", who: ["p1", "p2", "p3", "p4"] });
    expect(d.split.assign.i2).toEqual({ mode: "even", who: ["p2", "p3"] });
  });

  it("removes a person everywhere and moves the payer", () => {
    const d = removePerson(setCountMode(newDoc(invoice), "i1", true), "p2");
    expect(d.split.payerId).toBe("p1");
    expect(d.split.assign.i1).toEqual({ mode: "count", counts: { p1: 2, p3: 2 } });
    expect(d.split.assign.i2).toEqual({ mode: "even", who: ["p1", "p3"] });
  });

  it("writes a group-chat summary", () => {
    const d = togglePerson(togglePerson(newDoc(invoice), "i2", "p1"), "i2", "p3");
    expect(summaryText(d, runSplit(d))).toBe(
      ["Walmart, Nov 2 ($34.28, Pavan paid)", "Nithish  $6.76", "Pavan    $20.76", "Sai      $6.76", "", "Nithish → Pavan: $6.76", "Sai → Pavan: $6.76"].join("\n"),
    );
  });

  it("only loads stored docs that check out", () => {
    const d = newDoc(invoice);
    expect(asDoc(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(asDoc({ ...d, invoice: { ...d.invoice, total: 34.28 } })).toBeNull();
    expect(asDoc({ ...d, v: 2 })).toBeNull();
    expect(asDoc(null)).toBeNull();
  });
});
