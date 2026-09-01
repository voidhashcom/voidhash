import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { Db, voidhashFeedback } from "@voidhash/db";
import { FeedbackSentimentLabels, FeedbackStatus, FeedbackTopicLabels } from "@voidhash/lib";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { generateId } from "../../utils/generate-id.ts";
import { type SlackConfig, SlackClientTag, slackClientLayer } from "../slack/slack-client.ts";

/** Tagged error raised by {@link FeedbackService} public methods. */
export class FeedbackServiceError extends Schema.TaggedErrorClass<FeedbackServiceError>(
  "FeedbackServiceError",
)("FeedbackServiceError", { message: Schema.String }) {}

/** Everything the submit endpoint accepts; identity is taken from the session. */
export interface FeedbackSubmitInput {
  readonly topic: string;
  readonly sentiment: Option.Option<number>;
  readonly message: string;
  readonly organizationId: Option.Option<string>;
  readonly projectId: Option.Option<string>;
  readonly pathname: Option.Option<string>;
  readonly userAgent: Option.Option<string>;
}

/** Public {@link FeedbackService} surface. */
export interface FeedbackServiceShape {
  /**
   * Persists one feedback item and relays it to Slack (best-effort). The
   * submitter identity and the org/project display fields are resolved from the
   * authenticated {@link AuthSession} — never trusted from the client — so a
   * caller cannot spoof who sent the feedback or attach an org they are not a
   * member of. Requires a `user` session; api-key sessions are rejected.
   */
  readonly submit: (
    input: FeedbackSubmitInput,
  ) => Effect.Effect<{ readonly id: string }, FeedbackServiceError, AuthSession>;
}

/** Service tag — the layer is built by {@link FeedbackServiceLive}. */
export class FeedbackService extends Context.Service<FeedbackService, FeedbackServiceShape>()(
  "FeedbackService",
) {}

/**
 * Human label for a topic. The topic arrives as a free string on the wire, so
 * the lookup is widened to a string index and falls back to the raw value.
 */
const topicLabelFor = (topic: string): string => {
  const labels: Record<string, string> = FeedbackTopicLabels;
  return labels[topic] ?? topic;
};

/** Human label for an ordinal sentiment when present and known. */
const sentimentLabelFor = (sentiment: Option.Option<number>): Option.Option<string> => {
  const labels: Record<number, string> = FeedbackSentimentLabels;
  return Option.flatMap(sentiment, (value) => Option.fromNullishOr(labels[value]));
};

/** Truncates an optional free-form client field to its column limit. */
const truncate = (value: Option.Option<string>, limit: number): Option.Option<string> =>
  Option.filter(value, Str.isNonEmpty).pipe(Option.map((text) => text.slice(0, limit)));

/**
 * Builds the Slack Block Kit payload for one feedback item. Exported for unit
 * testing; the context block only includes the org/project/page/sentiment lines
 * that are actually present.
 */
export const buildSlackMessage = (params: {
  readonly topicLabel: string;
  readonly sentimentLabel: Option.Option<string>;
  readonly message: string;
  readonly userName: string;
  readonly userEmail: string;
  readonly organizationName: Option.Option<string>;
  readonly projectName: Option.Option<string>;
  readonly pathname: Option.Option<string>;
}) => {
  const lines = [
    `*From:* ${params.userName} (${params.userEmail})`,
    ...Arr.fromOption(Option.map(params.organizationName, (name) => `*Organization:* ${name}`)),
    ...Arr.fromOption(Option.map(params.projectName, (name) => `*Project:* ${name}`)),
    ...Arr.fromOption(Option.map(params.pathname, (pathname) => `*Page:* \`${pathname}\``)),
    ...Arr.fromOption(Option.map(params.sentimentLabel, (label) => `*Sentiment:* ${label}`)),
  ];
  const contextLines = lines.join("\n");

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `New feedback · ${params.topicLabel}`, emoji: true },
    },
    { type: "section", text: { type: "mrkdwn", text: params.message } },
    { type: "context", elements: [{ type: "mrkdwn", text: contextLines }] },
  ];

  const text = `New feedback (${params.topicLabel}) from ${params.userEmail}: ${params.message}`;
  return { blocks, text };
};

