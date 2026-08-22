import { useSyncExternalStore } from "react";

export interface Note {
  body: string;
  createdAt: number;
  id: string;
  title: string;
}

const SAMPLE_NOTES = [
  { body: "Ship the onboarding paywall.", title: "Weekly review" },
  { body: "Oat milk, coffee, a new notebook.", title: "Groceries" },
  { body: "Voidhash resolves the paywall, the app owns the fallback.", title: "Reading list" },
  { body: "Ask about the export format.", title: "Standup" },
  { body: "Two flat whites and a long walk.", title: "Saturday" },
];

let notes: Note[] = [
  {
    body: SAMPLE_NOTES[0]?.body ?? "",
    createdAt: Date.now(),
    id: "note-0",
    title: SAMPLE_NOTES[0]?.title ?? "Note",
  },
];

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => notes;

/**
 * Appends a note and returns the new list. Notes live in memory only — this is
 * an SDK example, not a persistence tutorial.
 */
export function addNote(): Note[] {
  const sample = SAMPLE_NOTES[notes.length % SAMPLE_NOTES.length];
  notes = [
    ...notes,
    {
      body: sample?.body ?? "",
      createdAt: Date.now(),
      id: `note-${notes.length}-${Date.now()}`,
      title: sample?.title ?? "Note",
    },
  ];
  for (const listener of listeners) {
    listener();
  }
  return notes;
}

/** Subscribes a component to the note list. */
export function useNotes(): Note[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
