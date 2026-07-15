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

const CHANGE_SET_TOOLS = new Set([
  "edit_paywall",
  "duplicate_subtree",
  "write_component",
  "rename_component",
  "delete_component",
  "get_paywall_preview",
  "finish_paywall_edit",
]);

const inputRecord = (input: unknown): Record<string, unknown> | undefined =>
  input !== null && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : undefined;

const decodedChangeSet = (
  result: WorkspaceToolResult,
): { readonly changeSetId: string; readonly slug: string } | undefined => {
  if (result.isError) return undefined;
  try {
    const value = JSON.parse(result.output) as { changeSetId?: unknown; slug?: unknown };
    return typeof value.changeSetId === "string" && typeof value.slug === "string"
      ? { changeSetId: value.changeSetId, slug: value.slug }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Tracks the server-managed edit capability used by an internal agent session. */
export class AgentChangeSetTracker {
  readonly #activeBySlug = new Map<string, string>();

  /** Returns the active change-set id for a paywall, when one has been opened. */
  readonly get = (slug: string): string | undefined => this.#activeBySlug.get(slug);

  /** Rebuilds active capabilities from persisted Pi tool-result messages. */
  readonly rehydrate = (messages: ReadonlyArray<AgentMessage>): void => {
    this.#activeBySlug.clear();
    for (const message of messages) {
      if (message.role !== "toolResult") continue;
      const details = inputRecord(message.details);
      const toolName = typeof details?.toolName === "string" ? details.toolName : message.toolName;
      const decoded =
        typeof details?.output === "string"
          ? decodedChangeSet({ output: details.output, isError: false })
          : undefined;
      const changeSetId =
        typeof details?.changeSetId === "string" ? details.changeSetId : decoded?.changeSetId;
      const slug = typeof details?.slug === "string" ? details.slug : decoded?.slug;
      if (changeSetId !== undefined && slug !== undefined) {
        this.#activeBySlug.set(slug, changeSetId);
      }
      if (message.isError) continue;
      if (toolName === "finish_paywall_edit" && slug !== undefined) {
        this.#activeBySlug.delete(slug);
      } else if (toolName === "revert_paywall_edit" && changeSetId !== undefined) {
        for (const [activeSlug, activeId] of this.#activeBySlug) {
          if (activeId === changeSetId) this.#activeBySlug.delete(activeSlug);
        }
      }
    }
  };

  /**
   * Adds the active capability to a lifecycle tool call. The first mutating call
   * for a paywall opens the change set through the same workspace implementation
   * exposed to MCP.
   */
  readonly prepare = <R>(
    toolName: string,
    input: unknown,
    begin: (slug: string) => Effect.Effect<WorkspaceToolResult, never, R>,
  ): Effect.Effect<unknown, Error, R> => {
    const record = inputRecord(input);
    if (!CHANGE_SET_TOOLS.has(toolName) || record === undefined) {
      return Effect.succeed(input);
    }
    const slug = record.slug;
    if (typeof slug !== "string" || slug.length === 0) {
      return Effect.succeed(input);
    }
    const active = this.#activeBySlug.get(slug);
    if (active !== undefined) {
      return Effect.succeed({ ...record, changeSetId: active });
    }
    return begin(slug).pipe(
      Effect.flatMap((result) => {
        const opened = decodedChangeSet(result);
        if (opened === undefined) {
          return Effect.fail(new Error(result.output));
        }
        this.#activeBySlug.set(opened.slug, opened.changeSetId);
        return Effect.succeed({ ...record, changeSetId: opened.changeSetId });
      }),
    );
  };

  /** Updates tracked lifecycle state after a workspace tool completes. */
  readonly observe = (toolName: string, input: unknown, result: WorkspaceToolResult): void => {
    if (result.isError) return;
    if (toolName === "begin_paywall_edit") {
      const opened = decodedChangeSet(result);
      if (opened !== undefined) this.#activeBySlug.set(opened.slug, opened.changeSetId);
      return;
    }
    const record = inputRecord(input);
    if (toolName === "finish_paywall_edit" && typeof record?.slug === "string") {
      this.#activeBySlug.delete(record.slug);
      return;
    }
    if (toolName === "revert_paywall_edit" && typeof record?.changeSetId === "string") {
      for (const [slug, changeSetId] of this.#activeBySlug) {
        if (changeSetId === record.changeSetId) this.#activeBySlug.delete(slug);
      }
    }
  };
}

/** Structured metadata attached to each Pi workspace-tool result. */
export interface WorkspaceAgentToolDetails {
  readonly toolName: string;
  readonly output: string;
  readonly changeSetId?: string;
  readonly slug?: string;
}

const internalParameters = (schema: Record<string, unknown>): TSchema => {
  const cloned = structuredClone(schema);
  const properties = inputRecord(cloned.properties);
  if (properties !== undefined) delete properties.changeSetId;
  const required = cloned.required;
  if (Array.isArray(required)) {
    cloned.required = required.filter((property) => property !== "changeSetId");
  }
  return cloned as unknown as TSchema;
};

const contentOf = (result: WorkspaceToolResult) =>
  result.content === undefined
    ? [{ type: "text" as const, text: result.output }]
    : result.content.map((content) => ({ ...content }));

/**
 * Adapts every shared MCP workspace tool into a Pi tool that executes through
 * the host's Effect runner. Tool names and schemas remain aligned with MCP while
 * internal change-set capabilities are injected automatically.
 */
export const makeWorkspaceAgentTools = (
  scope: WorkspaceToolScope,
  runEffect: BoundEffectRunner<WorkspaceToolDeps>,
  tracker = new AgentChangeSetTracker(),
): ReadonlyArray<AgentTool> => {
  const beginTool = MCP_TOOLS.find((tool) => tool.descriptor.name === "begin_paywall_edit");
  if (beginTool === undefined) throw new Error("begin_paywall_edit is not registered");

  return MCP_TOOLS.map((tool) =>
    makeEffectAgentToolWithRunner<unknown, WorkspaceAgentToolDetails, Error, WorkspaceToolDeps>(
      {
        name: tool.descriptor.name,
        label: tool.descriptor.name,
        description: tool.descriptor.description,
        parameters: internalParameters(tool.descriptor.inputSchema),
        effectHandler: (input) =>
          tracker
            .prepare(tool.descriptor.name, input, (slug) => beginTool.dispatch(scope, { slug }))
            .pipe(
              Effect.flatMap((prepared) =>
                tool.dispatch(scope, prepared).pipe(Effect.map((result) => ({ prepared, result }))),
              ),
              Effect.map(({ prepared, result }) => {
                const record = inputRecord(prepared);
                const slug = typeof record?.slug === "string" ? record.slug : undefined;
                const suppliedChangeSetId = record?.changeSetId;
                tracker.observe(tool.descriptor.name, prepared, result);
                const changeSetId =
                  typeof suppliedChangeSetId === "string"
                    ? suppliedChangeSetId
                    : slug === undefined
                      ? undefined
                      : tracker.get(slug);
                return {
                  content: contentOf(result),
                  details: {
                    toolName: tool.descriptor.name,
                    output: result.output,
                    ...(changeSetId === undefined ? {} : { changeSetId }),
                    ...(slug === undefined ? {} : { slug }),
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
