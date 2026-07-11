import type { PresenceEntry } from "../app/hostService.ts";
import type { TransactionEnvelope } from "../document/transaction.ts";
import type { Value } from "@voidhash/mimic-core";
import type {
  AuthResultFailureMessage,
  AuthResultSuccessMessage,
  ErrorMessage,
  PongMessage,
  PresenceRemoveMessage,
  PresenceSnapshotMessage,
  PresenceUpdateMessage,
  SnapshotMessage,
  TransactionMessage,
} from "./protocol.ts";

export const authResultSuccess = (
  tokenId: string,
  permission: "read" | "write",
): AuthResultSuccessMessage => ({
  type: "auth_result",
  success: true,
  tokenId,
  permission,
});

export const authResultFailure = (error: string): AuthResultFailureMessage => ({
  type: "auth_result",
  success: false,
  error,
});

export const pong = (): PongMessage => ({ type: "pong" });

export const transactionMessage = (
  transaction: TransactionEnvelope,
  version: number,
): TransactionMessage => ({
  type: "transaction",
  transaction,
  version,
});

export const snapshotMessage = (value: Value, version: number): SnapshotMessage => ({
  type: "snapshot",
  value,
  version,
});

export const errorMessage = (reason: string, transactionId?: string): ErrorMessage => ({
  type: "error",
  transactionId,
  reason,
});

export const presenceUpdateMessage = (
  id: string,
  data: Value,
  userId?: string,
): PresenceUpdateMessage => ({
  type: "presence_update",
  id,
  data,
  userId,
});

export const presenceRemoveMessage = (id: string): PresenceRemoveMessage => ({
  type: "presence_remove",
  id,
});

export const presenceSnapshotMessage = (
  selfId: string,
  presences: Record<string, PresenceEntry>,
): PresenceSnapshotMessage => ({
  type: "presence_snapshot",
  selfId,
  presences,
});
