import { and, Db, eq, PaywallEditSessionStatus, paywallEditSessions, sql } from "@voidhash/db";
import { Context, Effect, Layer, Schema } from "effect";

import { ActionForbiddenError } from "../../domain/auth/Auth.ts";
import { generateId } from "../../utils/generate-id.ts";
import { PaywallWorkspaceService } from "./PaywallWorkspaceService.ts";

/** A requested paywall edit session does not exist in the authenticated project. */
export class PaywallEditSessionNotFoundError extends Schema.TaggedErrorClass<PaywallEditSessionNotFoundError>(
  "PaywallEditSessionNotFoundError",
)("PaywallEditSessionNotFoundError", { message: Schema.String }) {}

/** The requested edit-session transition is invalid for its current state. */
export class PaywallEditSessionConflictError extends Schema.TaggedErrorClass<PaywallEditSessionConflictError>(
  "PaywallEditSessionConflictError",
)("PaywallEditSessionConflictError", { message: Schema.String }) {}

export interface ActivePaywallEditSession {
  readonly editSessionId: string;
  readonly projectId: string;
  readonly paywallId: string;
  readonly paywallSlug: string;
  readonly baselineVersion: number;
}

export type BeginPaywallEditSessionInput = {
  readonly projectId: string;
  readonly paywallId: string;
} & (
  | { readonly source: "mcp"; readonly agentSessionId?: never }
  | { readonly source: "built_in"; readonly agentSessionId: string }
);

/**
 * Persists agent paywall edit sessions while each row's id doubles as the
 * leased Mimic document connection handle.
 */
