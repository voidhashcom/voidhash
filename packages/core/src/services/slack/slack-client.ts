/**
 * Minimal Slack Web API client — a thin wrapper over `chat.postMessage`
 * (https://slack.com/api/chat.postMessage). Built for the in-app feedback relay,
 * but generic enough for any internal notification.
 *
 * Uses the runtime's built-in `fetch` so it runs natively on Cloudflare Workers
 * without an Effect `HttpClient` dependency. The bot token (`xoxb-…`) and
 * default channel are read from {@link SlackConfig} at layer build (worker
 * boot), keeping the
 * resolver (Alchemy secrets / `Config`) decoupled from the constructor.
 *
 * When the bot token or the target channel is missing the client **fails
 * closed** — `postMessage` becomes a no-op that succeeds — so un-provisioned
 * stages (local dev, in-process smoke tests) boot and callers relaying to Slack
 * don't error when Slack simply isn't configured.
 */
import { Context, Effect, Layer, Schema } from "effect";

/** Slack Web API base URL. */
const SLACK_API_BASE_URL = "https://slack.com/api";

/**
 * Catch-all Slack client error. Wraps transport failures and non-`ok` Slack
 * responses (Slack returns HTTP 200 with `{ ok: false, error }` on logical
 * failures) so callers see one stable tag at the boundary.
 */
export class SlackClientError extends Schema.TaggedErrorClass<SlackClientError>("SlackClientError")(
  "SlackClientError",
  { cause: Schema.String, message: Schema.String },
) {}

/** One `chat.postMessage` call. `channel` falls back to the configured default. */
export interface SlackPostMessageInput {
  readonly text: string;
  readonly blocks?: ReadonlyArray<unknown>;
  readonly channel?: string;
}

/** Public Slack client surface. */
export interface SlackClient {
  /**
   * Posts a message to Slack. No-ops (succeeds) when the client is unconfigured
   * (missing bot token or no channel to post to).
   */
  readonly postMessage: (input: SlackPostMessageInput) => Effect.Effect<void, SlackClientError>;
}

/** Service tag for the Slack client. */
export class SlackClientTag extends Context.Service<SlackClientTag, SlackClient>()(
  "core/SlackClient",
) {}

/**
 * Runtime configuration for the live Slack client. Fields are Effect-of-string
 * so the resolver (Alchemy secrets / `Config`) is decoupled from the
 * constructor.
 */
export interface SlackConfig {
  readonly botToken: Effect.Effect<string>;
  readonly defaultChannel?: Effect.Effect<string>;
}

/**
 * Builds a live {@link SlackClient} over the runtime `fetch`. When `botToken` is
 * empty, or a call has no `channel` and no `defaultChannel` is set,
 * `postMessage` is a successful no-op.
 */
export const createSlackClient = (config: {
  readonly botToken: string;
  readonly defaultChannel?: string;
}): SlackClient => {
  const postMessage: SlackClient["postMessage"] = (input) => {
    const channel = input.channel ?? config.defaultChannel ?? "";
    if (!config.botToken || !channel) {
      return Effect.void;
    }
    return Effect.tryPromise({
      catch: (cause) =>
        new SlackClientError({
          cause: cause instanceof Error ? cause.message : String(cause),
          message: "Slack chat.postMessage failed",
        }),
      try: async (): Promise<void> => {
        const response = await fetch(`${SLACK_API_BASE_URL}/chat.postMessage`, {
          body: JSON.stringify({
            blocks: input.blocks,
            channel,
            text: input.text,
          }),
          headers: {
            Authorization: `Bearer ${config.botToken}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          method: "POST",
        });
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`Slack returned ${response.status}: ${text.slice(0, 500)}`);
        }
        // Slack signals logical failures in the JSON body with `ok: false`.
        const body = text ? (JSON.parse(text) as { ok?: boolean; error?: string }) : {};
        if (body.ok === false) {
          throw new Error(`Slack error: ${body.error ?? "unknown"}`);
        }
      },
    });
  };

  return { postMessage };
};

/**
 * Live {@link SlackClientTag} layer built from {@link SlackConfig}. The bot token
 * and default channel are resolved at layer build (worker boot), not module
 * load.
 */
export const slackClientLayer = (config: SlackConfig): Layer.Layer<SlackClientTag> =>
  Layer.effect(SlackClientTag)(
    Effect.gen(function* () {
      const botToken = yield* config.botToken;
      const defaultChannel = config.defaultChannel ? yield* config.defaultChannel : undefined;
      return createSlackClient({ botToken, defaultChannel });
    }),
  );