const make = Effect.fn("FeedbackService.make")(function* () {
  const db = yield* Db;
  const slack = yield* SlackClientTag;

  const submit: FeedbackServiceShape["submit"] = Effect.fn("FeedbackService.submit")(
    function* (input) {
      const session = yield* AuthSession;
      if (session.method !== "user") {
        return yield* Effect.fail(
          new FeedbackServiceError({
            message: "Feedback can only be submitted from an authenticated user session.",
          }),
        );
      }
      const user = session.user;
      yield* Effect.annotateCurrentSpan("voidhash.user.id", user.id);

      const project = Option.flatMap(input.projectId, (projectId) =>
        Option.fromNullishOr(session.projects.find((candidate) => candidate.id === projectId)),
      );
      // A project determines its organization. This prevents a user who belongs
      // to multiple tenants from persisting a mismatched org/project snapshot.
      const organization = Option.match(project, {
        onNone: () =>
          Option.flatMap(input.organizationId, (organizationId) =>
            Option.fromNullishOr(
              session.organizations.find((candidate) => candidate.id === organizationId),
            ),
          ),
        onSome: (selectedProject) =>
          Option.fromNullishOr(
            session.organizations.find(
              (candidate) => candidate.id === selectedProject.organizationId,
            ),
          ),
      });

      const id = generateId("voidhashFeedback");
      yield* db.insert(voidhashFeedback).values({
        id,
        // Truncate to the column limit — the topic is a free string on the wire.
        topic: input.topic.slice(0, 32),
        sentiment: Option.getOrNull(input.sentiment),
        message: input.message,
        status: FeedbackStatus.New,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        organizationId: Option.map(organization, (value) => value.id).pipe(Option.getOrNull),
        organizationSlug: Option.map(organization, (value) => value.slug).pipe(Option.getOrNull),
        organizationName: Option.map(organization, (value) => value.name).pipe(Option.getOrNull),
        projectId: Option.map(project, (value) => value.id).pipe(Option.getOrNull),
        projectSlug: Option.map(project, (value) => value.slug).pipe(Option.getOrNull),
        projectName: Option.map(project, (value) => value.name).pipe(Option.getOrNull),
        // Truncate free-form client fields to their column limits so an
        // unusually long value can never fail the insert (and lose the feedback).
        pathname: Option.getOrNull(truncate(input.pathname, 1024)),
        userAgent: Option.getOrNull(truncate(input.userAgent, 512)),
      });

      const topicLabel = topicLabelFor(input.topic);
      const sentimentLabel = sentimentLabelFor(input.sentiment);
      const { blocks, text } = buildSlackMessage({
        topicLabel,
        sentimentLabel,
        message: input.message,
        userName: user.name,
        userEmail: user.email,
        organizationName: Option.map(organization, (value) => value.name),
        projectName: Option.map(project, (value) => value.name),
        pathname: input.pathname,
      });

      // Best-effort relay: a Slack outage must never fail the user's submission,
      // which is already durably persisted above.
      yield* slack.postMessage({ blocks, text }).pipe(
        Effect.catchTags({
          SlackClientError: (error) =>
            Effect.logWarning(`Feedback Slack relay failed: ${error.message}`),
        }),
      );

      return { id };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          EffectDrizzleQueryError: (error) =>
            Effect.fail(new FeedbackServiceError({ message: String(error.cause) })),
        }),
      ),
  );

  return { submit } satisfies FeedbackServiceShape;
});

/**
 * Live {@link FeedbackService} layer. Wires its own {@link SlackClientTag} from
 * the provided {@link SlackConfig}; `Db` is
 * supplied by the surrounding domain-services graph. When Slack is unconfigured
 * the relay silently no-ops, so feedback is still stored.
 */
export const FeedbackServiceLive = (config: SlackConfig): Layer.Layer<FeedbackService, never, Db> =>
  Layer.effect(FeedbackService)(make()).pipe(Layer.provide(slackClientLayer(config)));
