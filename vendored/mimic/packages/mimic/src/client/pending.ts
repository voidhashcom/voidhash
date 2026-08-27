import type { Command } from "@voidhash/mimic-core";

import type { TransactionActor, TransactionEnvelope } from "./protocol.js";

export interface PendingTransaction {
  readonly id: string;
  readonly commands: readonly Command[];
  readonly submittedAt?: string;
  readonly actor?: TransactionActor;
  readonly sentAt: number;
}

export const toEnvelope = (
  pending: PendingTransaction,
  baseVersion: number,
): TransactionEnvelope => ({
  id: pending.id,
  baseVersion,
  commands: pending.commands,
  submittedAt: pending.submittedAt,
  actor: pending.actor,
});
