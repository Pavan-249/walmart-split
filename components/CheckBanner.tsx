import { fmt } from "@/lib/format";
import { reconcile, type Invoice } from "@/lib/invoice";

/** The two invoice checks: items = subtotal, and subtotal + fees and tax = total. */
export function CheckBanner({ invoice, onFix }: { invoice: Invoice; onFix?: () => void }) {
  const r = reconcile(invoice);

  if (r.ok) {
    if (onFix) return null;
    return (
      <p className="flex items-baseline gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-ok" />
        <span>
          Everything adds up: {invoice.items.length === 1 ? "1 item comes" : `${invoice.items.length} items come`} to{" "}
          <span className="num">{fmt(r.itemsSum)}</span>, and with fees and
          tax that&apos;s <span className="num">{fmt(invoice.total)}</span>, same as the invoice.
        </span>
      </p>
    );
  }

  const gap = (c: number, more: string, less: string) => (c > 0 ? `${fmt(c)} ${more}` : `${fmt(-c)} ${less}`);
  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-xl border border-warn/40 bg-warn/8 px-4 py-3 text-sm">
      {r.subtotalGap !== 0 && (
        <p>
          Items add up to <b className="num">{fmt(r.itemsSum)}</b>, but the invoice subtotal is <b className="num">{fmt(invoice.subtotal)}</b>:{" "}
          <b className="text-warn">{gap(r.subtotalGap, "too much", "missing")}</b>.
        </p>
      )}
      {r.totalGap !== 0 && (
        <p>
          Subtotal plus fees and tax is <b className="num">{fmt(invoice.subtotal + r.adjSum)}</b>, but the invoice total is{" "}
          <b className="num">{fmt(invoice.total)}</b>: <b className="text-warn">{gap(r.totalGap, "too much", "missing")}</b>.
        </p>
      )}
      {onFix ? (
        <button type="button" className="link self-start px-0" onClick={onFix}>
          Fix it on Review
        </button>
      ) : (
        <p className="text-muted">Fix a price, add a missing item, or correct the subtotal or total at the bottom.</p>
      )}
    </div>
  );
}
