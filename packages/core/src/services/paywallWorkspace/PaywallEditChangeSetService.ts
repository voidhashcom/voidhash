import { and, Db, eq, PaywallEditChangeSetStatus, paywallEditChangeSets } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import { ActionForbiddenError } from "../../domain/auth/Auth.ts";
import { generateId } from "../../utils/generate-id.ts";
import { PaywallWorkspaceService } from "./PaywallWorkspaceService.ts";

/** A requested paywall edit change set does not exist in the authenticated project. */
export class PaywallEditChangeSetNotFoundError extends Schema.TaggedErrorClass<PaywallEditChangeSetNotFoundError>(
  "PaywallEditChangeSetNotFoundError",
)("PaywallEditChangeSetNotFoundError", { message: Schema.String }) {}

/** The requested change-set transition is invalid for its current state. */
export class PaywallEditChangeSetConflictError extends Schema.TaggedErrorClass<PaywallEditChangeSetConflictError>(
  "PaywallEditChangeSetConflictError",
)("PaywallEditChangeSetConflictError", { message: Schema.String }) {}

export interface ActivePaywallEditChangeSet {
  readonly id: string;
  readonly projectId: string;
  readonly paywallId: string;
  readonly paywallSlug: string;
  readonly baselineVersion: number;
}

/**
 * Persists MCP paywall edit sessions and enforces their begin/preview/finish or
 * revert lifecycle across otherwise stateless HTTP requests.
 */
