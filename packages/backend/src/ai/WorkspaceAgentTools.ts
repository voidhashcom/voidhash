import {
  makeEffectAgentToolWithRunner,
  type BoundEffectRunner,
  type AgentTool,
  type AgentMessage,
  type TSchema,
} from "@voidhash/agent";
import { Effect } from "effect";

import { MCP_TOOLS } from "../mcp/tool-manifest.ts";
import type {
  WorkspaceToolDeps,
  WorkspaceToolResult,
  WorkspaceToolScope,
} from "./workspace-tools.ts";

const EDIT_SESSION_TOOLS = new Set([
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

const inputRecord = (input: unknown): Record<string, unknown> | undefined =>
  input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined;

const decodedEditSession = (
  result: WorkspaceToolResult,
): { readonly editSessionId: string; readonly paywallId: string } | undefined => {
  if (result.isError) return undefined;
  try {
    const value = JSON.parse(result.output) as { editSessionId?: unknown; paywallId?: unknown };
    return typeof value.editSessionId === "string" && typeof value.paywallId === "string"
      ? { editSessionId: value.editSessionId, paywallId: value.paywallId }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Tracks the server-managed edit capability used by an internal agent session. */
export class AgentEditSessionTracker {
  readonly #activeByPaywallId = new Map<string, string>();

  /** Returns the active edit-session id for a paywall, when one has been opened. */
  readonly get = (paywallId: string): string | undefined => this.#activeByPaywallId.get(paywallId);

  /** Returns the paywall owned by an active edit-session handle. */
  readonly paywallIdFor = (editSessionId: string): string | undefined =>
    [...this.#activeByPaywallId].find(([, activeId]) => activeId === editSessionId)?.[0];

  /** Rebuilds active capabilities from persisted Pi tool-result messages. */
  readonly rehydrate = (messages: ReadonlyArray<AgentMessage>): void => {
    this.#activeByPaywallId.clear();
    for (const message of messages) {
      if (message.role !== "toolResult") continue;
      const details = inputRecord(message.details);
      const toolName = typeof details?.toolName === "string" ? details.toolName : message.toolName;
      const decoded =
        typeof details?.output === "string"
          ? decodedEditSession({ output: details.output, isError: false })
          : undefined;
      const editSessionId =
        typeof details?.editSessionId === "string" ? details.editSessionId : decoded?.editSessionId;
      const paywallId =
        typeof details?.paywallId === "string" ? details.paywallId : decoded?.paywallId;
      if (editSessionId !== undefined && paywallId !== undefined) {
        this.#activeByPaywallId.set(paywallId, editSessionId);
      }
      if (message.isError) continue;
      if (toolName === "finish_paywall_edit" && editSessionId !== undefined) {
        for (const [activePaywallId, activeId] of this.#activeByPaywallId) {
          if (activeId === editSessionId) this.#activeByPaywallId.delete(activePaywallId);
        }
      } else if (toolName === "revert_paywall_edit" && editSessionId !== undefined) {
        for (const [activePaywallId, activeId] of this.#activeByPaywallId) {
          if (activeId === editSessionId) this.#activeByPaywallId.delete(activePaywallId);
        }
      }
    }
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
    if (typeof editSessionId !== "string" || editSessionId.length === 0) {
      return Effect.fail(new Error(`Call begin_paywall_edit before ${toolName}.`));
    }
    if (![...this.#activeByPaywallId.values()].includes(editSessionId)) {
      return Effect.fail(
        new Error(`Edit session "${editSessionId}" is not owned by this agent session.`),
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
    if (toolName === "finish_paywall_edit" && typeof record?.editSessionId === "string") {
      for (const [paywallId, editSessionId] of this.#activeByPaywallId) {
        if (editSessionId === record.editSessionId) this.#activeByPaywallId.delete(paywallId);
      }
      return;
    }
    if (toolName === "revert_paywall_edit" && typeof record?.editSessionId === "string") {
      for (const [paywallId, editSessionId] of this.#activeByPaywallId) {
        if (editSessionId === record.editSessionId) this.#activeByPaywallId.delete(paywallId);
      }
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

const internalParameters = (schema: Record<string, unknown>): TSchema => schema as TSchema;

const contentOf = (result: WorkspaceToolResult) =>
  result.content === undefined
    ? [{ type: "text" as const, text: result.output }]
    : result.content.map((content) => ({ ...content }));

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
              const suppliedEditSessionId = record?.editSessionId;
              const editSessionId =
                typeof suppliedEditSessionId === "string"
                  ? suppliedEditSessionId
                  : decodedEditSession(result)?.editSessionId;
              const trackedPaywallId =
                editSessionId === undefined ? undefined : tracker.paywallIdFor(editSessionId);
              const paywallId =
                typeof record?.paywallId === "string" ? record.paywallId : trackedPaywallId;
              tracker.observe(tool.descriptor.name, prepared, result);
              return {
                content: contentOf(result),
                details: {
                  toolName: tool.descriptor.name,
                  output: result.output,
                  ...(editSessionId === undefined ? {} : { editSessionId }),
                  ...(paywallId === undefined ? {} : { paywallId }),
                },
                isError: result.isError,
              };
            }),
          ),
      },
      runEffect,
    ),
  );
};
