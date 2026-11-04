"use client";

import { useRef, useState } from "react";
import { resetAssignments, runSplit, type SplitDoc } from "@/lib/doc";
import { fmt } from "@/lib/format";
import { updateDoc } from "@/lib/store";
import { displayName, howText, summaryText } from "@/lib/summary";
import { Dot, personStyle, TwoTap } from "./ui";

export function Summary({ doc, onNew }: { doc: SplitDoc; onNew: () => void }) {
  const r = runSplit(doc);
  const { people, payerId } = doc.split;
  const names = people.map(displayName);
  const payerIndex = people.findIndex((p) => p.id === payerId);
  const payer = names[payerIndex];
  const byId = new Map(doc.invoice.items.map((i) => [i.id, i]));
  const left = r.unassigned.itemIds.length;

  return (
    <>
      <section className="card">
        <h2>Settle up</h2>
        <div className="flex flex-col gap-2">
          {people.map((p, i) =>
            p.id === payerId ? null : (
              <div key={p.id} style={personStyle(i)} className="flex items-baseline justify-between gap-3 rounded-[10px] bg-sunk px-3 py-2.5">
                <span>
                  <b className="text-c">{names[i]}</b> pays {payer}
                </span>
                <span className="num text-lg font-semibold">{fmt(r.people[p.id].total)}</span>
              </div>
            ),
          )}
        </div>
        <p className="m-0 text-[13px] text-muted">
          {payer}&apos;s own share is {fmt(r.people[payerId].total)}.
          {left > 0 &&
            ` ${left} item${left === 1 ? "" : "s"} (${fmt(r.unassigned.total)}) still need${left === 1 ? "s" : ""} someone, so these will change.`}
        </p>
        <CopySummary text={summaryText(doc, r)} />
      </section>

      <section className="card">
        <h2>Who got what</h2>
        <div>
          {people.map((p, i) => {
            const t = r.people[p.id];
            return (
              <details key={p.id} style={personStyle(i)} className="group/who border-t border-line first:border-t-0">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-0.5 py-2.5 font-semibold [&::-webkit-details-marker]:hidden">
                  <Dot />
                  {names[i]}
                  <span className="text-xs font-normal text-muted">
                    {t.items.length} item{t.items.length === 1 ? "" : "s"}
                  </span>
                  <span className="num ml-auto">{fmt(t.total)}</span>
                  <span aria-hidden className="num w-4 text-center text-muted group-open/who:hidden">
                    +
                  </span>
                  <span aria-hidden className="num hidden w-4 text-center text-muted group-open/who:inline">
                    −
                  </span>
                </summary>
                <ul className="m-0 mb-3 grid list-none grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-0.5 text-[13.5px]">
                  {t.items.map((s) => (
                    <li key={s.itemId} className="contents">
                      <span>
                        {byId.get(s.itemId)?.name || "Unnamed item"} <span className="text-muted">({howText(s.how)})</span>
                      </span>
                      <span className="num text-right">{fmt(s.cents)}</span>
                    </li>
                  ))}
                  <li className="contents text-muted">
                    <span>Fees and tax share</span>
                    <span className="num text-right">{fmt(t.feesCents)}</span>
                  </li>
                </ul>
              </details>
            );
          })}
          {left > 0 && (
            <div className="border-t border-line py-2.5 text-[13.5px] text-warn">
              <div className="flex justify-between gap-3 font-semibold">
                <span>Nobody yet</span>
                <span className="num">{fmt(r.unassigned.total)}</span>
              </div>
              <p className="m-0 mt-1">{r.unassigned.itemIds.map((id) => byId.get(id)?.name || "Unnamed item").join(", ")}</p>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <TwoTap armed="Tap again to reset" onConfirm={() => updateDoc(resetAssignments)}>
          Reset to all shared
        </TwoTap>
        <TwoTap armed="Tap again to clear this order" onConfirm={onNew}>
          Start a new order
        </TwoTap>
      </div>
    </>
  );
}

function CopySummary({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "fallback">("idle");
  const area = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 1600);
    } catch {
      // No clipboard access (an http:// address, or the browser said no): show the text to copy by hand.
      setState("fallback");
      requestAnimationFrame(() => {
        area.current?.focus();
        area.current?.select();
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn self-start" onClick={copy}>
        {state === "copied" ? "Copied" : state === "fallback" ? "Select and copy below" : "Copy summary"}
      </button>
      {state === "fallback" && (
        <textarea
          ref={area}
          readOnly
          value={text}
          aria-label="Summary text to copy"
          rows={text.split("\n").length + 1}
          className="w-full rounded-[10px] border border-line bg-sunk p-2.5 font-mono text-[13px] leading-[1.4] text-ink"
        />
      )}
    </div>
  );
}
