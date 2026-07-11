import type { PresenceInput, PresenceSnapshot } from "@voidhash/mimic-schema";

/** Presence write input with a guaranteed plain selected-node-id list. */
export type DesignerPresenceInput = Omit<PresenceInput, "selectedNodeIds"> & {
  selectedNodeIds: readonly string[];
};

/** Reads the plain selected-node-id list from a presence snapshot. */
export function selectedNodeIdsFromPresence(
  presence: PresenceSnapshot | undefined,
): readonly string[] {
  if (!presence) {
    return [];
  }
  return presence.selectedNodeIds.flatMap((entry) =>
    entry.value === undefined ? [] : [entry.value],
  );
}

/**
 * Converts a decoded presence snapshot back into write input: snapshot
 * arrays are `{id, pos, value}` entry-wrapped while inputs carry plain
 * elements. Use this for read-modify-write presence updates.
 */
export function presenceInputFromSnapshot(snapshot: PresenceSnapshot): DesignerPresenceInput {
  return {
    cursor: snapshot.cursor,
    name: snapshot.name,
    selectedNodeIds: selectedNodeIdsFromPresence(snapshot),
    user: snapshot.user,
  };
}
