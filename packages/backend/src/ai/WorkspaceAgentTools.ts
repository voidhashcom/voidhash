import {
  makeEffectAgentToolWithRunner,
  type BoundEffectRunner,
  type AgentTool,
  type AgentMessage,
  type TSchema,
} from "@voidhash/agent";
import { constant } from "@voidhash/lib/lang";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { MCP_TOOLS } from "../mcp/tool-manifest.ts";
import type {
  WorkspaceToolDeps,
  WorkspaceToolResult,
  WorkspaceToolScope,
} from "./workspace-tools.ts";
import * as P from "effect/Predicate";
import * as Arr from "effect/Array";
import * as Str from "effect/String";
import { MutableMap, MutableSet } from "../collection-boundary.ts";

const EDIT_SESSION_TOOLS = new MutableSet([
  "get_paywall",
  "get_components",
  "read_component",
  "edit_paywall",
  "duplicate_subtree",
  "write_component",
  "rename_component",
  "delete_component",
  "get_paywall_preview",
  "finish_paywall_edit",
  "revert_paywall_edit",
]);

/** Raised when an agent uses an edit-session handle it does not own. */
class AgentEditSessionError extends Schema.TaggedErrorClass<AgentEditSessionError>("AgentEditSessionError")(
  "AgentEditSessionError",
  { message: Schema.String },
) {}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || Array.isArray(value)) return false;
  return P.isObject(value);
};

const inputRecord = (input: unknown): Record<string, unknown> | typeof Schema.Undefined.Type => {
  if (isRecord(input)) return input;
  return undefined;
};

const stringOrUndefined = (value: unknown): string | typeof Schema.Undefined.Type => {
  if (P.isString(value)) return value;
  return undefined;
};

/** The edit-session handle a `begin_paywall_edit` result reports as JSON text. */
const decodeEditSessionOutput = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    Schema.Struct({ editSessionId: Schema.String, paywallId: Schema.String }),
  ),
);

const decodedEditSession = (
  result: WorkspaceToolResult,
): { readonly editSessionId: string; readonly paywallId: string } | typeof Schema.Undefined.Type => {
  if (result.isError) return undefined;
  return Option.getOrUndefined(decodeEditSessionOutput(result.output));
};

const decodedEditSessionFromOutput = (
  output: unknown,
): { readonly editSessionId: string; readonly paywallId: string } | typeof Schema.Undefined.Type => {
  const text = stringOrUndefined(output);
  if (text === undefined) return undefined;
  return decodedEditSession({ output: text, isError: false });
};

/** Tracks the server-managed edit capability used by an internal agent session. */
export class AgentEditSessionTracker {
  readonly #activeByPaywallId = new MutableMap<string, string>();

  /** Returns the active edit-session id for a paywall, when one has been opened. */
  readonly get = (paywallId: string): string | typeof Schema.Undefined.Type => this.#activeByPaywallId.get(paywallId);

  /** Returns the paywall owned by an active edit-session handle. */
  readonly paywallIdFor = (editSessionId: string): string | typeof Schema.Undefined.Type =>
    [...this.#activeByPaywallId].find(([, activeId]) => activeId === editSessionId)?.[0];

  /** Rebuilds active capabilities from persisted Pi tool-result messages. */
  readonly rehydrate = (messages: ReadonlyArray<AgentMessage>): void => {
    this.#activeByPaywallId.clear();
    Arr.forEach(messages, (message) => {
      if (message.role !== "toolResult") return;
      const details = inputRecord(message.details);
      const toolName = stringOrUndefined(details?.toolName) ?? message.toolName;
      const decoded = decodedEditSessionFromOutput(details?.output);
      const editSessionId = stringOrUndefined(details?.editSessionId) ?? decoded?.editSessionId;
      const paywallId = stringOrUndefined(details?.paywallId) ?? decoded?.paywallId;
      if (editSessionId !== undefined && paywallId !== undefined) {
        this.#activeByPaywallId.set(paywallId, editSessionId);
      }
      if (message.isError) return;
      if (toolName === "finish_paywall_edit" && editSessionId !== undefined) {
        Arr.forEach(this.#activeByPaywallId, ([activePaywallId, activeId]) => {
          if (activeId === editSessionId) this.#activeByPaywallId.delete(activePaywallId);
        });
      } else if (toolName === "revert_paywall_edit" && editSessionId !== undefined) {
        Arr.forEach(this.#activeByPaywallId, ([activePaywallId, activeId]) => {
          if (activeId === editSessionId) this.#activeByPaywallId.delete(activePaywallId);
        });
      }
    });
  };

  /**
   * Accepts only edit-session handles opened by this durable agent session.
   */
  readonly prepare = (toolName: string, input: unknown): Effect.Effect<unknown, Error> => {
    const record = inputRecord(input);
    if (!EDIT_SESSION_TOOLS.has(toolName) || record === undefined) {
      return Effect.succeed(input);
    }
    const editSessionId = record.editSessionId;
    if (!P.isString(editSessionId) || Str.isEmpty(editSessionId)) {
      return Effect.fail(
        new AgentEditSessionError({ message: `Call begin_paywall_edit before ${toolName}.` }),
      );
    }
    if (![...this.#activeByPaywallId.values()].includes(editSessionId)) {
      return Effect.fail(
        new AgentEditSessionError({
          message: `Edit session "${editSessionId}" is not owned by this agent session.`,
        }),
      );
    }
    return Effect.succeed(input);
  };

  /** Updates tracked lifecycle state after a workspace tool completes. */
  readonly observe = (toolName: string, input: unknown, result: WorkspaceToolResult): void => {
    if (result.isError) return;
    if (toolName === "begin_paywall_edit") {
      const opened = decodedEditSession(result);
      if (opened !== undefined) {
        this.#activeByPaywallId.set(opened.paywallId, opened.editSessionId);
      }
      return;
    }
    const record = inputRecord(input);
    if (toolName === "finish_paywall_edit" && P.isString(record?.editSessionId)) {
      Arr.forEach(this.#activeByPaywallId, ([paywallId, editSessionId]) => {
        if (editSessionId === record.editSessionId) this.#activeByPaywallId.delete(paywallId);
      });
      return;
    }
    if (toolName === "revert_paywall_edit" && P.isString(record?.editSessionId)) {
      Arr.forEach(this.#activeByPaywallId, ([paywallId, editSessionId]) => {
        if (editSessionId === record.editSessionId) this.#activeByPaywallId.delete(paywallId);
      });
    }
  };
}

