"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { parseMoney, toInput } from "@/lib/format";
import type { Cents } from "@/lib/split";

/** Sets --c to a person's color, by their place in the people list. */
export const personStyle = (index: number) => ({ "--c": `var(--p${index % 6})` }) as CSSProperties;

export function Dot({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full bg-c ${className}`} />;
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-[3px] self-start rounded-[10px] bg-sunk p-[3px]">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className="min-h-10 cursor-pointer rounded-lg px-3 text-[13.5px] font-medium text-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-[0_1px_2px_color-mix(in_srgb,var(--ink)_18%,transparent)]"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A destructive button that asks for a second tap within three seconds. */
export function TwoTap({
  children,
  armed,
  onConfirm,
  className = "",
  label,
}: {
  children: ReactNode;
  armed: string;
  onConfirm: () => void;
  className?: string;
  label?: string;
}) {
  const [isArmed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      data-armed={isArmed}
      aria-label={isArmed ? undefined : label}
      className={`btn btn-ghost ${className}`}
      onClick={() => {
        clearTimeout(timer.current);
        if (isArmed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {isArmed ? armed : children}
    </button>
  );
}

/**
 * A dollar field that keeps what you type until you leave it, then saves it as
 * cents. Remount it with key={value} so outside changes show up.
 */
export function MoneyInput({
  value,
  onCommit,
  label,
  className = "",
}: {
  value: Cents;
  onCommit: (c: Cents) => void;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(toInput(value));
  const commit = () => {
    const c = parseMoney(draft);
    if (c === null) setDraft(toInput(value));
    else if (c !== value) onCommit(c);
    else setDraft(toInput(value));
  };
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span aria-hidden className="pointer-events-none absolute left-2.5 text-muted">
        $
      </span>
      <input
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="field num w-full pl-6 text-right"
      />
    </label>
  );
}

export function QtyInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value));
  const set = (n: number) => {
    const q = Math.min(999, Math.max(1, n));
    setDraft(String(q));
    if (q !== value) onChange(q);
  };
  return (
    <span className="inline-flex h-11 items-center rounded-[10px] border border-line bg-surface">
      <button type="button" aria-label={`One fewer ${label}`} disabled={value <= 1} onClick={() => set(value - 1)} className="num h-full w-10 cursor-pointer text-lg disabled:cursor-default disabled:opacity-30">
        −
      </button>
      <input
        aria-label={`Quantity of ${label}`}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={() => set(Number(draft) || value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="num w-10 bg-transparent text-center text-base font-semibold focus:outline-none"
      />
      <button type="button" aria-label={`One more ${label}`} onClick={() => set(value + 1)} className="num h-full w-10 cursor-pointer text-lg">
        +
      </button>
    </span>
  );
}
