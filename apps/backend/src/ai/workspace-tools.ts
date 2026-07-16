/**
 * Stateful document-editing tool core: ONE implementation of each MCP
 * `tools/call` handler,
 * consumed by the MCP JSON-RPC frontend (`routes/mcp.ts`).
 *
 * Individual MCP HTTP requests are server-executed, while `editSessionId` keeps
 * a leased Mimic participant connection alive across them. There is no fork, no
 * `paywall.tsx`, and no whole-target overwrite. The surface is document-first —
 * composition is edited as Mimic document ops and code components are managed by
 * path:
 *
 * - `list_paywalls` — the project's paywall ids, slugs, and directories.
 * - `begin_paywall_edit` / `finish_paywall_edit` / `revert_paywall_edit` — a
 *   version- and preview-bound edit lifecycle.
 * - `get_paywall({ editSessionId, nodeId?, depth? })` — cleaned document JSON.
 * - `get_components({ editSessionId })` — catalog, local, and builtin components.
 * - `read_component({ editSessionId, path })` — a local component's TSX source.
 * - `edit_paywall({ editSessionId, edits })` — an ATOMIC batch of document ops against
 *   the LIVE document (schema-validated, then reconciled+submitted with retry).
 * - `duplicate_subtree` — copy an existing visual subtree with fresh node ids.
 * - `write_component({ editSessionId, path, source })` — server-VALIDATED (headless build)
 *   then committed; diagnostics commit nothing.
 * - `rename_component` / `delete_component` — path move / placeholder-degrade.
 * - `get_paywall_preview` — a PNG plus the exact document version/signature it
 *   represents, which must be supplied when finishing.
 *
 * Each tool is a function `(scope, input) → Effect<ToolResult, never, Deps>`: it
 * runs the matching workspace effect and folds the outcome into a client-facing
 * string. Expected failures (rejections, conflicts, not-found) become a readable
 * `{ isError: true }` message rather than a thrown error. The Effect itself never
 * fails (`E = never`); the frontend provides its context.
 */
import {
  ComponentCompiler,
  ComponentManifestCacheService,
  componentServingPreviewKey,
  PaywallArtifactStore,
  PaywallDeployService,
  PaywallEditSessionService,
  PaywallWorkspaceService,
  SnapshotImageRenderer,
  type CompileExtractResult,
} from "@voidhash/core/services";
import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import {
  serializeDocument,
  validateDocumentEdits,
  type DocumentEdit,
  type EditableDocumentNode,
  type NodeInput,
  type SnapshotDocumentNode,
} from "@voidhash/ai-shared";
import { listBuiltinComponents } from "@voidhash/paywall-builtins";
import {
  fileNameFromDocRelative,
  hashSource,
  validateComponentFileName,
} from "@voidhash/paywall-workspace";
import { Cause, Effect, Exit, Option } from "effect";

/** The context (services) every workspace tool closes over when it runs. */
export type WorkspaceToolDeps =
  | PaywallWorkspaceService
  | PaywallDeployService
  | ComponentManifestCacheService
  | ComponentCompiler
  | PaywallArtifactStore
  | PaywallEditSessionService
  | SnapshotImageRenderer
  | AuthSession;

export type WorkspaceToolContent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly data: string; readonly mimeType: "image/png" };

/**
 * The result of running a workspace tool. `output` is the client-facing string
 * (a formatted success or a readable failure message). `isError` is `true` when
 * the tool did not complete its intended effect (a workspace rejection/conflict/
 * not-found, or a validation failure) — the MCP frontend maps it to an
 * `isError: true` tool result.
 */
export interface WorkspaceToolResult {
  readonly output: string;
  readonly isError: boolean;
  readonly content?: ReadonlyArray<WorkspaceToolContent>;
}

/**
 * The scope a workspace tool operates over. `projectId` is authoritative — the
 * MCP frontend derives it from the API key. Internal durable sessions also
 * supply their identity so newly opened edit sessions remain agent-session-owned.
 */
export interface WorkspaceToolScope {
  readonly projectId: string;
  readonly agentSessionId?: string;
}

const okResult = (
  output: string,
  content?: ReadonlyArray<WorkspaceToolContent>,
): WorkspaceToolResult => ({
  output,
  isError: false,
  ...(content === undefined ? {} : { content }),
});
const errResult = (output: string): WorkspaceToolResult => ({ output, isError: true });

/**
 * Diagnostics riding on a typed failure (e.g. `WorkspaceWriteRejectedError`),
 * rendered as `- <message>` lines. These carry the ACTUAL rejection reasons —
 * without them the client only sees the generic envelope message and cannot
 * react.
 */
