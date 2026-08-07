import type {
  AfterToolCallResult,
  AgentTool,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { causeMessage } from "@voidhash/lib/lang";
import { Data, Effect, type Context } from "effect";
import type { TSchema } from "typebox";

import type { BoundEffectRunner } from "./EffectRunner.ts";

const EffectToolError = Symbol("@voidhash/agent/EffectToolError");

type MarkedAgentToolResult<Details> = AgentToolResult<Details> & {
  readonly [EffectToolError]?: true;
};

/** Failure surfaced to Pi when an Effect tool fails with a non-`Error` value. */
class EffectAgentToolError extends Data.TaggedError("EffectAgentToolError")<{
  readonly message: string;
}> {}

/** Normalized result shared by Effect-backed tools and Pi. */
export interface EffectAgentToolResult<Details = unknown> {
  readonly content: ReadonlyArray<TextContent | ImageContent>;
  readonly details: Details;
  readonly isError?: boolean;
}

/** Definition accepted by {@link makeEffectAgentTool}. */
export interface EffectAgentToolDefinition<Params, Details, E, R> {
  readonly name: string;
  readonly label?: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly effectHandler: (
    params: Params,
    signal: AbortSignal | undefined,
  ) => Effect.Effect<EffectAgentToolResult<Details>, E, R>;
}

/**
 * Pi validates raw tool arguments against `definition.parameters` before it
 * calls `execute`, but `Static<TSchema>` erases to `unknown`, so the handler's
 * parameter shape is guaranteed by the runtime rather than by TypeScript.
 */
const isValidatedParams = <Params>(_params: unknown): _params is Params => true;

const runOptions = (
  signal: AbortSignal | undefined,
): { readonly signal: AbortSignal } | undefined => {
  if (signal === undefined) return undefined;
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
    Effect.runPromise(
      Effect.gen(function* () {
        if (!isValidatedParams<Params>(params)) {
          return yield* Effect.die(
            new Error(`Tool ${definition.name} received unvalidated arguments`),
          );
        }
        const effect = definition.effectHandler(params, signal).pipe(Effect.mapError(toError));
        const result = yield* Effect.tryPromise({
          try: () => runEffect(effect, signal),
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
  makeEffectAgentToolWithRunner(definition, (effect, signal) =>
    Effect.runPromise(effect.pipe(Effect.provide(context)), runOptions(signal)),
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
): AfterToolCallResult | undefined => {
  if (isEffectToolError(result)) return { isError: true };
  return undefined;
};

const toError = (cause: unknown): Error => {
  if (cause instanceof Error) return cause;
  return new EffectAgentToolError({ message: causeMessage(cause) });
};
