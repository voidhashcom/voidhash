import type { DurableEntitySession } from "@voidhash/platform/DurableEntity";
import { Effect } from "effect";

/** Minimal server-side WebSocket surface needed by the entity session adapter. */
export interface DurableEntitySocketLike {
  readonly send: (message: string | Uint8Array) => unknown;
  readonly close: (code?: number, reason?: string) => unknown;
}

/**
 * Wraps a WebSocket-like connection as a runtime-neutral durable entity
 * session. Attachments remain in memory for the connection lifetime.
 */
export const makeMemoryDurableEntitySession = (
  id: string,
  socket: DurableEntitySocketLike,
  initialAttachment?: unknown,
): DurableEntitySession => {
  let attachment = initialAttachment;
  return {
    id,
    send: (message) =>
      Effect.sync(() => {
        socket.send(message);
      }),
    close: (code, reason) =>
      Effect.sync(() => {
        socket.close(code, reason);
      }),
    getAttachment: Effect.sync(() => attachment),
    setAttachment: (nextAttachment) =>
      Effect.sync(() => {
        attachment = nextAttachment;
      }),
  };
};
