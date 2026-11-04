"use client";

import type { ReactNode } from "react";
import { setCountMode, stepCount, togglePerson, type SplitDoc } from "@/lib/doc";
import { fmt } from "@/lib/format";
import type { LineItem } from "@/lib/invoice";
import { updateDoc } from "@/lib/store";
import { displayName } from "@/lib/summary";
import { personStyle } from "./ui";

export function ItemRow({ item, doc }: { item: LineItem; doc: SplitDoc }) {
  const people = doc.split.people;
  const a = doc.split.assign[item.id] ?? { mode: "even", who: [] };
  let ctrl: ReactNode;
  let each: ReactNode;
  let open: boolean;

  if (a.mode === "count") {
    const used = people.reduce((s, p) => s + (a.counts[p.id] ?? 0), 0);
    const left = item.qty - used;
    open = left > 0;
    ctrl = (
      <>
        {people.map((p, i) => {
          const c = a.counts[p.id] ?? 0;
          const name = displayName(p, i);
          return (
            <span key={p.id} style={personStyle(i)} className="inline-flex h-11 items-center rounded-full border-[1.5px] border-c/50 pl-1.5">
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-c text-[11px] font-semibold text-on-c">
                {name[0]}
              </span>
              <button
                type="button"
                aria-label={`One less for ${name}`}
                disabled={c === 0}
                onClick={() => updateDoc((d) => stepCount(d, item.id, p.id, -1))}
                className="num h-full w-9 cursor-pointer text-[17px] font-semibold disabled:cursor-default disabled:opacity-30"
              >
                −
              </button>
              <span className="num min-w-[1.5em] text-center font-semibold" aria-label={`${name}: ${c}`}>
                {c}
              </span>
              <button
                type="button"
                aria-label={`One more for ${name}`}
                disabled={used >= item.qty}
                onClick={() => updateDoc((d) => stepCount(d, item.id, p.id, 1))}
                className="num h-full w-9 cursor-pointer text-[17px] font-semibold disabled:cursor-default disabled:opacity-30"
              >
                +
              </button>
            </span>
          );
        })}
        <span className={`num px-0.5 text-xs font-medium ${open ? "text-warn" : "text-muted"}`}>
          {used}/{item.qty}
        </span>
        <button type="button" className="link" onClick={() => updateDoc((d) => setCountMode(d, item.id, false))}>
          Split evenly
        </button>
      </>
    );
    each = open ? <span className="text-warn">{fmt(Math.round((item.price * left) / item.qty))} left</span> : `${fmt(Math.round(item.price / item.qty))} each`;
  } else {
    const who = people.filter((p) => a.who.includes(p.id));
    open = who.length === 0;
    ctrl = (
      <>
        {people.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={a.who.includes(p.id)}
            onClick={() => updateDoc((d) => togglePerson(d, item.id, p.id))}
            style={personStyle(i)}
            className="group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-line pr-3.5 pl-3 text-[14px] font-medium text-muted transition-colors hover:border-c aria-pressed:border-c aria-pressed:bg-c aria-pressed:text-on-c"
          >
            <span aria-hidden className="size-2.5 rounded-full border-[1.5px] border-c group-aria-pressed:border-on-c group-aria-pressed:bg-on-c" />
            {displayName(p, i)}
          </button>
        ))}
        {item.qty > 1 && (
          <button type="button" className="link" onClick={() => updateDoc((d) => setCountMode(d, item.id, true))}>
            By count
          </button>
        )}
      </>
    );
    if (who.length === 0) each = <span className="text-warn">No one yet</span>;
    else if (who.length === 1) each = `${displayName(who[0], people.indexOf(who[0]))} only`;
    else each = `${fmt(Math.round(item.price / who.length))} × ${who.length}`;
  }

  return (
    <div className={`item-row ${open ? "bg-warn/7" : ""}`}>
      <div className="name">
        <div className="leading-[1.3] font-semibold">
          {item.name || "Unnamed item"}
          {item.qty > 1 && <span className="num ml-1.5 rounded-[5px] bg-sunk px-[5px] py-px align-[1px] text-xs font-medium">×{item.qty}</span>}
        </div>
        {item.note && <div className="mt-px text-[12.5px] text-muted">{item.note}</div>}
      </div>
      <div className="ctrl">{ctrl}</div>
      <div className="price">
        <div className="num font-semibold">{fmt(item.price)}</div>
        <div className="mt-px text-xs text-muted">{each}</div>
      </div>
    </div>
  );
}
