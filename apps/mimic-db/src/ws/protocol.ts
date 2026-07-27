import { Effect } from "effect";

import type { Value } from "@voidhash/mimic-core";
import type { PresenceEntry } from "../app/hostService.ts";
import type { TransactionEnvelope } from "../document/transaction.ts";

export interface AuthMessage {
  readonly type: "auth";
  readonly token: string;
}

export interface PingMessage {
  readonly type: "ping";
}

export interface SubmitMessage {
  readonly type: "submit";
  readonly transaction: TransactionEnvelope;
}

export interface RequestSnapshotMessage {
  readonly type: "request_snapshot";
}

export interface PresenceSetMessage {
  readonly type: "presence_set";
  readonly data: Value;
}

export interface PresenceClearMessage {
  readonly type: "presence_clear";
}

export type ClientMessage =
  | AuthMessage
  | PingMessage
  | SubmitMessage
  | RequestSnapshotMessage
  | PresenceSetMessage
  | PresenceClearMessage;

export interface AuthResultSuccessMessage {
  readonly type: "auth_result";
  readonly success: true;
  readonly tokenId: string;
  readonly permission: "read" | "write";
}

export interface AuthResultFailureMessage {
  readonly type: "auth_result";
  readonly success: false;
  readonly error: string;
}

export interface PongMessage {
  readonly type: "pong";
}

export interface TransactionMessage {
  readonly type: "transaction";
  readonly transaction: TransactionEnvelope;
  readonly version: number;
}

export interface SnapshotMessage {
  readonly type: "snapshot";
  readonly value: Value;
  readonly version: number;
}

export interface ErrorMessage {
  readonly type: "error";
  readonly transactionId?: string;
  readonly reason: string;
}

export interface PresenceUpdateMessage {
  readonly type: "presence_update";
  readonly id: string;
  readonly data: Value;
  readonly userId?: string;
}

export interface PresenceRemoveMessage {
  readonly type: "presence_remove";
  readonly id: string;
}

export interface PresenceSnapshotMessage {
  readonly type: "presence_snapshot";
  readonly selfId: string;
  readonly presences: Record<string, PresenceEntry>;
}

export type ServerMessage =
  | AuthResultSuccessMessage
  | AuthResultFailureMessage
  | PongMessage
  | TransactionMessage
  | SnapshotMessage
  | ErrorMessage
  | PresenceUpdateMessage
  | PresenceRemoveMessage
  | PresenceSnapshotMessage;

export const parseClientMessage = (
  data: string | Uint8Array,
): Effect.Effect<ClientMessage, Error> =>
  Effect.try({
    try: () => {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      return JSON.parse(text) as ClientMessage;
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });

export const encodeServerMessage = (message: ServerMessage): string => JSON.stringify(message);
