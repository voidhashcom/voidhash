export const randomUuid = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === "string") {
    return uuid;
  }
  throw new Error("crypto.randomUUID is not available in this runtime");
};

/**
 * Re-export of mimic-core's short id generator. Node ids appear in printed
 * paywall composition source, so the client's `nextTreeNodeId` mints short ids
 * (matching the server-side lowerer) instead of {@link randomUuid}. Draft,
 * transaction, and array-item ids never surface in source and stay UUIDs.
 */
export { shortId } from "@voidhash/mimic-core";
