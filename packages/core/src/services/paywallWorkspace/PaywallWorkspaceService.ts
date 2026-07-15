import { Context, Effect, Layer, Schema } from "effect";

import {
  applyDocumentEditsToTree,
  applyWorkspaceDelete,
  applyWorkspaceMove,
  docRelativeFromFileName,
  reconcileToTree,
  writeComponentSourceToTree,
  type ApplyWorkspaceWriteResult,
  type DocumentEdit,
  type MintedIds,
} from "@voidhash/paywall-workspace";

import { PaywallNotFoundError } from "../../domain/paywall/Paywall.ts";
import { MimicHost } from "../paywalls/MimicHost.ts";
import { PaywallService } from "../paywalls/PaywallService.ts";
import { ComponentManifestCacheError } from "./ComponentManifestCacheService.ts";

/**
 * Catch-all error raised by {@link PaywallWorkspaceService} public methods —
 * wraps DB, mimic-host, and manifest-cache failures at the boundary so RPC
 * handlers see one stable tag.
 */
export class PaywallWorkspaceServiceError extends Schema.TaggedErrorClass<PaywallWorkspaceServiceError>(
  "PaywallWorkspaceServiceError",
)("PaywallWorkspaceServiceError", { message: Schema.String }) {}

/**
 * A workspace file write was rejected before it could be submitted — the source
 * failed to lower into a command batch (a component that does not compile, an
 * unwritable path). Carries the workspace diagnostics so the caller can show
 * them; this is an *expected* outcome of writing bad source, never a defect.
 */
export class WorkspaceWriteRejectedError extends Schema.TaggedErrorClass<WorkspaceWriteRejectedError>(
  "WorkspaceWriteRejectedError",
)("WorkspaceWriteRejectedError", {
  message: Schema.String,
  diagnostics: Schema.Array(Schema.Struct({ message: Schema.String })),
}) {}

/**
 * A write could not be committed because the document kept advancing under
 * concurrent writers: every re-read + re-reconcile + resubmit within the bounded
 * retry budget lost the optimistic-concurrency race. Rare (writes are small and
 * the DO linearizes); surfaced as a typed error so the caller can retry the
 * whole operation rather than treating a live-editing collision as a crash.
 */
export class WorkspaceWriteConflictError extends Schema.TaggedErrorClass<WorkspaceWriteConflictError>(
  "WorkspaceWriteConflictError",
)("WorkspaceWriteConflictError", { message: Schema.String }) {}

/** Max read-modify-resubmit attempts before a write gives up with a conflict. */
const WRITE_MAX_ATTEMPTS = 3;

/**
 * One diagnostic surfaced by a workspace write or a diagnostics query — the
 * message plus an optional position/phase and a `severity`. Structurally the
 * union of a compile-phase diagnostic and a lowering info diagnostic; `severity`
 * distinguishes a blocking compile `error` from a non-blocking `info`.
 */
export interface WorkspaceDiagnostic {
  readonly message: string;
  readonly severity: "error" | "info";
  readonly phase?: string;
  readonly line?: number;
  readonly column?: number;
}

/**
 * Result of a committed workspace mutation that carries no compile phase
 * (rename / delete): the document version after the mutation, the number of
 * commands submitted (`0` for a no-op), plus any info-level lowering diagnostics
 * that rode along (always empty for rename/delete today; kept for shape parity).
 */
export interface WorkspaceMutationResult {
  readonly version: number;
  readonly commandCount: number;
  readonly diagnostics: ReadonlyArray<WorkspaceDiagnostic>;
}

/** A workspace paywall directory: its stable slug + backing paywall id. */
export interface WorkspacePaywallDir {
  readonly slug: string;
  readonly paywallId: string;
}

/**
 * A workspace mutation lowering: a pure transform of the live raw document tree
 * into a mimic command batch (or a typed rejection). The shared
 * read-lower-submit-retry machinery ({@link submitLoop}) runs it.
 */
export type WorkspaceLowering = (
  tree: unknown,
) => Effect.Effect<
  ApplyWorkspaceWriteResult,
  WorkspaceWriteRejectedError | ComponentManifestCacheError
>;

/**
 * The pre-turn checkpoint hook threaded through a submit: invoked exactly once,
 * with the attempt-0 pre-turn document image, and ONLY when the transaction is
 * accepted (a rejected-only or no-op turn never fires it). Kept as an optional
 * seam on the shared submit machinery; no live caller threads one today.
 */
