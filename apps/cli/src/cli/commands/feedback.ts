import type { CreateFeedbackBodyJsonEncodingTopic } from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient } from "../../utils/api-client";
import { ExitCode, userError } from "../../utils/error-formatter";
import { directoryConfig, projectNamedBy, readCliConfig, signedInSession } from "../context";
import { requireChoice, requireText } from "../input";
import { printJson } from "../output";
import { outputOptions } from "../shared-options";

/** Feedback topics as `--topic` takes them, with the API's values. */
const TOPICS = [
  ["analytics", "analytics"],
  ["paywalls", "paywalls"],
  ["products", "products"],
  ["persons", "persons"],
  ["feature-flags", "feature_flags"],
  ["experiments", "experiments"],
  ["payment-providers", "payment_providers"],
  ["webhooks", "webhooks"],
  ["sdk", "sdk"],
  ["billing", "billing"],
  ["dashboard", "dashboard"],
  ["other", "other"],
] as const satisfies ReadonlyArray<readonly [string, CreateFeedbackBodyJsonEncodingTopic]>;

const USAGE = 'voidhash-cli feedback "<message>" --topic <topic>';

/** The project this directory names, or the default one, without asking. */
const contextProjectId = Effect.gen(function* () {
  const session = yield* signedInSession;
  const config = yield* directoryConfig;
  if (Option.isSome(config)) {
    return Option.some((yield* projectNamedBy(config.value, session)).project.id);
  }
  const { default_project } = yield* readCliConfig;
  return Option.fromNullishOr(default_project);
}).pipe(Effect.orElseSucceed(() => Option.none<string>()));

/** `voidhash-cli feedback [message] [--topic] [--sentiment]` */
export const feedbackCommand = Command.make(
  "feedback",
  {
    message: Argument.String("message").pipe(
      Argument.withDescription("What you want the Voidhash team to know"),
      Argument.optional,
    ),
    topic: Flag.ChoiceWithValue("topic", TOPICS).pipe(
      Flag.withDescription("What it is about"),
      Flag.optional,
    ),
    sentiment: Flag.Int("sentiment").pipe(
      Flag.withDescription("How you feel, from 1 (unhappy) to 4 (delighted)"),
      Flag.optional,
    ),
    json: outputOptions.json,
  },
  ({ json, message, sentiment, topic }) =>
    Effect.gen(function* () {
      if (Option.exists(sentiment, (value) => value < 1 || value > 4)) {
        return yield* Effect.fail(
          userError("--sentiment is from 1 (unhappy) to 4 (delighted).", {
            exitCode: ExitCode.usage,
          }),
        );
      }
      const api = yield* ApiClient;
      const chosen = yield* requireChoice(topic, {
        flag: "--topic",
        message: "What is it about?",
        usage: USAGE,
        choices: TOPICS.map(([title, value]) => ({ title, value })),
      });
      const text = yield* requireText(message, {
        flag: "the message",
        message: "Your feedback",
        usage: USAGE,
      });
      const projectId = yield* contextProjectId;
      const sent = yield* api.feedbackCreate({
        topic: chosen,
        message: text,
        sentiment: Option.getOrUndefined(sentiment),
        projectId: Option.getOrUndefined(projectId),
      });
      if (json) return yield* printJson(sent);
      yield* Console.log("Thanks! The Voidhash team reads every message.");
    }),
).pipe(
  Command.withDescription(
    "Send feedback to the Voidhash team, about the project you are in when there is one.",
  ),
);