const failureDiagnosticLines = (error: unknown): string[] => {
  const diagnostics = (error as { diagnostics?: unknown }).diagnostics;
  if (!Array.isArray(diagnostics)) {
    return [];
  }
  return diagnostics.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") {
      return [];
    }
    const message = (entry as { message?: unknown }).message;
    return typeof message === "string" && message.length > 0 ? [`- ${message}`] : [];
  });
};

/**
 * Render a typed failure value as a readable message. Tagged errors that carry
 * their payload in `cause` instead of `message` (e.g. `PaywallServiceError`)
 * inherit `Error.prototype.message === ""` — naively reading `.message` yields
 * an EMPTY string. Prefer a non-empty `message`, then a `cause` payload
 * (prefixed with the error's `_tag`), then the tag alone, and never return an
 * empty string; any `diagnostics` the error carries are appended as `- ` lines.
 */
const failureMessage = (error: unknown): string => {
  const base = (() => {
    if (error !== null && typeof error === "object") {
      const { message, cause, _tag } = error as {
        message?: unknown;
        cause?: unknown;
        _tag?: unknown;
      };
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
      const tag = typeof _tag === "string" ? _tag : undefined;
      const causeText =
        typeof cause === "string" && cause.length > 0
          ? cause
          : cause instanceof Error && cause.message.length > 0
            ? cause.message
            : undefined;
      if (causeText !== undefined) {
        return tag !== undefined ? `${tag}: ${causeText}` : causeText;
      }
      if (tag !== undefined) {
        return tag;
      }
    }
    const text = String(error);
    return text.length > 0 ? text : "unknown error (no message)";
  })();
  const diagnosticLines = failureDiagnosticLines(error);
  return diagnosticLines.length > 0 ? `${base}\n${diagnosticLines.join("\n")}` : base;
};

/**
 * Run a workspace effect and fold its exit into `{ ok, value | message }`. The
 * context is supplied by the frontend (provided into the returned effect), so
 * the shared core needs no direct context access. An expected typed failure
 * becomes a readable message (see {@link failureMessage}) — never a defect the
 * frontend has to catch.
 */
const runFolded = <A>(
  effect: Effect.Effect<A, unknown, WorkspaceToolDeps>,
): Effect.Effect<
  { ok: true; value: A } | { ok: false; message: string },
  never,
  WorkspaceToolDeps
> =>
  effect.pipe(
    Effect.exit,
    Effect.map((exit) => {
      if (Exit.isSuccess(exit)) {
        return { ok: true as const, value: exit.value };
      }
      // Extract the first typed failure (`Fail` reason's `error`) from the
      // cause; a die/interrupt has no `Fail` reason, so it pretty-prints the
      // whole cause instead.
      const failure = Cause.findErrorOption(exit.cause);
      const message = Option.isSome(failure)
        ? failureMessage(failure.value)
        : Cause.pretty(exit.cause);
      return { ok: false as const, message };
    }),
  );

/** Inputs for each workspace tool, matching the MCP tool schemas. */
export interface ListPaywallsInput {}

/** Stable paywall target shared by every paywall-scoped tool. */
export interface PaywallTargetInput {
  readonly paywallId: string;
}

export interface BeginPaywallEditInput extends PaywallTargetInput {}
export interface EditSessionInput {
  readonly editSessionId: string;
}
export interface GetPaywallInput extends EditSessionInput {
  readonly nodeId?: string;
  readonly depth?: number;
}
export interface GetComponentsInput extends EditSessionInput {}
export interface ReadComponentInput extends EditSessionInput {
  readonly path: string;
}
export interface EditPaywallInput extends EditSessionInput {
  readonly edits: ReadonlyArray<DocumentEdit>;
}
export interface DuplicateSubtreeInput extends EditSessionInput {
  readonly nodeId: string;
  readonly parentId: string;
  readonly index?: number;
  readonly nextName?: string;
}
export interface WriteComponentInput extends EditSessionInput {
  readonly path: string;
  readonly source: string;
}
export interface RenameComponentInput extends EditSessionInput {
  readonly fromPath: string;
  readonly toPath: string;
}
export interface DeleteComponentInput extends EditSessionInput {
  readonly path: string;
}
export interface GetPaywallPreviewInput extends EditSessionInput {
  readonly width?: number;
  readonly height?: number;
  readonly scale?: 1 | 2;
}
export interface FinishPaywallEditInput extends EditSessionInput {
  readonly reviewedDocumentSignature: string;
  readonly verdict: string;
  readonly unresolvedIssues: ReadonlyArray<string>;
}
export interface RevertPaywallEditInput {
  readonly editSessionId: string;
}

interface ResolvedPaywallTarget {
  readonly paywallId: string;
  readonly slug: string;
}

interface ResolvedEditSession extends ResolvedPaywallTarget {
  readonly editSessionId: string;
}

