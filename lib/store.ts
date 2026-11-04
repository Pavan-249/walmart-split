import { useSyncExternalStore } from "react";
import type { SplitDoc } from "./doc";
import { loadDoc, saveDoc } from "./storage";

// The current split, kept in localStorage. `undefined` means not read yet (the
// static prerender and the first client render), `null` means no invoice loaded.

let doc: SplitDoc | null | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SplitDoc | null {
  if (doc === undefined) doc = loadDoc();
  return doc;
}

export function useDoc(): SplitDoc | null | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

export function setDoc(next: SplitDoc | null): void {
  doc = next;
  saveDoc(next);
  listeners.forEach((l) => l());
}

export function updateDoc(fn: (d: SplitDoc) => SplitDoc): void {
  const cur = getSnapshot();
  if (cur) setDoc(fn(cur));
}
