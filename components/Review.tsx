"use client";

import { addAdjustment, addItem, removeAdjustment, removeItem, setPrinted, updateAdjustment, updateItem, type SplitDoc } from "@/lib/doc";
import { fmt } from "@/lib/format";
import { CATEGORIES, sumItems, type Category, type LineItem } from "@/lib/invoice";
import { rememberCategory } from "@/lib/storage";
import { updateDoc } from "@/lib/store";
import { CheckBanner } from "./CheckBanner";
import { MoneyInput, QtyInput, TwoTap } from "./ui";

export function Review({ doc }: { doc: SplitDoc }) {
  const { invoice } = doc;
  return (
    <>
      <p className="-mt-2 max-w-[62ch] text-sm">
        Check these against the invoice. Fix anything that&apos;s off, and set the aisle for items that landed in the wrong one; it&apos;s
        remembered for next time.
      </p>
      <CheckBanner invoice={invoice} />

      <section>
        <h2 className="group-title">
          <span>{invoice.items.length} items</span>
          <span className="num">{fmt(sumItems(invoice))}</span>
        </h2>
        <div className="list">
          {invoice.items.map((it) => (
            <EditRow key={it.id} item={it} />
          ))}
        </div>
        <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => updateDoc(addItem)}>
          Add an item
        </button>
      </section>

      <section className="card">
        <h2>Fees and tax</h2>
        <div className="flex flex-col gap-2">
          {invoice.adjustments.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <input
                aria-label="Fee name"
                value={a.label}
                onChange={(e) => updateDoc((d) => updateAdjustment(d, a.id, { label: e.target.value }))}
                className="field min-w-0 flex-1"
              />
              <MoneyInput
                key={a.amount}
                value={a.amount}
                label={`Amount for ${a.label}`}
                onCommit={(amount) => updateDoc((d) => updateAdjustment(d, a.id, { amount }))}
                className="w-28 shrink-0"
              />
              <TwoTap armed="Delete?" label={`Delete ${a.label}`} className="w-[5.5rem] shrink-0 px-2" onConfirm={() => updateDoc((d) => removeAdjustment(d, a.id))}>
                Delete
              </TwoTap>
            </div>
          ))}
        </div>
        <button type="button" className="link self-start" onClick={() => updateDoc(addAdjustment)}>
          Add a fee or discount
        </button>
        <p className="text-[13px] text-muted">Savings and discounts are negative amounts.</p>

        <h3 className="mt-2 text-sm font-semibold">Printed on the invoice</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 text-sm">
          <span aria-hidden>Subtotal</span>
          <MoneyInput key={`s${invoice.subtotal}`} value={invoice.subtotal} label="Invoice subtotal" onCommit={(subtotal) => updateDoc((d) => setPrinted(d, { subtotal }))} />
          <span aria-hidden>Total</span>
          <MoneyInput key={`t${invoice.total}`} value={invoice.total} label="Invoice total" onCommit={(total) => updateDoc((d) => setPrinted(d, { total }))} />
        </div>
      </section>
    </>
  );
}

function EditRow({ item }: { item: LineItem }) {
  const label = item.name || "new item";
  return (
    <div className="flex flex-col gap-2 px-3.5 py-3">
      <textarea
        aria-label="Item name"
        placeholder="Item name"
        value={item.name}
        // Walmart titles are long; wrap them instead of cutting them off.
        rows={Math.min(3, Math.max(1, Math.ceil(item.name.length / 32)))}
        onChange={(e) => updateDoc((d) => updateItem(d, item.id, { name: e.target.value.replace(/\n/g, " ") }))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="field -mx-2.5 resize-none border-transparent bg-transparent py-2 leading-[1.3] font-semibold [field-sizing:content] hover:border-line"
      />
      {item.note && <div className="-mt-2 text-[12.5px] text-muted">{item.note}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <QtyInput value={item.qty} label={label} onChange={(qty) => updateDoc((d) => updateItem(d, item.id, { qty }))} />
        <MoneyInput
          key={item.price}
          value={item.price}
          label={`Price of ${label}`}
          onCommit={(price) => updateDoc((d) => updateItem(d, item.id, { price }))}
          className="w-28"
        />
        <select
          aria-label={`Aisle for ${label}`}
          value={item.category}
          onChange={(e) => {
            const category = e.target.value as Category;
            updateDoc((d) => updateItem(d, item.id, { category }));
            rememberCategory(item.key, category);
          }}
          className="field min-w-0 flex-1 basis-36"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <TwoTap armed="Delete?" label={`Delete ${label}`} className="w-[5.5rem] px-2" onConfirm={() => updateDoc((d) => removeItem(d, item.id))}>
          Delete
        </TwoTap>
      </div>
    </div>
  );
}