/** Resolve a stable paywall id within the scoped project. */
const resolvePaywallTarget = (
  scope: WorkspaceToolScope,
  input: PaywallTargetInput,
): Effect.Effect<ResolvedPaywallTarget, Error, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const ws = yield* PaywallWorkspaceService;
    const paywalls = yield* ws.listPaywalls(scope.projectId);
    const target = paywalls.find((candidate) => candidate.paywallId === input.paywallId);
    if (target === undefined) {
      return yield* Effect.fail(
        new Error(`No paywall with id "${input.paywallId}" exists in this project.`),
      );
    }
    return target;
  });

/** Resolves and authorizes the Mimic connection represented by an edit session. */
const resolveEditSession = (
  scope: WorkspaceToolScope,
  input: EditSessionInput,
): Effect.Effect<ResolvedEditSession, unknown, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const editSessions = yield* PaywallEditSessionService;
    const session = yield* editSessions.connectActive({
      projectId: scope.projectId,
      editSessionId: input.editSessionId,
      agentSessionId: scope.agentSessionId,
    });
    return {
      editSessionId: session.editSessionId,
      paywallId: session.paywallId,
      slug: session.paywallSlug,
    };
  });

const recordSessionMutation = (
  scope: WorkspaceToolScope,
  target: ResolvedEditSession,
  result: { readonly version: number; readonly commandCount: number },
) =>
  result.commandCount === 0
    ? Effect.void
    : Effect.gen(function* () {
        const editSessions = yield* PaywallEditSessionService;
        yield* editSessions.recordMutation({
          projectId: scope.projectId,
          editSessionId: target.editSessionId,
          agentSessionId: scope.agentSessionId,
          documentVersion: result.version,
        });
      }).pipe(Effect.ignore);

/** `begin_paywall_edit` — capture the revert baseline and mint the write capability. */
export const beginPaywallEdit = (
  scope: WorkspaceToolScope,
  input: BeginPaywallEditInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const result = yield* runFolded(
      Effect.gen(function* () {
        const target = yield* resolvePaywallTarget(scope, input);
        const editSessions = yield* PaywallEditSessionService;
        return yield* scope.agentSessionId === undefined
          ? editSessions.begin({
              projectId: scope.projectId,
              paywallId: target.paywallId,
              source: "mcp",
            })
          : editSessions.begin({
              projectId: scope.projectId,
              paywallId: target.paywallId,
              source: "built_in",
              agentSessionId: scope.agentSessionId,
            });
      }),
    );
    return result.ok
      ? okResult(
          JSON.stringify({
            editSessionId: result.value.editSessionId,
            paywallId: result.value.paywallId,
            baselineVersion: result.value.baselineVersion,
          }),
        )
      : errResult(`begin_paywall_edit failed: ${result.message}`);
  });

/**
 * `list_paywalls` — the project's paywalls (stable id + slug + path) as a list.
 * MCP has no system prompt to embed the paywall set into, so it is a first-class
 * tool here.
 */
export const listPaywalls = (
  scope: WorkspaceToolScope,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const result = yield* runFolded(
      Effect.gen(function* () {
        const ws = yield* PaywallWorkspaceService;
        return yield* ws.listPaywalls(scope.projectId);
      }),
    );
    if (!result.ok) {
      return errResult(`list_paywalls failed: ${result.message}`);
    }
    if (result.value.length === 0) {
      return okResult("No paywalls in this project.");
    }
    const lines = result.value.map(
      (dir) => `- ${dir.paywallId}: slug ${dir.slug} (/paywalls/${dir.slug})`,
    );
    return okResult(`${result.value.length} paywall(s):\n${lines.join("\n")}`);
  });

/**
 * Adapt a decoded document snapshot node to the ai-shared
 * {@link EditableDocumentNode} the validator reads (`data` verbatim — the
 * validator only touches scalar/enum leaves).
 */
const toEditableNode = (node: SnapshotDocumentNode): EditableDocumentNode => ({
  id: node.id,
  type: node.type,
  data: node.data as Record<string, unknown>,
  children: (node.children ?? []).map(toEditableNode),
});

/** Resolve the target and read its decoded document root. */
const readDocumentRoot = (scope: WorkspaceToolScope, input: EditSessionInput) =>
  runFolded(
    Effect.gen(function* () {
      const target = yield* resolveEditSession(scope, input);
      const ws = yield* PaywallWorkspaceService;
      const document = yield* ws.readConnectedDocumentTree(scope.projectId, {
        paywallId: target.paywallId,
        connectionId: target.editSessionId,
      });
      return { target, document };
    }),
  );

/**
 * `get_paywall` — the paywall's LIVE document as cleaned JSON (nested
 * `{ id, type, name?, ...data, children }`, defaults stripped, CRDT internals
 * dropped). `nodeId` roots a subtree; `depth` caps the tree (deeper nodes render
 * as stubs). The `id`s are the addressing keys for `edit_paywall`.
 */