export class PaywallEditSessionService extends Context.Service<PaywallEditSessionService>()(
  "PaywallEditSessionService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const workspace = yield* PaywallWorkspaceService;

      const find = (projectId: string, editSessionId: string) =>
        db.query.paywallEditSessions.findFirst({
          where: { id: editSessionId, projectId },
        });

      const requireRow = (projectId: string, editSessionId: string) =>
        Effect.gen(function* () {
          const row = yield* find(projectId, editSessionId);
          if (row === undefined) {
            return yield* Effect.fail(
              new PaywallEditSessionNotFoundError({
                message: `No paywall edit session "${editSessionId}" exists in this project.`,
              }),
            );
          }
          return row;
        });

      const requireActive = (input: {
        readonly projectId: string;
        readonly editSessionId: string;
        readonly agentSessionId?: string;
      }) =>
        Effect.gen(function* () {
          const row = yield* requireRow(input.projectId, input.editSessionId);
          if (input.agentSessionId !== undefined && row.agentSessionId !== input.agentSessionId) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "This edit session does not belong to the active agent session.",
              }),
            );
          }
          if (row.status !== PaywallEditSessionStatus.active) {
            return yield* Effect.fail(
              new PaywallEditSessionConflictError({
                message: `Edit session "${input.editSessionId}" is ${row.status}; only active sessions can be edited.`,
              }),
            );
          }
          return {
            editSessionId: row.id,
            projectId: row.projectId,
            paywallId: row.paywallId,
            paywallSlug: row.paywallSlug,
            baselineVersion: row.baselineVersion,
          } satisfies ActivePaywallEditSession;
        });

      const connectActive = (input: {
        readonly projectId: string;
        readonly editSessionId: string;
        readonly agentSessionId?: string;
      }) =>
        Effect.gen(function* () {
          const session = yield* requireActive(input);
          const source = input.agentSessionId === undefined ? "mcp" : "built_in";
          yield* workspace
            .heartbeatDocumentConnection(session.projectId, {
              paywallId: session.paywallId,
              connectionId: session.editSessionId,
            })
            .pipe(
              Effect.catch(() =>
                workspace
                  .openDocumentConnection(
                    session.projectId,
                    session.paywallId,
                    session.editSessionId,
                    {
                      editSessionId: session.editSessionId,
                      source,
                      name: source === "mcp" ? "MCP Agent" : "Voidhash AI",
                    },
                  )
                  .pipe(Effect.asVoid),
              ),
            );
          return session;
        });

      const begin = (input: BeginPaywallEditSessionInput) =>
        Effect.gen(function* () {
          if (input.source === "built_in") {
            const existing = yield* db.query.paywallEditSessions.findFirst({
              where: {
                agentSessionId: input.agentSessionId,
                projectId: input.projectId,
                paywallId: input.paywallId,
                status: PaywallEditSessionStatus.active,
              },
            });
            if (existing !== undefined) {
              yield* workspace.openDocumentConnection(
                input.projectId,
                existing.paywallId,
                existing.id,
                {
                  editSessionId: existing.id,
                  source: input.source,
                  name: "Voidhash AI",
                },
              );
              return {
                editSessionId: existing.id,
                paywallId: existing.paywallId,
                baselineVersion: existing.baselineVersion,
              };
            }
          }

          const editSessionId = generateId("paywallEditSession");
          const document = yield* workspace.openDocumentConnection(
            input.projectId,
            input.paywallId,
            editSessionId,
            {
              editSessionId,
              source: input.source,
              name: input.source === "mcp" ? "MCP Agent" : "Voidhash AI",
            },
          );
          yield* db
            .insert(paywallEditSessions)
            .values({
              id: editSessionId,
              ...(input.agentSessionId === undefined
                ? {}
                : { agentSessionId: input.agentSessionId }),
              projectId: input.projectId,
              paywallId: document.paywallId,
              paywallSlug: document.slug,
              baselineTree: document.tree,
              baselineVersion: document.version,
              lastAgentVersion: document.version,
              revertSafe: true,
              status: PaywallEditSessionStatus.active,
            })
            .pipe(
              Effect.catch((error) =>
                workspace
                  .closeDocumentConnection(input.projectId, {
                    paywallId: document.paywallId,
                    connectionId: editSessionId,
                  })
                  .pipe(Effect.ignore, Effect.andThen(Effect.fail(error))),
              ),
            );
          return {
            editSessionId,
            paywallId: document.paywallId,
            baselineVersion: document.version,
          };
        });

      const recordMutation = (input: {
        readonly projectId: string;
        readonly editSessionId: string;
        readonly agentSessionId?: string;
        readonly documentVersion: number;
      }) =>
        Effect.gen(function* () {
          yield* requireActive(input);
          yield* db
            .update(paywallEditSessions)
            .set({
              lastAgentVersion: sql<number>`GREATEST(${paywallEditSessions.lastAgentVersion}, ${input.documentVersion})`,
              revertSafe: sql<boolean>`${paywallEditSessions.revertSafe} AND ${paywallEditSessions.lastAgentVersion} = ${input.documentVersion - 1}`,
            })
            .where(
              and(
                eq(paywallEditSessions.id, input.editSessionId),
                eq(paywallEditSessions.projectId, input.projectId),
                eq(paywallEditSessions.status, PaywallEditSessionStatus.active),
              ),
            );
        });

      const recordPreview = (input: {
        readonly projectId: string;
        readonly editSessionId: string;
        readonly agentSessionId?: string;
        readonly documentSignature: string;
        readonly documentVersion: number;
      }) =>
        Effect.gen(function* () {
          yield* requireActive(input);
          yield* db
            .update(paywallEditSessions)
            .set({
              lastPreviewSignature: input.documentSignature,
              lastPreviewVersion: input.documentVersion,
            })
            .where(
              and(
                eq(paywallEditSessions.id, input.editSessionId),
                eq(paywallEditSessions.projectId, input.projectId),
                eq(paywallEditSessions.status, PaywallEditSessionStatus.active),
              ),
            );
        });

      const finish = (input: {
        readonly projectId: string;
        readonly editSessionId: string;
        readonly agentSessionId?: string;
        readonly reviewedDocumentSignature: string;
        readonly currentDocumentSignature: string;
        readonly currentDocumentVersion: number;
        readonly verdict: string;
      }) =>
        Effect.gen(function* () {
          const row = yield* requireRow(input.projectId, input.editSessionId);
          if (input.agentSessionId !== undefined && row.agentSessionId !== input.agentSessionId) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "This edit session does not belong to the active agent session.",
              }),
            );
          }
          if (row.status !== PaywallEditSessionStatus.active) {
            return yield* Effect.fail(
              new PaywallEditSessionConflictError({
                message: `Edit session "${input.editSessionId}" is already ${row.status}.`,
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
              new PaywallEditSessionConflictError({
                message:
                  "The reviewed preview is stale or missing. Render a new get_paywall_preview and finish with its documentSignature.",
              }),
            );
          }
          const now = new Date();
          yield* db
            .update(paywallEditSessions)
            .set({
              status: PaywallEditSessionStatus.finished,
              reviewVerdict: input.verdict,
              finishedAt: now,
            })
            .where(
              and(
                eq(paywallEditSessions.id, input.editSessionId),
                eq(paywallEditSessions.projectId, input.projectId),
                eq(paywallEditSessions.status, PaywallEditSessionStatus.active),
              ),
            );
          yield* workspace
            .closeDocumentConnection(input.projectId, {
              paywallId: row.paywallId,
              connectionId: row.id,
            })
            .pipe(Effect.ignore);
          return { editSessionId: row.id, status: PaywallEditSessionStatus.finished } as const;
        });

      const revert = (projectId: string, editSessionId: string) =>
        Effect.gen(function* () {
          const row = yield* requireRow(projectId, editSessionId);
          if (row.status === PaywallEditSessionStatus.reverted) {
            return yield* Effect.fail(
              new PaywallEditSessionConflictError({
                message: `Edit session "${editSessionId}" has already been reverted.`,
              }),
            );
          }
          const current = yield* workspace.readDocumentTree(row.paywallId);
          if (row.lastAgentVersion === row.baselineVersion) {
            yield* db
              .update(paywallEditSessions)
              .set({ status: PaywallEditSessionStatus.reverted, finishedAt: new Date() })
              .where(
                and(
                  eq(paywallEditSessions.id, editSessionId),
                  eq(paywallEditSessions.projectId, projectId),
                  eq(paywallEditSessions.status, row.status),
                ),
              );
            yield* workspace
              .closeDocumentConnection(projectId, {
                paywallId: row.paywallId,
                connectionId: row.id,
              })
              .pipe(Effect.ignore);
            return { version: current.version, commandCount: 0, paywallSlug: row.paywallSlug };
          }
          if (!row.revertSafe || current.version !== row.lastAgentVersion) {
            return yield* Effect.fail(
              new PaywallEditSessionConflictError({
                message:
                  "The paywall contains edits not made by this agent session, so reverting the session would overwrite multiplayer work.",
              }),
            );
          }
          if (row.status === PaywallEditSessionStatus.finished) {
            if (row.lastPreviewVersion === null || current.version !== row.lastPreviewVersion) {
              return yield* Effect.fail(
                new PaywallEditSessionConflictError({
                  message:
                    "The paywall changed after this edit session was reviewed, so reverting it would overwrite newer work.",
                }),
              );
            }
          }
          const source = row.agentSessionId === null ? "mcp" : "built_in";
          yield* workspace.openDocumentConnection(projectId, row.paywallId, row.id, {
            editSessionId: row.id,
            source,
            name: source === "mcp" ? "MCP Agent" : "Voidhash AI",
          });
          return yield* Effect.gen(function* () {
            const result = yield* workspace.revertConnectedDocument(
              projectId,
              { paywallId: row.paywallId, connectionId: row.id },
              row.baselineTree,
            );
            yield* db
              .update(paywallEditSessions)
              .set({ status: PaywallEditSessionStatus.reverted, finishedAt: new Date() })
              .where(
                and(
                  eq(paywallEditSessions.id, editSessionId),
                  eq(paywallEditSessions.projectId, projectId),
                  eq(paywallEditSessions.status, row.status),
                ),
              );
            return { ...result, paywallSlug: row.paywallSlug };
          }).pipe(
            Effect.ensuring(
              workspace
                .closeDocumentConnection(projectId, {
                  paywallId: row.paywallId,
                  connectionId: row.id,
                })
                .pipe(Effect.ignore),
            ),
          );
        });

      const revertForAgentSession = (
        projectId: string,
        editSessionId: string,
        agentSessionId: string,
      ) =>
        Effect.gen(function* () {
          const row = yield* requireRow(projectId, editSessionId);
          if (row.agentSessionId !== agentSessionId) {
            return yield* Effect.fail(
              new ActionForbiddenError({
                message: "This edit session does not belong to the requested agent session.",
              }),
            );
          }
          return yield* revert(projectId, editSessionId);
        });

      return {
        begin,
        connectActive,
        recordMutation,
        requireActive,
        recordPreview,
        finish,
        revert,
        revertForAgentSession,
      } as const;
    }),
  },
) {
  static layer = Layer.effect(PaywallEditSessionService)(PaywallEditSessionService.make);
}
