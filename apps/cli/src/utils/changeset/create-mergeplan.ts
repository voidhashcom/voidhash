import { Effect } from "effect";

export interface Changeset {}

export interface MergePlan {
  local: Changeset;
  remote: Changeset;
}

/**
 * With interaction with the user, creates a marge plan that resolves conflicts between local and remote data.
 * @param localData - The local data to be merged.
 * @param remoteData - The remote data to be merged.
 * @returns
 */
export const createMergePlan = (from: unknown, to: unknown) =>
  Effect.gen(function* createMergePlan() {
    return yield* Effect.succeed({
      local: from,
      remote: to,
    });
  });