export const getPaywall = (
  scope: WorkspaceToolScope,
  input: GetPaywallInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const result = yield* readDocumentRoot(scope, input);
    if (!result.ok) {
      return errResult(`get_paywall failed: ${result.message}`);
    }
    const roots =
      result.value.document.root != null
        ? [result.value.document.root as SnapshotDocumentNode]
        : [];
    const cleaned = serializeDocument(roots, {
      ...(input.nodeId !== undefined ? { nodeId: input.nodeId } : {}),
      ...(input.depth !== undefined ? { depth: input.depth } : {}),
    });
    if (cleaned === null) {
      const label = `${result.value.target.paywallId} (${result.value.target.slug})`;
      return errResult(
        input.nodeId !== undefined
          ? `get_paywall: no node "${input.nodeId}" in paywall ${label}.`
          : `get_paywall: paywall ${label} has no document.`,
      );
    }
    return okResult(JSON.stringify(cleaned, null, 2));
  });

/**
 * Walk a decoded document root for its local `codeComponent` definitions
 * (`library` node → `codeComponent` children), returning `{ path, source }`.
 */
const localComponentsOf = (
  root: SnapshotDocumentNode | null,
): ReadonlyArray<{ readonly path: string; readonly source: string }> => {
  if (root === null) {
    return [];
  }
  const library = (root.children ?? []).find((child) => child.type === "library");
  if (library === undefined) {
    return [];
  }
  return (library.children ?? []).flatMap((node) => {
    if (node.type !== "codeComponent") {
      return [];
    }
    const data = (node.data ?? {}) as { path?: unknown; source?: unknown };
    return typeof data.path === "string" && typeof data.source === "string"
      ? [{ path: data.path, source: data.source }]
      : [];
  });
};

/**
 * `get_components` — every component placeable in the paywall: CATALOG components
 * (deployed/shared, from {@link PaywallDeployService.listComponents} — slug,
 * version, description, props/actions/slot/previewStates from their §2 manifest)
 * AND the paywall's LOCAL code components (walked from the document's `library`;
 * their manifests resolved from the content-addressed cache by source hash — a
 * component whose source has no cached manifest is listed with a
 * "manifest unavailable" note, never evaluated inline).
 */
export const getComponents = (
  scope: WorkspaceToolScope,
  input: GetComponentsInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const result = yield* runFolded(
      Effect.gen(function* () {
        const deploy = yield* PaywallDeployService;
        const ws = yield* PaywallWorkspaceService;
        const manifestCache = yield* ComponentManifestCacheService;
        const target = yield* resolveEditSession(scope, input);

        const catalog = yield* deploy.listComponents({ projectId: scope.projectId });
        const document = yield* ws.readConnectedDocumentTree(scope.projectId, {
          paywallId: target.paywallId,
          connectionId: target.editSessionId,
        });
        const locals = localComponentsOf((document.root as SnapshotDocumentNode | null) ?? null);
        const cached = yield* manifestCache.getMany(
          locals.map((local) => hashSource(local.source)),
        );

        return {
          catalog: catalog.map((component) => ({
            slug: component.slug,
            title: component.title,
            version: component.latestVersion,
            manifest: component.latest.manifest,
            previewStates: component.latest.previewStates,
          })),
          locals: locals.map((local) => {
            const row = cached.get(hashSource(local.source));
            return {
              path: local.path,
              manifest: row?.status === "ready" ? row.manifest : undefined,
            };
          }),
          builtins: listBuiltinComponents()
            .filter((builtin) => builtin.manifest.slot !== true)
            .map((builtin) => ({
              slug: builtin.slug,
              name: builtin.name,
              description: builtin.description,
              props: builtin.manifest.props,
              actions: builtin.manifest.actions,
              previewStates: builtin.manifest.previewStates,
              slot: builtin.manifest.slot ?? false,
              insertAs: { componentSource: "builtin", componentSlug: builtin.slug },
            })),
        } as const;
      }),
    );
    if (!result.ok) {
      return errResult(`get_components failed: ${result.message}`);
    }
    const { catalog, locals, builtins } = result.value;
    const sections: string[] = [];
    sections.push(
      catalog.length === 0
        ? "Catalog components: none."
        : `Catalog components (${catalog.length}):\n${JSON.stringify(catalog, null, 2)}`,
    );
    sections.push(
      locals.length === 0
        ? "Local code components: none."
        : `Local code components (${locals.length}):\n${locals
            .map((local) =>
              local.manifest !== undefined
                ? `- ${local.path}:\n${JSON.stringify(local.manifest, null, 2)}`
                : `- ${local.path}: manifest unavailable (component not yet compiled in a session — read_component to see its source).`,
            )
            .join("\n")}`,
    );
    sections.push(
      builtins.length === 0
        ? "Builtin components: none."
        : `Builtin components (${builtins.length}):\n${JSON.stringify(builtins, null, 2)}`,
    );
    return okResult(sections.join("\n\n"));
  });

