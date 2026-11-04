"use client";

import { useState } from "react";
import { addPerson, removePerson, renamePerson, setPayer, type SplitDoc } from "@/lib/doc";
import { updateDoc } from "@/lib/store";
import { displayName } from "@/lib/summary";
import { Dot, personStyle, Seg, TwoTap } from "./ui";

export function PeopleEditor({ doc }: { doc: SplitDoc }) {
  const [name, setName] = useState("");
  const { people, payerId } = doc.split;
  const payerIndex = people.findIndex((p) => p.id === payerId);
  const names = people.map(displayName);

  return (
    <details className="card group/people gap-0">
      <summary className="-m-1 flex min-h-11 cursor-pointer list-none items-center gap-2 p-1 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold">People</span>
        <span className="min-w-0 truncate text-sm text-muted">
          {names.join(", ")} · {names[payerIndex]} paid
        </span>
        <span className="link ml-auto shrink-0 group-open/people:hidden">Edit</span>
        <span className="link ml-auto hidden shrink-0 group-open/people:inline">Done</span>
      </summary>

      <div className="flex flex-col gap-2 pt-3">
        {people.map((p, i) => (
          <div key={p.id} style={personStyle(i)} className="flex items-center gap-2">
            <Dot />
            <input
              aria-label={`Name ${i + 1}`}
              value={p.name}
              onChange={(e) => updateDoc((d) => renamePerson(d, p.id, e.target.value))}
              className="field min-w-0 flex-1"
            />
            {people.length > 1 && (
              <TwoTap armed="Remove?" label={`Remove ${names[i]}`} className="w-[5.5rem] shrink-0 px-2" onConfirm={() => updateDoc((d) => removePerson(d, p.id))}>
                Remove
              </TwoTap>
            )}
          </div>
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            updateDoc((d) => addPerson(d, n));
            setName("");
          }}
        >
          <input aria-label="New person's name" placeholder="Add a person" value={name} onChange={(e) => setName(e.target.value)} className="field min-w-0 flex-1" />
          <button type="submit" className="btn btn-ghost w-[5.5rem] shrink-0 px-2">
            Add
          </button>
        </form>
        <p className="text-[13px] text-muted">Someone new joins every item that everyone shares.</p>

        <div className="mt-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Who paid?</span>
          <Seg label="Who paid" value={payerId} options={people.map((p, i) => [p.id, names[i]])} onChange={(id) => updateDoc((d) => setPayer(d, id))} />
        </div>
      </div>
    </details>
  );
}
