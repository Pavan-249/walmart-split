# Walmart split

Split a walmart.com grocery order with your roommates. Pick the order PDF, tap who shares each item, and get a summary of who owes whom to paste into the group chat.

**Live:** https://pavan-249.github.io/walmart-split/

## How it works

1. Open the order on walmart.com, print it, and choose **Save as PDF**.
2. Pick that PDF in the app. It's read in the browser with [pdf.js](https://mozilla.github.io/pdf.js/) and never uploaded. Only the items and totals are kept, in `localStorage`; the name and address on the invoice are skipped.
3. **Review**: check the items against the invoice. Two checks run as you edit: items must add up to the subtotal, and subtotal plus fees and tax must equal the total. Fix an aisle once and it's remembered for later orders.
4. **Split**: everyone shares everything to start. Tap names to change that, or use **By count** for multi-packs (6 yogurt tubs: 4 Pavan, 2 Sai).
5. **Summary**: each person's items, their share of fees and tax, and lines like "Nithish pays Pavan $48.12".

## Money math

All amounts are integer cents. [`lib/split.ts`](lib/split.ts) splits each item with largest-remainder rounding, handing leftover pennies round-robin across the receipt, then spreads the net fees by what each person bought (or equally). Per-person totals always add up to the invoice total exactly.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest: split math, the Walmart parser, state edits
npm run build    # static export to out/
```

The parser test runs on [`fixtures/walmart-2026-11-02.txt`](fixtures/walmart-2026-11-02.txt), the text rows of a real order with the buyer's name and address removed. PDFs in `fixtures/` are gitignored; if one is there, a second test parses it directly. To make a new text fixture from a PDF:

```bash
npm run fixture:text -- fixtures/order.pdf fixtures/order.txt
```

Pushing to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`).

`reference/walmart-split.html` is the original single-order page this app grew from.
