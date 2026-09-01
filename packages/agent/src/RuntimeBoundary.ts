import * as Schema from "effect/Schema";

export { runFork, runPromise, runSync } from "effect/Effect";

export class AgentRuntimeError extends Schema.TaggedErrorClass<AgentRuntimeError>(
  "AgentRuntimeError",
)("AgentRuntimeError", { message: Schema.String }) {}

/** Creates a typed defect for an adapter or runtime invariant violation. */
export const runtimeError = (message: string): AgentRuntimeError =>
  new AgentRuntimeError({ message });
