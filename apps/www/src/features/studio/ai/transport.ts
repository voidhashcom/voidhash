import { DefaultChatTransport } from "ai";

import { env } from "@/lib/env";

import type { SurfaceAgent } from "./contract";

/** Backend chat endpoint base, with any trailing slashes trimmed. */
const apiBaseUrl = env.VITE_APP_API_URL.replace(/\/+$/, "");

/**
 * How long the `beforeSend` barrier may block a chat send before the send
 * proceeds anyway. The barrier flushes the code-editor Monaco buffers into the
 * store fork so the client tool executor reads the user's latest code; that is a
 * synchronous local operation, but the bounded race is kept defensively so a
 * surface whose `beforeSend` ever hangs cannot block every send indefinitely.
 */
const BEFORE_SEND_TIMEOUT_MS = 3000;

/**
 * Race `barrier` against a timeout so a hung flush cannot block the send forever.
 * Resolves when the barrier settles OR the timeout elapses, whichever is first;
 * the timer is always cleared. Never rejects — a barrier rejection is swallowed by
 * the caller, and a timeout is a normal "proceed anyway" outcome.
 */
function raceBeforeSend(barrier: Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, BEFORE_SEND_TIMEOUT_MS);
    const settle = () => {
      clearTimeout(timer);
      resolve();
    };
    barrier.then(settle, settle);
  });
}

/**
 * The AI SDK fields a custom `prepareSendMessagesRequest` must forward onto the
 * body itself. When NO `prepareSendMessagesRequest` is given, the SDK appends
 * these to the body automatically; when one IS given, the SDK sends the returned
 * body VERBATIM (see `HttpChatTransport.sendMessages`), so a custom function must
 * re-include them or the POST loses its `messages` (server → 400) and turn ids.
 */
interface AiSdkRequestFields {
  readonly id: string;
  readonly messages: unknown;
  readonly trigger: "submit-message" | "regenerate-message";
  readonly messageId: string | undefined;
}

/**
 * Build the request body for a send, merging the transport's static context, the
 * SDK's per-turn fields (`id`/`messages`/`trigger`/`messageId`), and any fresh
 * dynamic context. Extracted so the exact wire body can be asserted against the
 * server's chat-request schema in a contract test.
 */
export function buildSendMessagesBody(
  staticBody: Record<string, unknown>,
  sdkFields: AiSdkRequestFields,
  dynamicContext: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...staticBody,
    id: sdkFields.id,
    messages: sdkFields.messages,
    trigger: sdkFields.trigger,
    messageId: sdkFields.messageId,
    ...dynamicContext,
  };
}

/**
 * Build the AI SDK transport for a surface agent. The transport POSTs to
 * `${VITE_APP_API_URL}/api/ai/chat` with cookie auth (`credentials: "include"`)
 * and merges the surface id, its request context, and the `chatId` into every
 * request body (the AI SDK appends `messages`/`id`/`trigger`).
 *
 * The designer's tools are CLIENT-EXECUTED (the backend declares them
 * schema-only and ends the stream at a tool call; the browser runs them and the
 * chat auto-continues), but the server still persists the chat authoritatively,
 * so it needs the `chatId` (the client-minted persistence key) on every turn's
 * body — including each auto-continuation request.
 *
 * When the agent exposes {@link SurfaceAgent.getDynamicContext}, its result is
 * merged into the body at SEND time via `prepareSendMessagesRequest`, so live UI
 * state (e.g. the designer's current selection) reflects the moment the user hit
 * send rather than when this transport was built.
 *
 * NOTE: a custom `prepareSendMessagesRequest` REPLACES the SDK's default body
 * assembly — the SDK sends the returned body verbatim and does NOT re-append
 * `messages`/`id`/`trigger`/`messageId`. {@link buildSendMessagesBody} therefore
 * re-includes them explicitly; dropping them loses `messages` and the server
 * rejects the request with 400.
 */
export function createVoidhashAiTransport(agent: SurfaceAgent, chatId: string) {
  const getDynamicContext = agent.getDynamicContext;
  const beforeSend = agent.beforeSend;
  const staticBody = {
    surface: agent.surfaceId,
    chatId,
    ...agent.context,
  };
  // A custom `prepareSendMessagesRequest` is needed when the surface has dynamic
  // context to merge OR a `beforeSend` barrier to await (the designer drains its
  // code-editor flush queue here so the agent reads the user's latest code). It may
  // be async — the SDK awaits it before the POST.
  const needsPrepare = getDynamicContext !== undefined || beforeSend !== undefined;
  return new DefaultChatTransport({
    api: `${apiBaseUrl}/api/ai/chat`,
    credentials: "include",
    body: staticBody,
    prepareSendMessagesRequest: needsPrepare
      ? async ({ id, messages, trigger, messageId }) => {
          if (beforeSend !== undefined) {
            // A failed OR hung flush must not block the message: race the barrier
            // against a bounded timeout (a hung flush would otherwise block every
            // send forever) and swallow any rejection.
            try {
              await raceBeforeSend(Promise.resolve(beforeSend()));
            } catch {
              // swallow — send the message regardless.
            }
          }
          return {
            body: buildSendMessagesBody(
              staticBody,
              { id, messages, trigger, messageId },
              getDynamicContext?.() ?? {},
            ),
          };
        }
      : undefined,
  });
}