/** `read_component` — a local code component's TSX source by its `components/<name>.tsx` path. */
export const readComponent = (
  scope: WorkspaceToolScope,
  input: ReadComponentInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const result = yield* readDocumentRoot(scope, input);
    if (!result.ok) {
      return errResult(`read_component failed: ${result.message}`);
    }
    const locals = localComponentsOf(
      (result.value.document.root as SnapshotDocumentNode | null) ?? null,
    );
    const component = locals.find((local) => local.path === input.path);
    if (component === undefined) {
      const available = locals.map((local) => local.path);
      return errResult(
        `read_component: no local component at "${input.path}" in paywall ${result.value.target.paywallId} (${result.value.target.slug}).${
          available.length > 0 ? ` Available: [${available.join(", ")}].` : ""
        }`,
      );
    }
    return okResult(component.source);
  });

/**
 * `edit_paywall` — an ATOMIC batch of document ops against the LIVE document. The
 * ops are validated with the schema-derived `validateDocumentEdits` against the
 * decoded tree; on failure the STRUCTURED errors are returned verbatim (the
 * model reads them to converge). On success the ops are applied and reconciled
 * into the live document through the version-retry submit loop, and the minted
 * ids for created nodes are returned so the model can address them next.
 */
export const editPaywall = (
  scope: WorkspaceToolScope,
  input: EditPaywallInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const resolved = yield* runFolded(resolveEditSession(scope, input));
    if (!resolved.ok) {
      return errResult(`edit_paywall failed: ${resolved.message}`);
    }
    const target = resolved.value;
    // Validate first (against a fresh read) so an invalid batch never opens a
    // transaction and returns the model-facing errors verbatim.
    const read = yield* readDocumentRoot(scope, input);
    if (!read.ok) {
      return errResult(`edit_paywall failed: ${read.message}`);
    }
    const root = read.value.document.root as SnapshotDocumentNode | null;
    if (root === null) {
      return errResult(
        `edit_paywall: paywall ${target.paywallId} (${target.slug}) has no document to edit.`,
      );
    }
    const validation = validateDocumentEdits(input.edits, toEditableNode(root));
    if (!validation.ok) {
      return errResult(
        `edit_paywall rejected — fix these and retry:\n${validation.errors
          .map((error) => `- [edit ${error.editIndex}] ${error.message}`)
          .join("\n")}`,
      );
    }

    const applied = yield* runFolded(
      Effect.gen(function* () {
        const ws = yield* PaywallWorkspaceService;
        const result = yield* ws.editConnectedDocument(
          scope.projectId,
          { paywallId: target.paywallId, connectionId: target.editSessionId },
          validation.edits,
        );
        yield* recordSessionMutation(scope, target, result);
        return result;
      }),
    );
    if (!applied.ok) {
      return errResult(`edit_paywall rejected: ${applied.message}`);
    }
    const { version, commandCount, mintedIds } = applied.value;
    const mintedEntries = Object.entries(mintedIds);
    const mintedNote =
      mintedEntries.length > 0
        ? `\nMinted ids (by op index): ${mintedEntries
            .map(([index, ids]) => `${index}=[${ids.join(", ")}]`)
            .join("; ")}`
        : "";
    return okResult(
      `Applied ${validation.edits.length} edit(s) to ${target.paywallId} (${target.slug}) at version ${version} (${commandCount} command${commandCount === 1 ? "" : "s"}).${mintedNote}`,
    );
  });

const isVisualNode = (node: SnapshotDocumentNode): boolean =>
  node.type !== "root" && node.type !== "library" && node.type !== "codeComponent";

/** Convert a visual snapshot subtree into an id-free document insert payload. */
const cloneNodeInput = (node: SnapshotDocumentNode): NodeInput => {
  const children = (node.children ?? []).filter(isVisualNode).map(cloneNodeInput);
  return {
    type: node.type,
    ...structuredClone((node.data ?? {}) as Record<string, unknown>),
    ...(children.length === 0 ? {} : { children }),
  } as NodeInput;
};

const findSnapshotNode = (
  root: SnapshotDocumentNode,
  nodeId: string,
): SnapshotDocumentNode | null => {
  if (root.id === nodeId) {
    return root;
  }
  for (const child of root.children ?? []) {
    const found = findSnapshotNode(child, nodeId);
    if (found !== null) {
      return found;
    }
  }
  return null;
};