export class PaywallEditChangeSetService extends Context.Service<PaywallEditChangeSetService>()(
  "PaywallEditChangeSetService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const workspace = yield* PaywallWorkspaceService;

      const find = (projectId: string, changeSetId: string) =>
        db.query.paywallEditChangeSets.findFirst({
          where: { id: changeSetId, projectId },
        });

      const requireRow = (projectId: string, changeSetId: string) =>
        Effect.gen(function* () {
          const row = yield* find(projectId, changeSetId);
          if (row === undefined) {
            return yield* Effect.fail(
              new PaywallEditChangeSetNotFoundError({
                message: `No paywall edit change set "${changeSetId}" exists in this project.`,
              }),
            );
          }
          return row;
        });

      const requireActive = (input: {
        readonly projectId: string;
        readonly changeSetId: string;
        readonly paywallSlug: string;
        readonly agentSessionId?: string;
      }) =>
        Effect.gen(function* () {
          const row = yield* requireRow(input.projectId, input.changeSetId);
          if (input.agentSessionId !== undefined && row.agentSessionId !== input.agentSessionId) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "This change set does not belong to the active agent session.",
              }),
            );
          }
          if (row.paywallSlug !== input.paywallSlug) {
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message: `Change set "${input.changeSetId}" belongs to paywall "${row.paywallSlug}", not "${input.paywallSlug}".`,
              }),
            );
          }
          if (row.status !== PaywallEditChangeSetStatus.active) {
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message: `Change set "${input.changeSetId}" is ${row.status}; only active change sets can be edited.`,
              }),
            );
          }
          return {
            id: row.id,
            projectId: row.projectId,
            paywallId: row.paywallId,
            paywallSlug: row.paywallSlug,
            baselineVersion: row.baselineVersion,
          } satisfies ActivePaywallEditChangeSet;
        });

      const begin = (projectId: string, paywallSlug: string, agentSessionId?: string) =>
        Effect.gen(function* () {
          const document = yield* workspace.readDocument(projectId, paywallSlug);
          const existing = yield* db.query.paywallEditChangeSets.findFirst({
            where: {
              projectId,
              paywallId: document.paywallId,
              status: PaywallEditChangeSetStatus.active,
            },
          });
          if (existing !== undefined) {
            if (agentSessionId !== undefined && existing.agentSessionId === agentSessionId) {
              return {
                id: existing.id,
                paywallId: existing.paywallId,
                paywallSlug: existing.paywallSlug,
                baselineVersion: existing.baselineVersion,
              };
            }
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message: `Paywall "${paywallSlug}" already has active change set "${existing.id}". Finish or revert it before beginning another.`,
              }),
            );
          }

          const id = generateId("paywallEditChangeSet");
          yield* db.insert(paywallEditChangeSets).values({
            id,
            ...(agentSessionId === undefined ? {} : { agentSessionId }),
            projectId,
            paywallId: document.paywallId,
            paywallSlug: document.slug,
            baselineTree: document.tree,
            baselineVersion: document.version,
            status: PaywallEditChangeSetStatus.active,
          });
          return {
            id,
            paywallId: document.paywallId,
            paywallSlug: document.slug,
            baselineVersion: document.version,
          };
        });

      const recordPreview = (input: {
        readonly projectId: string;
        readonly changeSetId: string;
        readonly paywallSlug: string;
        readonly agentSessionId?: string;
        readonly documentSignature: string;
        readonly documentVersion: number;
      }) =>
        Effect.gen(function* () {
          yield* requireActive(input);
          yield* db
            .update(paywallEditChangeSets)
            .set({
              lastPreviewSignature: input.documentSignature,
              lastPreviewVersion: input.documentVersion,
            })
            .where(
              and(
                eq(paywallEditChangeSets.id, input.changeSetId),
                eq(paywallEditChangeSets.projectId, input.projectId),
                eq(paywallEditChangeSets.status, PaywallEditChangeSetStatus.active),
              ),
            );
        });

      const finish = (input: {
        readonly projectId: string;
        readonly changeSetId: string;
        readonly paywallSlug: string;
        readonly agentSessionId?: string;
        readonly reviewedDocumentSignature: string;
        readonly currentDocumentSignature: string;
        readonly currentDocumentVersion: number;
        readonly verdict: string;
      }) =>
        Effect.gen(function* () {
          const row = yield* requireRow(input.projectId, input.changeSetId);
          if (input.agentSessionId !== undefined && row.agentSessionId !== input.agentSessionId) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "This change set does not belong to the active agent session.",
              }),
            );
          }
          if (row.paywallSlug !== input.paywallSlug) {
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message: `Change set "${input.changeSetId}" belongs to paywall "${row.paywallSlug}", not "${input.paywallSlug}".`,
              }),
            );
          }
          if (row.status !== PaywallEditChangeSetStatus.active) {
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message: `Change set "${input.changeSetId}" is already ${row.status}.`,
              }),
            );
          }
          if (
            row.lastPreviewSignature === null ||
            row.lastPreviewVersion === null ||
            row.lastPreviewSignature !== input.reviewedDocumentSignature ||
            row.lastPreviewSignature !== input.currentDocumentSignature ||
            row.lastPreviewVersion !== input.currentDocumentVersion
          ) {
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message:
                  "The reviewed preview is stale or missing. Render a new get_paywall_preview and finish with its documentSignature.",
              }),
            );
          }
          const now = new Date();
          yield* db
            .update(paywallEditChangeSets)
            .set({
              status: PaywallEditChangeSetStatus.finished,
              reviewVerdict: input.verdict,
              finishedAt: now,
            })
            .where(
              and(
                eq(paywallEditChangeSets.id, input.changeSetId),
                eq(paywallEditChangeSets.projectId, input.projectId),
                eq(paywallEditChangeSets.status, PaywallEditChangeSetStatus.active),
              ),
            );
          return { id: row.id, status: PaywallEditChangeSetStatus.finished } as const;
        });

      const revert = (projectId: string, changeSetId: string) =>
        Effect.gen(function* () {
          const row = yield* requireRow(projectId, changeSetId);
          if (row.status === PaywallEditChangeSetStatus.reverted) {
            return yield* Effect.fail(
              new PaywallEditChangeSetConflictError({
                message: `Change set "${changeSetId}" has already been reverted.`,
              }),
            );
          }
          if (row.status === PaywallEditChangeSetStatus.finished) {
            const document = yield* workspace.readDocument(projectId, row.paywallSlug);
            if (row.lastPreviewVersion === null || document.version !== row.lastPreviewVersion) {
              return yield* Effect.fail(
                new PaywallEditChangeSetConflictError({
                  message:
                    "The paywall changed after this change set was reviewed, so reverting it would overwrite newer work.",
                }),
              );
            }
            const active = yield* db.query.paywallEditChangeSets.findFirst({
              where: {
                projectId,
                paywallId: row.paywallId,
                status: PaywallEditChangeSetStatus.active,
              },
            });
            if (active !== undefined && active.id !== row.id) {
              return yield* Effect.fail(
                new PaywallEditChangeSetConflictError({
                  message: `Change set "${active.id}" is now active for this paywall. Finish or revert it first.`,
                }),
              );
            }
          }
          const result = yield* workspace.revertDocument(row.paywallId, row.baselineTree);
          yield* db
            .update(paywallEditChangeSets)
            .set({ status: PaywallEditChangeSetStatus.reverted, finishedAt: new Date() })
            .where(
              and(
                eq(paywallEditChangeSets.id, changeSetId),
                eq(paywallEditChangeSets.projectId, projectId),
                eq(paywallEditChangeSets.status, row.status),
              ),
            );
          return { ...result, paywallSlug: row.paywallSlug };
        });

      const revertForAgentSession = (
        projectId: string,
        changeSetId: string,
        agentSessionId: string,
      ) =>
        Effect.gen(function* () {
          const row = yield* requireRow(projectId, changeSetId);
          if (row.agentSessionId !== agentSessionId) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "This change set does not belong to the requested agent session.",
              }),
            );
          }
          return yield* revert(projectId, changeSetId);
        });

      return {
        begin,
        requireActive,
        recordPreview,
        finish,
        revert,
        revertForAgentSession,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(PaywallEditChangeSetService)(PaywallEditChangeSetService.make);
}
