import {
  MimicDocumentIdleMessage,
  type MimicDocumentIdleMessageType,
} from "./MimicDocumentIdleQueue.ts";
import { causeMessage } from "@voidhash/lib/lang";
import { Data, Effect, Schema } from "effect";

/**
 * The raw Cloudflare Queue producer binding as surfaced on the Worker env. The
 * queue can only be *bound* on the Worker; the per-document Durable Object reads
 * the runtime binding off `WorkerEnvironment` and sends directly — mirroring how
 * the Hyperdrive binding is read in `pg-store.ts`.
 */
interface RawQueueBinding {
  readonly send: (body: unknown, options?: { contentType?: "json" | "text" }) => Promise<void>;
}

/** A queue send that failed inside the Durable Object. */
export class IdleQueueSendError extends Data.TaggedError("IdleQueueSendError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const isRawQueueBinding = (value: unknown): value is RawQueueBinding => {
  if (typeof value !== "object" || value === null) return false;
  if (!("send" in value)) return false;
  return typeof value.send === "function";
};

/**
 * Locate the idle-notification queue binding on the Worker env.
 *
 * Alchemy's `QueueBindingPolicyLive` names the runtime binding after the queue
 * resource's LogicalId (`MimicDocumentIdleQueue`), so that is the env key. The
 * binding is still structurally validated (`isRawQueueBinding`) rather than cast.
 * Returns `undefined` when no queue binding is present (e.g. dev runtimes without
 * the binding), so callers can skip publishing rather than crash.
 */
export const findIdleQueue = (env: Record<string, unknown>): RawQueueBinding | undefined => {
  const candidate = env["MimicDocumentIdleQueue"];
  if (isRawQueueBinding(candidate)) return candidate;
  return undefined;
};

const encodeMessage = Schema.encodeUnknownSync(MimicDocumentIdleMessage);

/**
 * Publish a single idle-notification message through the raw Worker queue
 * binding, JSON-encoded via {@link MimicDocumentIdleMessage}. Fails with
 * {@link IdleQueueSendError} when the binding is missing or the send throws, so
 * the alarm handler can log-and-retry-later without leaving `notifiedSeq`
 * advanced.
 */
export const publishIdleMessage = (
  env: Record<string, unknown>,
  message: MimicDocumentIdleMessageType,
): Effect.Effect<void, IdleQueueSendError> =>
  Effect.gen(function* () {
    const queue = findIdleQueue(env);
    if (!queue) {
      return yield* Effect.fail(
        new IdleQueueSendError({ message: "idle-notification queue binding not found" }),
      );
    }
    const body = encodeMessage(message);
    yield* Effect.tryPromise({
      try: () => queue.send(body, { contentType: "json" }),
      catch: (cause) =>
        new IdleQueueSendError({
          message: causeMessage(cause),
          cause,
        }),
    });
  });
