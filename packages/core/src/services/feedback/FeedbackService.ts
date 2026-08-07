import { Context, Effect, Layer, Schema } from "effect";

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
  readonly sentiment: number | null;
  readonly message: string;
  readonly organizationId: string | null;
  readonly projectId: string | null;
  readonly pathname: string | null;
  readonly userAgent: string | null;
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

/** Human label for an ordinal sentiment, or `null` when absent/unknown. */
const sentimentLabelFor = (sentiment: number | null): string | null => {
  if (sentiment == null) return null;
  const labels: Record<number, string> = FeedbackSentimentLabels;
  return labels[sentiment] ?? null;
};

/** Truncates a nullable free-form client field to its column limit. */
const truncate = (value: string | null, limit: number): string | null => {
  if (!value) return null;
  return value.slice(0, limit);
};

/**
 * Builds the Slack Block Kit payload for one feedback item. Exported for unit
 * testing; the context block only includes the org/project/page/sentiment lines
 * that are actually present.
 */
export const buildSlackMessage = (params: {
  readonly topicLabel: string;
  readonly sentimentLabel: string | null;
  readonly message: string;
  readonly userName: string;
  readonly userEmail: string;
  readonly organizationName: string | null;
  readonly projectName: string | null;
  readonly pathname: string | null;
}) => {
  const lines = [`*From:* ${params.userName} (${params.userEmail})`];
  if (params.organizationName) lines.push(`*Organization:* ${params.organizationName}`);
  if (params.projectName) lines.push(`*Project:* ${params.projectName}`);
  if (params.pathname) lines.push(`*Page:* \`${params.pathname}\``);
  if (params.sentimentLabel) lines.push(`*Sentiment:* ${params.sentimentLabel}`);
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

const make = Effect.gen(function* () {
  const db = yield* Db;
  const slack = yield* SlackClientTag;

  const submit: FeedbackServiceShape["submit"] = (input) =>
    Effect.gen(function* () {
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

      const findProject = () => {
        if (!input.projectId) return null;
        return session.projects.find((p) => p.id === input.projectId) ?? null;
      };
      const project = findProject();
      // A project determines its organization. This prevents a user who belongs
      // to multiple tenants from persisting a mismatched org/project snapshot.
      const findOrganization = () => {
        if (project) {
          return session.organizations.find((o) => o.id === project.organizationId) ?? null;
        }
        if (input.organizationId) {
          return session.organizations.find((o) => o.id === input.organizationId) ?? null;
        }
        return null;
      };
      const organization = findOrganization();

      const id = generateId("voidhashFeedback");
      yield* db.insert(voidhashFeedback).values({
        id,
        // Truncate to the column limit — the topic is a free string on the wire.
        topic: input.topic.slice(0, 32),
        sentiment: input.sentiment,
        message: input.message,
        status: FeedbackStatus.New,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        organizationId: organization?.id ?? null,
        organizationSlug: organization?.slug ?? null,
        organizationName: organization?.name ?? null,
        projectId: project?.id ?? null,
        projectSlug: project?.slug ?? null,
        projectName: project?.name ?? null,
        // Truncate free-form client fields to their column limits so an
        // unusually long value can never fail the insert (and lose the feedback).
        pathname: truncate(input.pathname, 1024),
        userAgent: truncate(input.userAgent, 512),
      });

      const topicLabel = topicLabelFor(input.topic);
      const sentimentLabel = sentimentLabelFor(input.sentiment);
      const { blocks, text } = buildSlackMessage({
        topicLabel,
        sentimentLabel,
        message: input.message,
        userName: user.name,
        userEmail: user.email,
        organizationName: organization?.name ?? null,
        projectName: project?.name ?? null,
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
    }).pipe(
      Effect.catchTags({
        EffectDrizzleQueryError: (error) =>
          Effect.fail(new FeedbackServiceError({ message: String(error.cause) })),
      }),
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
  Layer.effect(FeedbackService)(make).pipe(Layer.provide(slackClientLayer(config)));
