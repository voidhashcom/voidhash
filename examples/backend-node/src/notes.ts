import { randomUUID } from "node:crypto";

import { FREE_NOTE_LIMIT } from "./nimbus";

export type Note = {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
};

/** Free-tier accounting, rendered straight into the API response. */
export type NoteQuota = {
  /** `null` for Pro: unlimited. */
  readonly limit: number | null;
  readonly used: number;
  /** `null` for Pro: unlimited. */
  readonly remaining: number | null;
};

export type NoteStore = {
  readonly list: (distinctId: string) => ReadonlyArray<Note>;
  readonly count: (distinctId: string) => number;
  readonly create: (distinctId: string, body: string) => Note;
  readonly forget: (distinctId: string) => void;
};

/**
 * Notes live in memory and vanish on restart — this is an SDK example, not a
 * database tutorial. Swap this module for your own persistence; nothing else
 * in the service touches storage.
 */
export const createNoteStore = (): NoteStore => {
  const byDistinctId = new Map<string, Array<Note>>();

  const notesFor = (distinctId: string): Array<Note> => {
    const existing = byDistinctId.get(distinctId);

    if (existing !== undefined) {
      return existing;
    }

    const created: Array<Note> = [];
    byDistinctId.set(distinctId, created);

    return created;
  };

  return {
    count: (distinctId) => notesFor(distinctId).length,
    create: (distinctId, body) => {
      const note: Note = {
        body,
        createdAt: new Date().toISOString(),
        id: `note_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      };

      notesFor(distinctId).push(note);

      return note;
    },
    forget: (distinctId) => {
      byDistinctId.delete(distinctId);
    },
    list: (distinctId) => [...notesFor(distinctId)],
  };
};

/** Quota for a person holding `used` notes, given whether they are Pro. */
export const quotaFor = (used: number, hasPro: boolean): NoteQuota =>
  hasPro
    ? { limit: null, remaining: null, used }
    : { limit: FREE_NOTE_LIMIT, remaining: Math.max(0, FREE_NOTE_LIMIT - used), used };

/** Whether a free account may add one more note. */
export const canCreateNote = (used: number, hasPro: boolean): boolean =>
  hasPro || used < FREE_NOTE_LIMIT;
