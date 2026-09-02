import type {
  AfterToolCallResult,
  AgentTool,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { causeMessage } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import { runtimeError, runPromise } from "./RuntimeBoundary.ts";
import type * as Context from "effect/Context";
import type { TSchema } from "typebox";

import type { BoundEffectRunner } from "./EffectRunner.ts";
import * as Schema from "effect/Schema";
import * as P from "effect/Predicate";

const EffectToolError = Symbol("@voidhash/agent/EffectToolError");

type MarkedAgentToolResult<Details> = AgentToolResult<Details> & {
  readonly [EffectToolError]?: true;
};

/** Failure surfaced to Pi when an Effect tool fails with a non-`Error` value. */
class EffectAgentToolError extends Schema.TaggedErrorClass<EffectAgentToolError>(
  "EffectAgentToolError",
)("EffectAgentToolError", { message: Schema.String }) {}

/** Normalized result shared by Effect-backed tools and Pi. */
export type EffectAgentToolResult<Details = unknown> = {
  readonly content: ReadonlyArray<TextContent | ImageContent>;
  readonly details: Details;
} & Readonly<Partial<{ isError: boolean }>>;

/** Definition accepted by {@link makeEffectAgentTool}. */
export type EffectAgentToolDefinition<Params, Details, E, R> = {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly effectHandler: (
    params: Params,
    signal: AbortSignal | void,
  ) => Effect.Effect<EffectAgentToolResult<Details>, E, R>;
} & Readonly<Partial<{ label: string }>>;

/**
 * Pi validates raw tool arguments against `definition.parameters` before it
 * calls `execute`, but `Static<TSchema>` erases to `unknown`, so the handler's
 * parameter shape is guaranteed by the runtime rather than by TypeScript.
 */
const isValidatedParams = <Params>(_params: unknown): _params is Params => true;

const runOptions = (signal: AbortSignal | void): Readonly<Partial<{ signal: AbortSignal }>> => {
  if (signal === undefined) return {};
  return { signal };
};

/** Adapts one Effect handler to a Pi tool using a lazy Effect runner. */
export const makeEffectAgentToolWithRunner = <Params, Details, E, R>(
  definition: EffectAgentToolDefinition<Params, Details, E, R>,
  runEffect: BoundEffectRunner<R>,
): AgentTool<TSchema, Details> => ({
  name: definition.name,
  label: definition.label ?? definition.name,
  description: definition.description,
  parameters: definition.parameters,
  execute: (_toolCallId, params, signal) =>
    runPromise(
      Effect.gen(function* () {
        if (!isValidatedParams<Params>(params)) {
          return yield* Effect.die(
            runtimeError(`Tool ${definition.name} received unvalidated arguments`),
          );
        }
        const effect = definition.effectHandler(params, signal).pipe(Effect.mapError(toError));
        const result = yield* Effect.tryPromise({
          try: () => (signal === undefined ? runEffect(effect) : runEffect(effect, signal)),
          catch: toError,
        });
        const output: MarkedAgentToolResult<Details> = {
          content: [...result.content],
          details: result.details,
        };
        if (result.isError) {
          Object.defineProperty(output, EffectToolError, { value: true });
        }
        return output;
      }),
    ),
});

/**
 * Adapts one Effect handler to a Pi tool while preserving the Effect context
 * captured when the agent session was created.
 */
export const makeEffectAgentTool = <Params, Details, E, R>(
  definition: EffectAgentToolDefinition<Params, Details, E, R>,
  context: Context.Context<R>,
): AgentTool<TSchema, Details> =>
  makeEffectAgentToolWithRunner(definition, (effect, ...signals) =>
    runPromise(effect.pipe(Effect.provide(context)), runOptions(signals[0])),
  );

const isEffectToolError = (result: AgentToolResult<unknown>): boolean => {
  if (!(EffectToolError in result)) return false;
  return result[EffectToolError] === true;
};

/**
 * Pi `afterToolCall` override that preserves structured Effect-tool details
 * while marking a folded workspace failure as an error result.
 */
export const effectAgentToolErrorOverride = (
  result: AgentToolResult<unknown>,
): AfterToolCallResult | void => {
  if (isEffectToolError(result)) return { isError: true };
  return;
};

const toError = (cause: unknown): Error => {
  if (P.isError(cause)) return cause;
  return new EffectAgentToolError({ message: causeMessage(cause) });
};
