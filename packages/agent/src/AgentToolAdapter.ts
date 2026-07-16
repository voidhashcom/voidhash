import type {
  AfterToolCallResult,
  AgentTool,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import { Effect, type Context } from "effect";
import type { TSchema } from "typebox";

import type { BoundEffectRunner } from "./EffectRunner.ts";

const EffectToolError = Symbol("@voidhash/agent/EffectToolError");

type MarkedAgentToolResult<Details> = AgentToolResult<Details> & {
  readonly [EffectToolError]?: true;
};

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

/** Adapts one Effect handler to a Pi tool using a lazy Effect runner. */
export const makeEffectAgentToolWithRunner = <Params, Details, E, R>(
  definition: EffectAgentToolDefinition<Params, Details, E, R>,
  runEffect: BoundEffectRunner<R>,
): AgentTool<TSchema, Details> => ({
  name: definition.name,
  label: definition.label ?? definition.name,
  description: definition.description,
  parameters: definition.parameters,
  execute: async (_toolCallId, params, signal) => {
    const effect = definition
      .effectHandler(params as Params, signal)
      .pipe(Effect.mapError(toError));
    const result = await runEffect(effect, signal);
    const output: MarkedAgentToolResult<Details> = {
      content: [...result.content],
      details: result.details,
    };
    if (result.isError) {
      Object.defineProperty(output, EffectToolError, { value: true });
    }
    return output;
  },
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
    Effect.runPromise(
      effect.pipe(Effect.provide(context)),
      signal === undefined ? undefined : { signal },
    ),
  );

/**
 * Pi `afterToolCall` override that preserves structured Effect-tool details
 * while marking a folded workspace failure as an error result.
 */
export const effectAgentToolErrorOverride = (
  result: AgentToolResult<unknown>,
): AfterToolCallResult | undefined =>
  (result as MarkedAgentToolResult<unknown>)[EffectToolError] === true
    ? { isError: true }
    : undefined;

const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(typeof cause === "string" ? cause : String(cause));
