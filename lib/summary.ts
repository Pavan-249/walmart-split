import type { Person, SplitDoc } from "./doc";
import { fmt, shortDate } from "./format";
import type { How, SplitResult } from "./split";

export const displayName = (p: Person, index: number) => p.name.trim() || `Person ${index + 1}`;

/** "1/3", "4 of 6", or "solo" */
export function howText(how: How): string {
  if (how.kind === "count") return how.units === how.of ? "solo" : `${how.units} of ${how.of}`;
  return how.of === 1 ? "solo" : `1/${how.of}`;
}

/** Plain text for the group chat. */
export function summaryText(doc: SplitDoc, r: SplitResult): string {
  const { people, payerId } = doc.split;
  const names = people.map(displayName);
  const payer = names[people.findIndex((p) => p.id === payerId)] ?? names[0];
  const when = shortDate(doc.invoice.orderDate);
  const width = Math.max(...names.map((n) => n.length)) + 2;

  const lines = [`${doc.invoice.store}${when ? `, ${when}` : ""} (${fmt(r.total)}, ${payer} paid)`];
  people.forEach((p, i) => lines.push(`${names[i].padEnd(width)}${fmt(r.people[p.id].total)}`));
  lines.push("");
  people.forEach((p, i) => {
    if (p.id !== payerId) lines.push(`${names[i]} → ${payer}: ${fmt(r.people[p.id].total)}`);
  });
  const left = r.unassigned.itemIds.length;
  if (left) lines.push("", `(${left} item${left === 1 ? "" : "s"} still unassigned, ${fmt(r.unassigned.total)})`);
  return lines.join("\n");
}