export type WorkspaceOnFirstRead = (input: {
  readonly paywallId: string;
  readonly tree: unknown;
  readonly version: number;
}) => Effect.Effect<void>;

/**
 * Result of a committed {@link PaywallWorkspaceService.editDocument}: the
 * post-commit document version, the number of reconcile commands submitted
 * (`0` = a no-op that changed nothing), and the ids minted for every node an
 * `insert` / `replaceChildren` op created — keyed by the op's index in the
 * submitted batch, so the caller can hand them back to the model.
 */
export interface EditDocumentResult {
  readonly version: number;
  readonly commandCount: number;
  readonly mintedIds: MintedIds;
}

/**
 * `PaywallWorkspaceService` is the server-side, document-first workspace over a
 * project's paywalls. It lists paywall directories cheaply from the Postgres
 * `paywall` table ({@link listPaywalls}), reads a paywall's LIVE document
 * ({@link readDocument} / {@link readDocumentTree}, the AI `read_paywall` /
 * checkpoint surfaces), and mutates it: {@link editDocument} applies validated
 * document ops, {@link writeComponentSource} / {@link moveComponentFile} /
 * {@link deleteComponentFile} manage code components by path, and
 * {@link revertDocument} reverts to a captured checkpoint. Every mutation goes
 * through the shared read-lower-submit-retry loop.
 *
 * **Authorization**: the service talks to mimic as `root`, so authz is enforced
 * here — {@link PaywallService.getPaywalls}/`getPaywallById` run the caller's
 * project-membership check, and a read resolves the slug to a paywall that must
 * belong to `projectId`. `PaywallService` and `MimicHost` are provided by the
 * application root.
 */