/** Structured metadata attached to each Pi workspace-tool result. */
export interface WorkspaceAgentToolDetails {
  readonly toolName: string;
  readonly output: string;
  readonly editSessionId?: string;
  readonly paywallId?: string;
}

/** Mutable shape used to assemble {@link WorkspaceAgentToolDetails} field by field. */
interface AssembledToolDetails {
  toolName: string;
  output: string;
  editSessionId?: string;
  paywallId?: string;
}

const internalParameters = (schema: Record<string, unknown>): TSchema => schema;

const contentOf = (result: WorkspaceToolResult) => {
  if (result.content === undefined) {
    return [{ type: constant("text"), text: result.output }];
  }
  return result.content.map((content) => ({ ...content }));
};

const trackedPaywallId = (
  tracker: AgentEditSessionTracker,
  editSessionId: string | typeof Schema.Undefined.Type,
): string | typeof Schema.Undefined.Type => {
  if (editSessionId === undefined) return undefined;
  return tracker.paywallIdFor(editSessionId);
};

/**
 * Adapts every shared MCP workspace tool into a Pi tool that executes through
 * the host's Effect runner. Tool names and schemas remain aligned with MCP while
 * edit-session handles remain explicit and are ownership-checked before use.
 */
export const makeWorkspaceAgentTools = (
  scope: WorkspaceToolScope,
  runEffect: BoundEffectRunner<WorkspaceToolDeps>,
  tracker = new AgentEditSessionTracker(),
): ReadonlyArray<AgentTool> => {
  return MCP_TOOLS.map((tool) =>
    makeEffectAgentToolWithRunner<unknown, WorkspaceAgentToolDetails, Error, WorkspaceToolDeps>(
      {
        name: tool.descriptor.name,
        label: tool.descriptor.name,
        description: tool.descriptor.description,
        parameters: internalParameters(tool.descriptor.inputSchema),
        effectHandler: (input) =>
          tracker.prepare(tool.descriptor.name, input).pipe(
            Effect.flatMap((prepared) =>
              tool.dispatch(scope, prepared).pipe(Effect.map((result) => ({ prepared, result }))),
            ),
            Effect.map(({ prepared, result }) => {
              const record = inputRecord(prepared);
              const editSessionId =
                stringOrUndefined(record?.editSessionId) ??
                decodedEditSession(result)?.editSessionId;
              const paywallId =
                stringOrUndefined(record?.paywallId) ?? trackedPaywallId(tracker, editSessionId);
              tracker.observe(tool.descriptor.name, prepared, result);
              const details: AssembledToolDetails = {
                toolName: tool.descriptor.name,
                output: result.output,
              };
              if (editSessionId !== undefined) details.editSessionId = editSessionId;
              if (paywallId !== undefined) details.paywallId = paywallId;
              return {
                content: contentOf(result),
                details,
                isError: result.isError,
              };
            }),
          ),
      },
      runEffect,
    ),
  );
};
