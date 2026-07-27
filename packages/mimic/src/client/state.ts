import { applyBatch, validate as validateSchema, type Value } from "@voidhash/mimic-core";

import type { PendingTransaction } from "./pending.js";

export const replayPending = (
  schema: Parameters<typeof validateSchema>[0],
  serverValue: Value | undefined,
  pending: readonly PendingTransaction[],
): Value | undefined => {
  let next = serverValue;
  for (const transaction of pending) {
    if (next === undefined) {
      throw new Error("Cannot replay pending commands without a base document value");
    }
    next = applyBatch(next, transaction.commands);
    next = validateSchema(schema, next);
  }
  return next;
};
