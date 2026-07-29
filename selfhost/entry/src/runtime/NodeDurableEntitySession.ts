import type { DurableEntitySession } from "@orbian/sdk/DurableEntity";
import { Effect } from "effect";

/** Minimal server-side WebSocket surface needed by the entity session adapter. */
export interface NodeWebSocketLike {
  readonly send: (message: string | Uint8Array) => unknown;
  readonly close: (code?: number, reason?: string) => unknown;
}

/**
 * Wraps a Node WebSocket connection as a runtime-neutral durable entity
 * session. Attachments remain in memory for the connection lifetime.
 */
export const makeNodeDurableEntitySession = (
  id: string,
  socket: NodeWebSocketLike,
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