/** `duplicate_subtree` — clone a visual subtree and insert it with fresh ids. */
export const duplicateSubtree = (
  scope: WorkspaceToolScope,
  input: DuplicateSubtreeInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const read = yield* readDocumentRoot(scope, input);
    if (!read.ok) {
      return errResult(`duplicate_subtree failed: ${read.message}`);
    }
    const { target, document } = read.value;
    const root = document.root as SnapshotDocumentNode | null;
    if (root === null) {
      return errResult(
        `duplicate_subtree: paywall ${target.paywallId} (${target.slug}) has no document.`,
      );
    }
    const source = findSnapshotNode(root, input.nodeId);
    if (source === null) {
      return errResult(`duplicate_subtree: no node "${input.nodeId}" in the document.`);
    }
    if (!isVisualNode(source)) {
      return errResult(
        `duplicate_subtree: cannot duplicate engine-managed ${source.type} node "${input.nodeId}".`,
      );
    }
    const node = cloneNodeInput(source);
    if (input.nextName !== undefined) {
      node.name = input.nextName;
    }
    return yield* editPaywall(scope, {
      editSessionId: input.editSessionId,
      edits: [
        {
          op: "insert",
          parentId: input.parentId,
          ...(input.index === undefined ? {} : { index: input.index }),
          node,
        },
      ],
    });
  });

/** Render a compile/extract failure's diagnostics as `- ` lines. */
const formatExtractDiagnostics = (
  result: Extract<CompileExtractResult, { status: "error" }>,
): string =>
  `[${result.phase}] compile failed:\n${result.diagnostics
    .map((d) => {
      const position =
        d.line !== undefined
          ? ` (line ${d.line}${d.column !== undefined ? `, col ${d.column}` : ""})`
          : "";
      return `- ${d.message}${position}`;
    })
    .join("\n")}`;

/**
 * `write_component` — server-VALIDATE the single component's source THEN commit:
 * run the headless {@link ComponentCompiler.compileAndExtract} (compile,
 * manifest extraction, and preview-state rendering on the container/native
 * adapter). An unavailable compiler or compile/runtime diagnostics commit
 * NOTHING. On success the source is written
 * to the `codeComponent` node
 * (created when the path is new) and, when a manifest was extracted, recorded in
 * the content-addressed cache so a later projection can resolve it.
 */
export const writeComponent = (
  scope: WorkspaceToolScope,
  input: WriteComponentInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const resolved = yield* runFolded(resolveEditSession(scope, input));
    if (!resolved.ok) {
      return errResult(`write_component failed: ${resolved.message}`);
    }
    const target = resolved.value;
    const nameError = validateComponentFileName(fileNameFromDocRelative(input.path));
    if (nameError !== undefined) {
      return errResult(`write_component rejected: ${nameError}`);
    }

    // Build the single component first. A compile/runtime error commits nothing.
    const built = yield* runFolded(
      Effect.gen(function* () {
        const compiler = yield* ComponentCompiler;
        return yield* compiler.compileAndExtract(input.source);
      }),
    );
    if (!built.ok) {
      return errResult(`write_component failed: ${built.message}`);
    }
    const build = built.value;
    if (build.status === "error") {
      return errResult(`write_component rejected: ${formatExtractDiagnostics(build)}`);
    }
    if (build.status === "unavailable") {
      return errResult(
        "write_component rejected: headless component compilation is unavailable; no source was committed.",
      );
    }

    // Commit the source (create-or-replace the codeComponent node), then record
    // the manifest extracted by the required headless compile.
    const committed = yield* runFolded(
      Effect.gen(function* () {
        const ws = yield* PaywallWorkspaceService;
        const result = yield* ws.writeConnectedComponentSource(
          scope.projectId,
          { paywallId: target.paywallId, connectionId: target.editSessionId },
          input.path,
          input.source,
        );
        yield* recordSessionMutation(scope, target, result);
        const manifestCache = yield* ComponentManifestCacheService;
        yield* manifestCache.record({
          sourceHash: hashSource(input.source),
          status: "ready",
          manifest: build.manifest,
        });
        return result;
      }),
    );
    if (!committed.ok) {
      return errResult(`write_component rejected: ${committed.message}`);
    }
    return okResult(
      `Wrote ${input.path} to ${target.paywallId} (${target.slug}) at version ${committed.value.version} (compiled clean; manifest recorded).`,
    );
  });

/**
 * `rename_component` — move a local component from `fromPath` to `toPath` (a path
 * rename): repaths the definition AND re-points every local instance referencing
 * it (rename cascade). Addressed by `components/<name>.tsx` file names.
 */
