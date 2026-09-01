import * as Str from "effect/String";
/**
 * Minimal Slack Web API client — a thin wrapper over `chat.postMessage`
 * (https://slack.com/api/chat.postMessage). Built for the in-app feedback relay,
 * but generic enough for any internal notification.
 *
 * Runs on `HttpClient` over {@link FetchHttpClient.layer}, provided internally so
 * the client keeps running natively on Cloudflare Workers and callers never have
 * to supply an `HttpClient` themselves. The bot token (`xoxb-…`) and default
 * channel are read from {@link SlackConfig} at layer build (worker boot),
 * keeping the resolver (Alchemy secrets / `Config`) decoupled from the
 * constructor.
 *
 * When the bot token or the target channel is missing the client **fails
 * closed** — `postMessage` becomes a no-op that succeeds — so un-provisioned
 * stages (local dev, in-process smoke tests) boot and callers relaying to Slack
 * don't error when Slack simply isn't configured.
 */
import { causeMessage } from "@voidhash/lib/lang";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";

/** Slack Web API base URL. */
const SLACK_API_BASE_URL = "https://slack.com/api";

/** Request body sent to `chat.postMessage`, encoded as JSON text. */
const encodePostMessageBody = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      blocks: Schema.optional(Schema.Array(Schema.Unknown)),
      channel: Schema.String,
      text: Schema.String,
    }),
  ),
);

/**
 * `chat.postMessage` response body. Slack signals logical failures with HTTP 200
 * plus `{ ok: false, error }`, so the body is decoded rather than trusted.
 */
const slackResponse = Schema.fromJsonString(
  Schema.Struct({
    error: Schema.optional(Schema.String),
    ok: Schema.optional(Schema.Boolean),
  }),
);

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
 * Builds a live {@link SlackClient} over `HttpClient`. When `botToken` is
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
    return Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient;
      const response = yield* httpClient.post(`${SLACK_API_BASE_URL}/chat.postMessage`, {
        body: HttpBody.text(
          encodePostMessageBody({ blocks: input.blocks, channel, text: input.text }),
          "application/json; charset=utf-8",
        ),
        headers: { Authorization: `Bearer ${config.botToken}` },
      });
      const text = yield* response.text;
      if (response.status < 200 || response.status >= 300) {
        return yield* new SlackClientError({
          cause: `Slack returned ${response.status}: ${text.slice(0, 500)}`,
          message: "Slack chat.postMessage failed",
        });
      }
      if (Str.isEmpty(text)) {
        return;
      }
      // Slack signals logical failures in the JSON body with `ok: false`.
      const body = yield* Schema.decodeUnknownEffect(slackResponse)(text);
      if (body.ok === false) {
        return yield* new SlackClientError({
          cause: `Slack error: ${body.error ?? "unknown"}`,
          message: "Slack chat.postMessage failed",
        });
      }
    }).pipe(
      Effect.catch((cause) => {
        if (cause instanceof SlackClientError) {
          return Effect.fail(cause);
        }
        return Effect.fail(
          new SlackClientError({
            cause: causeMessage(cause),
            message: "Slack chat.postMessage failed",
          }),
        );
      }),
      Effect.provide(FetchHttpClient.layer),
    );
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
      const defaultChannel = yield* Option.match(Option.fromNullishOr(config.defaultChannel), {
        onNone: () => Effect.succeed(Option.none<string>()),
        onSome: (channel) => Effect.map(channel, Option.some),
      });
      return createSlackClient({ botToken, defaultChannel: Option.getOrUndefined(defaultChannel) });
    }),
  );
