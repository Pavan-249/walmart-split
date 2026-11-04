"use client";

import { useState } from "react";
import { newDoc, type SplitDoc } from "@/lib/doc";
import { loadCategoryMemory } from "@/lib/storage";
import { NotAWalmartOrder, parseWalmart } from "@/lib/walmart";

export function Upload({ onLoaded }: { onLoaded: (doc: SplitDoc) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { pdfLinesFromFile } = await import("@/lib/load-pdf");
      const invoice = parseWalmart(await pdfLinesFromFile(file), loadCategoryMemory());
      onLoaded(newDoc(invoice));
    } catch (e) {
      setError(e instanceof NotAWalmartOrder ? e.message : "Couldn't read that file. Pick the PDF of a walmart.com order.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-4 pt-5 pb-14">
      <header>
        <h1 className="font-display text-[clamp(28px,5vw,36px)] leading-[1.05] font-bold tracking-[-0.015em]">Walmart split</h1>
        <p className="mt-2.5 max-w-[60ch] text-sm">Split a walmart.com grocery order: tap who shares each item, and see who owes what.</p>
      </header>

      <section className="card">
        <h2>Add your order</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open the order on walmart.com.</li>
          <li>Print it and choose Save as PDF.</li>
          <li>Pick that PDF here.</li>
        </ol>
        <label className="btn mt-1 w-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink">
          {busy ? "Reading…" : "Choose order PDF"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) read(file);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
        <p className="text-[13px] text-muted">
          The PDF is read on this device and never uploaded. Your address isn&apos;t saved; only the items and totals are kept, in this browser.
        </p>
      </section>
    </main>
  );
}