export const renameComponent = (
  scope: WorkspaceToolScope,
  input: RenameComponentInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const resolved = yield* runFolded(resolveEditSession(scope, input));
    if (!resolved.ok) {
      return errResult(`rename_component failed: ${resolved.message}`);
    }
    const target = resolved.value;
    const result = yield* runFolded(
      Effect.gen(function* () {
        const ws = yield* PaywallWorkspaceService;
        const result = yield* ws.moveConnectedComponentFile(
          scope.projectId,
          { paywallId: target.paywallId, connectionId: target.editSessionId },
          fileNameFromDocRelative(input.fromPath),
          fileNameFromDocRelative(input.toPath),
        );
        yield* recordSessionMutation(scope, target, result);
        return result;
      }),
    );
    return result.ok
      ? okResult(
          `Renamed ${input.fromPath} → ${input.toPath} in ${target.paywallId} (${target.slug}) at version ${result.value.version}.`,
        )
      : errResult(`rename_component rejected: ${result.message}`);
  });

/**
 * `delete_component` — remove a local component's `codeComponent` definition by
 * path. Existing instances of it DEGRADE to placeholders (never cascade-deleted),
 * so they should be replaced or removed afterward.
 */
export const deleteComponent = (
  scope: WorkspaceToolScope,
  input: DeleteComponentInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const resolved = yield* runFolded(resolveEditSession(scope, input));
    if (!resolved.ok) {
      return errResult(`delete_component failed: ${resolved.message}`);
    }
    const target = resolved.value;
    const result = yield* runFolded(
      Effect.gen(function* () {
        const ws = yield* PaywallWorkspaceService;
        const result = yield* ws.deleteConnectedComponentFile(
          scope.projectId,
          { paywallId: target.paywallId, connectionId: target.editSessionId },
          fileNameFromDocRelative(input.path),
        );
        yield* recordSessionMutation(scope, target, result);
        return result;
      }),
    );
    return result.ok
      ? okResult(
          `Deleted ${input.path} from ${target.paywallId} (${target.slug}) at version ${result.value.version}. Any instances of it now render as placeholders — replace or remove them.`,
        )
      : errResult(`delete_component rejected: ${result.message}`);
  });

const documentSignature = (root: unknown): string => `doc-${hashSource(JSON.stringify(root))}`;

const pngBase64 = (png: Uint8Array): string => {
  const chunks: string[] = [];
  for (let offset = 0; offset < png.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...png.subarray(offset, offset + 0x8000)));
  }
  return btoa(chunks.join(""));
};

