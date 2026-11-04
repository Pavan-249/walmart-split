"use client";

import { useState } from "react";
import type { SplitDoc } from "@/lib/doc";
import { fmt, shortDate } from "@/lib/format";
import { setDoc, useDoc } from "@/lib/store";
import { displayName } from "@/lib/summary";
import { Review } from "./Review";
import { SplitScreen } from "./SplitScreen";
import { Summary } from "./Summary";
import { Upload } from "./Upload";

type Step = "review" | "split" | "summary";

const STEPS: [Step, string][] = [
  ["review", "Review"],
  ["split", "Split"],
  ["summary", "Summary"],
];

export default function App() {
  const doc = useDoc();
  const [step, setStep] = useState<Step>("split");

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo(0, 0);
  };

  if (doc === undefined) return <Shell />;
  if (doc === null) {
    return (
      <Upload
        onLoaded={(d) => {
          setDoc(d);
          go("review");
        }}
      />
    );
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-[22px] px-4 pt-5 pb-28">
        <Header doc={doc} />
        {step === "review" && <Review doc={doc} />}
        {step === "split" && <SplitScreen doc={doc} onReview={() => go("review")} onSummary={() => go("summary")} />}
        {step === "summary" && <Summary doc={doc} onNew={() => setDoc(null)} />}
      </main>
      <nav
        aria-label="Steps"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-[880px] grid-cols-3 gap-1 rounded-xl bg-sunk p-1">
          {STEPS.map(([s, label]) => (
            <button
              key={s}
              type="button"
              aria-current={s === step ? "step" : undefined}
              onClick={() => go(s)}
              className="min-h-11 cursor-pointer rounded-lg text-sm font-semibold text-muted aria-[current=step]:bg-surface aria-[current=step]:text-ink aria-[current=step]:shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_18%,transparent)]"
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function Shell() {
  return (
    <main className="mx-auto w-full max-w-[880px] px-4 pt-5">
      <h1 className="font-display text-[clamp(28px,5vw,36px)] leading-[1.05] font-bold tracking-[-0.015em]">Walmart split</h1>
    </main>
  );
}

function Header({ doc }: { doc: SplitDoc }) {
  const { invoice, split } = doc;
  const payerIndex = split.people.findIndex((p) => p.id === split.payerId);
  const when = shortDate(invoice.orderDate);
  return (
    <header>
      <h1 className="font-display text-[clamp(28px,5vw,36px)] leading-[1.05] font-bold tracking-[-0.015em] text-balance">Walmart split</h1>
      <p className="mt-1.5 text-sm text-muted">
        {when ? `${when} order` : "Order"}
        {invoice.orderNumber && <span className="num"> #{invoice.orderNumber}</span>} · <span className="num">{fmt(invoice.total)}</span>
        {payerIndex !== -1 && ` · paid by ${displayName(split.people[payerIndex], payerIndex)}`}
      </p>
    </header>
  );
}