export class PaywallWorkspaceService extends Context.Service<PaywallWorkspaceService>()(
  "PaywallWorkspaceService",
  {
    make: Effect.gen(function* () {
      const paywallService = yield* PaywallService;
      const mimicHost = yield* MimicHost;

      /**
       * Lists the project's non-archived paywall directories (slug + id), one
       * cheap Postgres query, no snapshot reads. Authorization is the caller's
       * project-membership check inside `getPaywalls`.
       */
      const listPaywalls = (projectId: string) =>
        Effect.gen(function* () {
          const paywalls = yield* paywallService.getPaywalls(projectId);
          return paywalls.map(
            (paywall): WorkspacePaywallDir => ({ slug: paywall.slug, paywallId: paywall.id }),
          );
        });

      /**
       * Resolves a paywall by slug within the project (authz: the slug must
       * belong to `projectId`), failing not-found otherwise. Shared by the
       * document reads and the component mutations.
       */
      const resolvePaywallBySlug = (projectId: string, paywallSlug: string) =>
        Effect.gen(function* () {
          const paywalls = yield* paywallService.getPaywalls(projectId);
          const paywall = paywalls.find((candidate) => candidate.slug === paywallSlug);
          if (paywall === undefined) {
            return yield* Effect.fail(
              new PaywallNotFoundError({
                message: `No paywall with slug "${paywallSlug}" in project ${projectId}`,
              }),
            );
          }
          return paywall;
        });

      /**
       * Reads the current LIVE document for `paywallId` (by id, not slug):
       * ensures the mimic document exists and returns its RAW encoded `tree` (the
       * `TreeValue` a checkpoint stores and `reconcile()`/`revertDocument` consume),
       * its decoded renderer `root` (`roots[0]` — the shape `serializeDocument`
       * cleans for the model), and the optimistic-concurrency `version`, all from
       * ONE consistent read (see {@link MimicHostShape.getPaywallDocument}).
       *
       * The stored paywall is loaded first through {@link PaywallService}, so
       * direct callers cannot bypass project authorization by supplying a raw
       * mimic document id. Used by server-side workspace inspection (reads
       * `tree`) and by {@link readDocument} (reads `root`).
       */
      const readDocumentTree = (paywallId: string) =>
        Effect.gen(function* () {
          yield* paywallService.getPaywallById(paywallId);
          yield* mimicHost.ensurePaywallDocument(paywallId);
          const document = yield* mimicHost.getPaywallDocument(paywallId);
          return {
            tree: document.tree,
            root: document.root,
            version: document.version,
          } satisfies { tree: unknown; root: unknown; version: number };
        }).pipe(
          Effect.catchTags({
            MimicHostError: (error) =>
              Effect.fail(
                new PaywallWorkspaceServiceError({
                  message:
                    error.cause.length > 0 ? `${error.message} (${error.cause})` : error.message,
                }),
              ),
          }),
        );

      /**
       * Resolves a paywall by slug within the project (authz: the slug must
       * belong to `projectId`) and reads one consistent snapshot of its live
       * document. Returns the paywall identity alongside the raw tree, decoded
       * renderer root, and optimistic-concurrency version. Read-only.
       */
      const readDocument = (projectId: string, paywallSlug: string) =>
        Effect.gen(function* () {
          const paywall = yield* resolvePaywallBySlug(projectId, paywallSlug);
          const document = yield* readDocumentTree(paywall.id);
          return {
            slug: paywall.slug,
            name: paywall.name,
            paywallId: paywall.id,
            tree: document.tree,
            root: document.root,
            version: document.version,
          } satisfies {
            slug: string;
            name: string;
            paywallId: string;
            tree: unknown;
            root: unknown;
            version: number;
          };
        });

      /**
       * A workspace mutation, expressed as a pure lowering of the live raw
       * document tree to a command batch (or a rejection). Rename and delete
       * reduce to one of these; the shared {@link submitLoop} runs the
       * read-lower-submit-retry machinery around it.
       */
      type Lowering = WorkspaceLowering;

      /**
       * Optional pre-image capture: invoked with the pre-turn document image
       * (its raw tree + version) — the tree read on the FIRST attempt, BEFORE any
       * write — but only once the transaction is ACCEPTED. Used by the AI turn
       * loop to checkpoint the pre-turn state exactly once per document per turn.
       * A rejected-only or no-op turn never fires it, so it never inserts a
       * checkpoint the caller could later revert to (clobbering concurrent human
       * edits for a turn that never modified the document).
       */
      type OnFirstRead = WorkspaceOnFirstRead;

      /**
       * One read-lower-submit attempt: read the live document, lower it to a
       * command batch (rejection fails with diagnostics), submit at the read
       * version. Returns the pre-write `preImage` (this attempt's read tree +
       * version) so {@link submitLoop} can hold the attempt-0 image for a
       * post-accept checkpoint. Returns done+result (accepted or a committed
       * no-op) or `done: false` to retry on conflict.
       */
      const attemptTransaction = (paywallId: string, lower: Lowering) =>
        Effect.gen(function* () {
          const document = yield* mimicHost.getPaywallDocument(paywallId);
          const preImage = { tree: document.tree, version: document.version };
          const lowered = yield* lower(document.tree);

          if (lowered.kind === "rejected") {
            return yield* Effect.fail(
              new WorkspaceWriteRejectedError({
                message: "The workspace mutation was rejected",
                diagnostics: lowered.diagnostics.map((d) => ({ message: d.message })),
              }),
            );
          }

          // Info-level lowering diagnostics (duplicate inline ids on a
          // composition write) ride along on the committed result.
          const loweringDiagnostics: WorkspaceDiagnostic[] = (lowered.diagnostics ?? []).map(
            (d) => ({ message: d.message, severity: "info" as const }),
          );

          // A no-op (unchanged source) commits nothing — report the live version.
          if (lowered.commands.length === 0) {
            return {
              done: true as const,
              accepted: false as const,
              result: { version: document.version, commandCount: 0 },
              loweringDiagnostics,
              preImage,
            };
          }

          const submitted = yield* mimicHost.submitPaywallTransaction(paywallId, {
            baseVersion: document.version,
            commands: lowered.commands,
          });

          if (submitted.accepted) {
            return {
              done: true as const,
              accepted: true as const,
              result: { version: submitted.version, commandCount: lowered.commands.length },
              loweringDiagnostics,
              preImage,
            };
          }
          // Version conflict (or a batch the DO refused against the advanced
          // document): re-read + re-reconcile on the next attempt.
          return {
            done: false as const,
            accepted: false as const,
            result: undefined,
            loweringDiagnostics: [],
            preImage,
          };
        });

      /**
       * The shared read-lower-submit-retry loop behind every workspace mutation.
       * Runs {@link attemptTransaction} up to {@link WRITE_MAX_ATTEMPTS} times,
       * re-reading and re-lowering on a version conflict, and fails with a
       * {@link WorkspaceWriteConflictError} once the budget is exhausted. Returns
       * the committed `{version, commandCount}` plus the info-level lowering
       * diagnostics that rode along.
       *
       * `onFirstRead` (the pre-turn checkpoint) fires exactly once, and ONLY when
       * the transaction is ACCEPTED — with the attempt-0 pre-turn image, not the
       * newer base a retried attempt read. A rejected-only or no-op turn never
       * captures.
       */
      const submitLoop = (paywallId: string, lower: Lowering, onFirstRead?: OnFirstRead) =>
        Effect.gen(function* () {
          let preTurnImage: { readonly tree: unknown; readonly version: number } | undefined;
          for (let attempt = 0; attempt < WRITE_MAX_ATTEMPTS; attempt += 1) {
            const outcome = yield* attemptTransaction(paywallId, lower);
            // Hold the attempt-0 (pre-turn) image; later retries read a newer
            // base, but the checkpoint must always be the pre-turn tree.
            if (attempt === 0) {
              preTurnImage = outcome.preImage;
            }
            if (outcome.done) {
              // Capture only on acceptance — a committed no-op (commandCount 0)
              // did not modify the document, so it must not checkpoint either.
              if (outcome.accepted && onFirstRead !== undefined && preTurnImage !== undefined) {
                yield* onFirstRead({
                  paywallId,
                  tree: preTurnImage.tree,
                  version: preTurnImage.version,
                });
              }
              return outcome;
            }
          }
          return yield* Effect.fail(
            new WorkspaceWriteConflictError({
              message: `Workspace mutation lost the concurrency race after ${WRITE_MAX_ATTEMPTS} attempts.`,
            }),
          );
        });

      /**
       * Moves a code component (a file rename): repaths the `codeComponent`
       * definition AND re-points every local instance referencing it, mirroring
       * the pure {@link applyWorkspaceMove}. A component's identity IS its path, so
       * a rename is a path move. `fromFileName`/`toFileName` are `<basename>.tsx`
       * file names; the move is rejected when `toFileName` is invalid or a
       * component already lives at the target path (both caught in the lowering).
       */
      const moveComponentFile = (
        projectId: string,
        paywallSlug: string,
        fromFileName: string,
        toFileName: string,
        onFirstRead?: OnFirstRead,
      ) =>
        Effect.gen(function* () {
          const paywall = yield* resolvePaywallBySlug(projectId, paywallSlug);
          yield* mimicHost.ensurePaywallDocument(paywall.id);
          const fromPath = docRelativeFromFileName(fromFileName);
          const toPath = docRelativeFromFileName(toFileName);
          const outcome = yield* submitLoop(
            paywall.id,
            (tree) => Effect.succeed(applyWorkspaceMove({ fromPath, toPath, tree })),
            onFirstRead,
          );
          return {
            ...outcome.result,
            diagnostics: outcome.loweringDiagnostics,
          } satisfies WorkspaceMutationResult;
        }).pipe(
          Effect.catchTags({
            MimicHostError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
          }),
        );

      /**
       * Deletes a code component (removes ONLY the `codeComponent` definition
       * node, mirroring the browser's `removeCodeComponent`; `component` instances
       * that reference it are left in place and degrade to placeholders in the
       * designer — never cascade-deleted). Addressed by `fileName`
       * (`<basename>.tsx`); an unknown component is rejected with diagnostics.
       */
      const deleteComponentFile = (
        projectId: string,
        paywallSlug: string,
        fileName: string,
        onFirstRead?: OnFirstRead,
      ) =>
        Effect.gen(function* () {
          const paywall = yield* resolvePaywallBySlug(projectId, paywallSlug);
          yield* mimicHost.ensurePaywallDocument(paywall.id);
          const path = docRelativeFromFileName(fileName);
          const outcome = yield* submitLoop(
            paywall.id,
            (tree) => Effect.succeed(applyWorkspaceDelete({ path, tree })),
            onFirstRead,
          );
          return {
            ...outcome.result,
            diagnostics: outcome.loweringDiagnostics,
          } satisfies WorkspaceMutationResult;
        }).pipe(
          Effect.catchTags({
            MimicHostError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
          }),
        );

      /**
       * Applies a batch of ALREADY-VALIDATED {@link DocumentEdit} ops to the LIVE
       * document (no fork, no whole-target overwrite): each submit attempt
       * re-derives the target from the FRESH live tree via
       * {@link applyDocumentEditsToTree} (decode → apply ops → re-encode →
       * reconcile), so a version-conflict retry re-applies the position/id-based
       * ops against the advanced document and MERGES rather than clobbers
       * concurrent edits. The engine-minted ids for created nodes survive the
       * encode + reconcile round-trip (see {@link applyDocumentEditsToTree}); the
       * minted-id map from the accepted attempt is returned so the model can
       * address the new nodes next.
       *
       * The `edits` MUST already have passed the ai-shared `validateDocumentEdits`
       * (the caller returns its structured errors to the model); this method is the
       * apply half. No checkpoint (`onFirstRead`) — an MCP/tool edit is not a
       * revertible chat turn. Authorization is the slug-in-project resolution.
       */
      const editDocument = (
        projectId: string,
        paywallSlug: string,
        edits: readonly DocumentEdit[],
      ) =>
        Effect.gen(function* () {
          const paywall = yield* resolvePaywallBySlug(projectId, paywallSlug);
          yield* mimicHost.ensurePaywallDocument(paywall.id);
          // The lowering re-derives the target (and its minted ids) per attempt;
          // hold the accepted attempt's minted ids in a closure, since the loop
          // returns only version/commandCount. The lowering runs last on the
          // accepted attempt, so the closure holds the committed target's ids.
          let mintedIds: MintedIds = {};
          const outcome = yield* submitLoop(paywall.id, (tree) =>
            Effect.sync(() => {
              const applied = applyDocumentEditsToTree({ tree, edits });
              mintedIds = applied.mintedIds;
              return applied.result;
            }),
          );
          return {
            ...outcome.result,
            // A no-op edit (commandCount 0) committed no new nodes — the applier's
            // pre-minted ids never became real, so report none rather than
            // dangling ids the model cannot address.
            mintedIds: outcome.result.commandCount === 0 ? {} : mintedIds,
          } satisfies EditDocumentResult;
        }).pipe(
          Effect.catchTags({
            MimicHostError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
            ComponentManifestCacheError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
          }),
        );

      /**
       * Creates-or-replaces a code-component definition at the canonical
       * document-relative `path` (`components/<basename>.tsx`) with `source`:
       * mirrors the browser's component create/write (create the singleton
       * `library` node on first use, mint a `codeComponent` for a new path, else
       * replace the existing node's `source`). See {@link writeComponentSourceToTree}.
       *
       * The CALLER is responsible for compiling/validating the source before
       * calling this (the MCP `write_component` tool runs the headless build first
       * and commits nothing on diagnostics) — this method only commits the source.
       * Submitted through the shared version-retry loop; authorization is the
       * slug-in-project resolution.
       */
      const writeComponentSource = (
        projectId: string,
        paywallSlug: string,
        path: string,
        source: string,
      ) =>
        Effect.gen(function* () {
          const paywall = yield* resolvePaywallBySlug(projectId, paywallSlug);
          yield* mimicHost.ensurePaywallDocument(paywall.id);
          const outcome = yield* submitLoop(paywall.id, (tree) =>
            Effect.succeed(writeComponentSourceToTree({ tree, path, source })),
          );
          return {
            ...outcome.result,
            diagnostics: outcome.loweringDiagnostics,
          } satisfies WorkspaceMutationResult;
        }).pipe(
          Effect.catchTags({
            MimicHostError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
            ComponentManifestCacheError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
          }),
        );

      /**
       * Reverts a document to a previously captured pre-turn `tree` (a checkpoint
       * pre-image): read the current tree → `reconcile(current, captured)` →
       * submit as a normal transaction through the shared retry loop. The document
       * DO linearizes it and fans it out over WS, so an open designer converges to
       * the reverted state. Returns the committed `{version, commandCount}`; a
       * `commandCount` of `0` means the document already matched the checkpoint.
       *
       * The stored paywall is authorized again before the root mimic transaction,
       * so a forged or stale checkpoint cannot turn this raw-id operation into a
       * project-boundary bypass.
       */
      const revertDocument = (paywallId: string, capturedTree: unknown) =>
        Effect.gen(function* () {
          yield* paywallService.getPaywallById(paywallId);
          yield* mimicHost.ensurePaywallDocument(paywallId);
          const outcome = yield* submitLoop(paywallId, (current) =>
            Effect.succeed(reconcileToTree({ current, target: capturedTree })),
          );
          return outcome.result satisfies { version: number; commandCount: number };
        }).pipe(
          Effect.catchTags({
            MimicHostError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
            // The revert lowering never produces this (it is a pure reconcile), but
            // the shared `Lowering` type surfaces it — map to the service boundary.
            ComponentManifestCacheError: (error) =>
              Effect.fail(new PaywallWorkspaceServiceError({ message: error.message })),
          }),
        );

      return {
        listPaywalls,
        readDocumentTree,
        readDocument,
        editDocument,
        writeComponentSource,
        moveComponentFile,
        deleteComponentFile,
        revertDocument,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(PaywallWorkspaceService)(PaywallWorkspaceService.make);
}