const deployedComponentPreviewStates = (
  root: SnapshotDocumentNode | null,
): ReadonlyMap<string, ReadonlySet<string>> => {
  const statesByHash = new Map<string, Set<string>>();
  const visit = (node: SnapshotDocumentNode): void => {
    if (node.type === "component") {
      const data = (node.data ?? {}) as Record<string, unknown>;
      const contentHash = data.contentHash;
      if (data.componentSource !== "local" && typeof contentHash === "string" && contentHash) {
        const states = statesByHash.get(contentHash) ?? new Set<string>();
        states.add("default");
        if (typeof data.previewState === "string" && data.previewState) {
          states.add(data.previewState);
        }
        statesByHash.set(contentHash, states);
      }
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  if (root !== null) {
    visit(root);
  }
  return statesByHash;
};

const fetchPreviewComponentTrees = (root: SnapshotDocumentNode | null) =>
  Effect.gen(function* () {
    const store = yield* PaywallArtifactStore;
    const trees: Record<string, Record<string, unknown>> = {};
    for (const [contentHash, states] of deployedComponentPreviewStates(root)) {
      for (const state of states) {
        const object = yield* store.getObject(componentServingPreviewKey(contentHash, state));
        if (object === null) {
          continue;
        }
        const tree = yield* Effect.try({
          try: () => JSON.parse(new TextDecoder().decode(object.body)) as unknown,
          catch: () => null,
        }).pipe(Effect.orElseSucceed(() => null));
        if (tree !== null) {
          (trees[contentHash] ??= {})[state] = tree;
        }
      }
    }
    return trees;
  });

const compileLocalPreviewTrees = (root: SnapshotDocumentNode | null) =>
  Effect.gen(function* () {
    const compiler = yield* ComponentCompiler;
    const trees: Record<string, Record<string, unknown>> = {};
    for (const local of localComponentsOf(root)) {
      const result = yield* compiler.compileAndExtract(local.source);
      if (result.status === "unavailable") {
        return yield* Effect.fail(
          new Error(
            `Headless compilation is unavailable for local component ${local.path}; preview was not rendered.`,
          ),
        );
      }
      if (result.status === "error") {
        return yield* Effect.fail(
          new Error(
            `Local component ${local.path} cannot be previewed. ${formatExtractDiagnostics(result)}`,
          ),
        );
      }
      trees[local.path] = { ...result.previewTrees };
    }
    return trees;
  });

/** `get_paywall_preview` — render and return a version-bound PNG review image. */
export const getPaywallPreview = (
  scope: WorkspaceToolScope,
  input: GetPaywallPreviewInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const width = input.width ?? 375;
    const height = input.height ?? 812;
    const scale = input.scale ?? 1;
    const result = yield* runFolded(
      Effect.gen(function* () {
        const target = yield* resolveEditSession(scope, input);
        const editSessions = yield* PaywallEditSessionService;
        const workspace = yield* PaywallWorkspaceService;
        const connection = {
          paywallId: target.paywallId,
          connectionId: target.editSessionId,
        };
        const before = yield* workspace.readConnectedDocumentTree(scope.projectId, connection);
        const signature = documentSignature(before.root);
        const root = (before.root as SnapshotDocumentNode | null) ?? null;
        const componentTrees = yield* fetchPreviewComponentTrees(root);
        const localComponentTrees = yield* compileLocalPreviewTrees(root);
        const renderer = yield* SnapshotImageRenderer;
        const png = yield* renderer.render({
          snapshot: before.root,
          componentTrees,
          localComponentTrees,
          width,
          height,
          deviceScaleFactor: scale,
        });
        const after = yield* workspace.readConnectedDocumentTree(scope.projectId, connection);
        if (after.version !== before.version || documentSignature(after.root) !== signature) {
          return yield* Effect.fail(
            new Error(
              "The paywall changed while its preview was rendering. Request a fresh preview.",
            ),
          );
        }
        yield* editSessions.recordPreview({
          projectId: scope.projectId,
          editSessionId: input.editSessionId,
          agentSessionId: scope.agentSessionId,
          documentSignature: signature,
          documentVersion: before.version,
        });
        return { png, signature, version: before.version };
      }),
    );
    if (!result.ok) {
      return errResult(`get_paywall_preview failed: ${result.message}`);
    }
    const data = pngBase64(result.value.png);
    const metadata = JSON.stringify({
      kind: "paywall-preview",
      mediaType: "image/png",
      width,
      height,
      scale,
      documentVersion: result.value.version,
      documentSignature: result.value.signature,
      message: "Review this image visually before finishing the edit session.",
    });
    return okResult(metadata, [
      { type: "text", text: metadata },
      { type: "image", data, mimeType: "image/png" },
    ]);
  });

/** `finish_paywall_edit` — close an edit session after reviewing its exact latest preview. */
export const finishPaywallEdit = (
  scope: WorkspaceToolScope,
  input: FinishPaywallEditInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    if (input.unresolvedIssues.length > 0) {
      return errResult(
        `finish_paywall_edit rejected: unresolved issues remain: ${input.unresolvedIssues.join("; ")}. Correct them and render a new preview.`,
      );
    }
    const result = yield* runFolded(
      Effect.gen(function* () {
        const target = yield* resolveEditSession(scope, input);
        const workspace = yield* PaywallWorkspaceService;
        const document = yield* workspace.readConnectedDocumentTree(scope.projectId, {
          paywallId: target.paywallId,
          connectionId: target.editSessionId,
        });
        const editSessions = yield* PaywallEditSessionService;
        return yield* editSessions.finish({
          projectId: scope.projectId,
          editSessionId: input.editSessionId,
          agentSessionId: scope.agentSessionId,
          reviewedDocumentSignature: input.reviewedDocumentSignature,
          currentDocumentSignature: documentSignature(document.root),
          currentDocumentVersion: document.version,
          verdict: input.verdict,
        });
      }),
    );
    return result.ok
      ? okResult(
          `Finished edit session ${input.editSessionId} after visual review. Verdict: ${input.verdict}`,
        )
      : errResult(`finish_paywall_edit rejected: ${result.message}`);
  });

/** `revert_paywall_edit` — reconcile the live document to the captured baseline. */
export const revertPaywallEdit = (
  scope: WorkspaceToolScope,
  input: RevertPaywallEditInput,
): Effect.Effect<WorkspaceToolResult, never, WorkspaceToolDeps> =>
  Effect.gen(function* () {
    const result = yield* runFolded(
      Effect.gen(function* () {
        const editSessions = yield* PaywallEditSessionService;
        return yield* scope.agentSessionId === undefined
          ? editSessions.revert(scope.projectId, input.editSessionId)
          : editSessions.revertForAgentSession(
              scope.projectId,
              input.editSessionId,
              scope.agentSessionId,
            );
      }),
    );
    return result.ok
      ? okResult(
          `Reverted edit session ${input.editSessionId} for "${result.value.paywallSlug}" at version ${result.value.version} (${result.value.commandCount} command${result.value.commandCount === 1 ? "" : "s"}).`,
        )
      : errResult(`revert_paywall_edit failed: ${result.message}`);
  });
