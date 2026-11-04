"use client";

import { runSplit, setFeeMode, type SplitDoc } from "@/lib/doc";
import { fmt } from "@/lib/format";
import { CATEGORIES, sumItems } from "@/lib/invoice";
import type { FeeMode, SplitResult } from "@/lib/split";
import { updateDoc } from "@/lib/store";
import { displayName } from "@/lib/summary";
import { CheckBanner } from "./CheckBanner";
import { ItemRow } from "./ItemRow";
import { PeopleEditor } from "./PeopleEditor";
import { personStyle, Seg } from "./ui";

export function SplitScreen({ doc, onReview, onSummary }: { doc: SplitDoc; onReview: () => void; onSummary: () => void }) {
  const r = runSplit(doc);
  const { items } = doc.invoice;

  return (
    <>
      <p className="-mt-2 max-w-[60ch] text-sm">Tap names to set who shares each item. Everything starts shared by everyone.</p>
      <PeopleEditor doc={doc} />
      <Tally doc={doc} r={r} />
      <CheckBanner invoice={doc.invoice} onFix={onReview} />

      {CATEGORIES.map((cat) => {
        const its = items.filter((i) => i.category === cat.id);
        if (!its.length) return null;
        return (
          <section key={cat.id}>
            <h2 className="group-title">
              <span>{cat.label}</span>
              <span className="num font-medium tracking-normal normal-case">{fmt(its.reduce((a, i) => a + i.price, 0))}</span>
            </h2>
            <div className="list">
              {its.map((it) => (
                <ItemRow key={it.id} item={it} doc={doc} />
              ))}
            </div>
          </section>
        );
      })}

      <FeesCard doc={doc} r={r} />
      <button type="button" className="btn w-full" onClick={onSummary}>
        See who owes what
      </button>
    </>
  );
}

function Tally({ doc, r }: { doc: SplitDoc; r: SplitResult }) {
  const { people, payerId } = doc.split;
  const left = r.unassigned.itemIds.length;
  return (
    <div aria-live="polite" className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-line bg-bg px-4 pt-[max(env(safe-area-inset-top),8px)] pb-2.5">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(people.length, 3)}, minmax(0, 1fr))` }}>
        {people.map((p, i) => {
          const t = r.people[p.id];
          const n = t.items.length;
          return (
            <div key={p.id} style={personStyle(i)} className="min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-c">
                <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-c" />
                <span className="truncate">{displayName(p, i)}</span>
              </div>
              <div className="num mt-0.5 text-[clamp(18px,4.6vw,24px)] font-semibold tracking-[-0.02em]">{fmt(t.total)}</div>
              <div className="text-xs text-muted">
                {n} item{n === 1 ? "" : "s"}
                {p.id === payerId ? " · paid" : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-[13px] text-muted">
        {left === 0 ? (
          <span className="flex items-baseline gap-[7px] font-medium text-ink">
            <span aria-hidden className="inline-block size-[7px] rounded-full bg-ok" />
            All {doc.invoice.items.length} items assigned
          </span>
        ) : (
          <span className="text-warn">
            {left} item{left === 1 ? "" : "s"} need{left === 1 ? "s" : ""} someone · <span className="num">{fmt(r.unassigned.total)}</span>
          </span>
        )}
        <span className="num">{fmt(r.total)} total</span>
      </div>
    </div>
  );
}

function FeesCard({ doc, r }: { doc: SplitDoc; r: SplitResult }) {
  const { invoice, split } = doc;
  const fees = r.total - sumItems(invoice);
  const hasSavings = invoice.adjustments.some((a) => a.amount < 0);
  const what = hasSavings ? "fees and tax, minus savings" : "fees and tax";
  const shares = split.people.map((p) => r.people[p.id].feesCents);
  const lo = Math.min(...shares);
  const hi = Math.max(...shares);

  let note: string;
  if (fees === 0) note = "No fees or tax to split.";
  else if (split.feeMode === "proportional") note = `The net ${fmt(fees)} (${what}) is spread by each person’s share of the items.`;
  else note = `The net ${fmt(fees)} (${what}) is split ${lo === hi ? fmt(lo) : `${fmt(lo)} or ${fmt(hi)}`} each.`;

  return (
    <section className="card">
      <h2>Fees and tax</h2>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
        <span>Items</span>
        <span className="num text-right">{fmt(sumItems(invoice))}</span>
        {invoice.adjustments.map((a) => (
          <div key={a.id} className={`contents ${a.amount === 0 ? "text-muted" : ""}`}>
            <span>{a.label}</span>
            <span className="num text-right">{fmt(a.amount)}</span>
          </div>
        ))}
        <span className="border-t border-line pt-2 font-semibold">Total</span>
        <span className="num border-t border-line pt-2 text-right font-semibold">{fmt(r.total)}</span>
      </div>
      <Seg<FeeMode>
        label={`How to split the ${fmt(fees)} in fees and tax`}
        value={split.feeMode}
        options={[
          ["proportional", "By what you bought"],
          ["equal", "Equal split"],
        ]}
        onChange={(m) => updateDoc((d) => setFeeMode(d, m))}
      />
      <p className="m-0 max-w-[62ch] text-[13px] text-muted">{note}</p>
    </section>
  );
}
