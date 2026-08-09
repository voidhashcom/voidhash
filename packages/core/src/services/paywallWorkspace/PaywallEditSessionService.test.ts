import { Db, PaywallEditSessionStatus } from "@voidhash/db";
import { ActionForbiddenError, AuthSession } from "../../domain/auth/Auth.ts";
import { Data, DateTime, Effect, Layer } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import {
  PaywallEditSessionService,
  PaywallEditSessionConflictError,
} from "./PaywallEditSessionService.ts";
import { PaywallWorkspaceService } from "./PaywallWorkspaceService.ts";

/**
 * Hands a partial fake to the type system as a whole service. The faked
 * surfaces are wide (dozens of methods) while these tests exercise a handful,
 * so this narrow helper is the single deliberately untyped seam.
 */
const fakeService = (impl: object): any => impl;

/** A fixed timestamp: these rows are inert fixtures, nothing asserts on time. */
const FIXED_DATE = DateTime.toDateUtc(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));

/** The lease-expiry failure the fake workspace raises; the service catches any error. */
class FakeConnectionExpiredError extends Data.TaggedError("FakeConnectionExpiredError")<{
  readonly message: string;
}> {}

/** Reads a `where` key off a row without a `keyof` assertion. */
const rowField = (row: EditSessionRow, key: string): unknown => {
  const record: Record<string, unknown> = { ...row };
  return record[key];
};

const matchesWhere = (row: EditSessionRow, where: Partial<EditSessionRow>) =>
  Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true;
    return rowField(row, key) === value;
  });

interface EditSessionRow {
  id: string;
  agentSessionId: string | null;
  projectId: string;
  paywallId: string;
  paywallSlug: string;
  baselineTree: unknown;
  baselineVersion: number;
  lastAgentVersion: number;
  revertSafe: boolean;
  status: "active" | "finished" | "reverted";
  lastPreviewSignature: string | null;
  lastPreviewVersion: number | null;
  reviewVerdict: string | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const makeLayers = () => {
  const rows: EditSessionRow[] = [];
  const reverted: unknown[] = [];
  let currentVersion: number | undefined;
  let openCount = 0;
  let heartbeatFails = false;
  const db = {
    query: {
      paywallEditSessions: {
        findFirst: ({ where }: { where: Partial<EditSessionRow> }) =>
          Effect.succeed(rows.find((row) => matchesWhere(row, where))),
      },
    },
    insert: () => ({
      values: (
        value: Omit<
          EditSessionRow,
          | "agentSessionId"
          | "lastPreviewSignature"
          | "lastPreviewVersion"
          | "reviewVerdict"
          | "finishedAt"
          | "createdAt"
          | "updatedAt"
          | "lastAgentVersion"
          | "revertSafe"
        > & { agentSessionId?: string },
      ) =>
        Effect.sync(() => {
          rows.push({
            ...value,
            agentSessionId: value.agentSessionId ?? null,
            lastPreviewSignature: null,
            lastPreviewVersion: null,
            lastAgentVersion: value.baselineVersion,
            revertSafe: true,
            reviewVerdict: null,
            finishedAt: null,
            createdAt: FIXED_DATE,
            updatedAt: FIXED_DATE,
          });
        }),
    }),
    update: () => ({
      set: (patch: Partial<EditSessionRow>) => ({
        where: () =>
          Effect.sync(() => {
            Object.assign(rows[0]!, patch);
          }),
      }),
    }),
  };
  const workspace = {
    openDocumentConnection: () =>
      Effect.sync(() => {
        openCount += 1;
        return {
          slug: "trial",
          name: "Trial",
          paywallId: "pw_1",
          tree: { encoded: "baseline" },
          root: { id: "root_1", type: "root", children: [] },
          version: currentVersion ?? rows[0]?.lastPreviewVersion ?? 4,
        };
      }),
    heartbeatDocumentConnection: () => {
      if (heartbeatFails) {
        return Effect.fail(new FakeConnectionExpiredError({ message: "connection expired" }));
      }
      return Effect.void;
    },
    closeDocumentConnection: () => Effect.void,
    readDocument: () =>
      Effect.succeed({
        slug: "trial",
        name: "Trial",
        paywallId: "pw_1",
        tree: { encoded: "baseline" },
        root: { id: "root_1", type: "root", children: [] },
        version: currentVersion ?? rows[0]?.lastPreviewVersion ?? 4,
      }),
    readDocumentTree: () =>
      Effect.succeed({
        tree: { encoded: "current" },
        root: { id: "root_1", type: "root", children: [] },
        version: currentVersion ?? 4,
      }),
    revertConnectedDocument: (_projectId: string, _connection: unknown, tree: unknown) =>
      Effect.sync(() => {
        reverted.push(tree);
        return { version: 8, commandCount: 2 };
      }),
  };
  const layer = PaywallEditSessionService.layer.pipe(
    Layer.provide(Layer.succeed(Db, fakeService(db))),
    Layer.provide(Layer.succeed(PaywallWorkspaceService, fakeService(workspace))),
    Layer.provideMerge(Layer.succeed(AuthSession, fakeService({}))),
  );
  return {
    layer,
    rows,
    reverted,
    getOpenCount: () => openCount,
    setHeartbeatFailure: (fails: boolean) => {
      heartbeatFails = fails;
    },
    setCurrentVersion: (version: number) => {
      currentVersion = version;
    },
  };
};

describe("PaywallEditSessionService", () => {
  it.effect("renews an active connection and reopens it after lease expiry", () => {
    const { layer, getOpenCount, setHeartbeatFailure } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      yield* service.connectActive({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
      });
      expect(getOpenCount()).toBe(1);

      setHeartbeatFailure(true);
      yield* service.connectActive({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
      });
      expect(getOpenCount()).toBe(2);
    }).pipe(Effect.provide(layer));
  });

  it.effect("resumes its owning agent while allowing independent concurrent sessions", () => {
    const { layer, rows, getOpenCount } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "built_in",
        agentSessionId: "agent_1",
      });
      expect(started.baselineVersion).toBe(4);
      expect(rows[0]?.baselineTree).toEqual({ encoded: "baseline" });
      expect(rows[0]?.agentSessionId).toBe("agent_1");
      const resumed = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "built_in",
        agentSessionId: "agent_1",
      });
      expect(resumed.editSessionId).toBe(started.editSessionId);
      expect(rows).toHaveLength(1);
      const concurrentMcp = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      const concurrentBuiltIn = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "built_in",
        agentSessionId: "agent_2",
      });
      expect(concurrentMcp.editSessionId).not.toBe(started.editSessionId);
      expect(concurrentBuiltIn.editSessionId).not.toBe(started.editSessionId);
      expect(concurrentBuiltIn.editSessionId).not.toBe(concurrentMcp.editSessionId);
      expect(rows).toHaveLength(3);
      expect(getOpenCount()).toBe(4);
    }).pipe(Effect.provide(layer));
  });

  it.effect("finishes only when the latest preview matches the current document", () => {
    const { layer, rows, setCurrentVersion } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      yield* service.recordPreview({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
        documentSignature: "doc-current",
        documentVersion: 7,
      });
      const stale = yield* Effect.flip(
        service.finish({
          projectId: "proj_1",
          editSessionId: started.editSessionId,
          reviewedDocumentSignature: "doc-current",
          currentDocumentSignature: "doc-newer",
          currentDocumentVersion: 8,
          verdict: "Looks good",
        }),
      );
      expect(stale).toBeInstanceOf(PaywallEditSessionConflictError);
      yield* service.finish({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
        reviewedDocumentSignature: "doc-current",
        currentDocumentSignature: "doc-current",
        currentDocumentVersion: 7,
        verdict: "Looks good",
      });
      expect(rows[0]?.status).toBe(PaywallEditSessionStatus.finished);
      expect(rows[0]?.reviewVerdict).toBe("Looks good");
      rows[0]!.lastAgentVersion = 7;
      setCurrentVersion(7);
      yield* service.revert("proj_1", started.editSessionId);
      expect(rows[0]?.status).toBe(PaywallEditSessionStatus.reverted);
    }).pipe(Effect.provide(layer));
  });

  it.effect("reconciles the captured baseline and marks the edit session reverted", () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      rows[0]!.lastAgentVersion = 7;
      setCurrentVersion(7);
      const result = yield* service.revert("proj_1", started.editSessionId);
      expect(result).toMatchObject({ version: 8, commandCount: 2, paywallSlug: "trial" });
      expect(reverted).toEqual([{ encoded: "baseline" }]);
      expect(rows[0]?.status).toBe(PaywallEditSessionStatus.reverted);
    }).pipe(Effect.provide(layer));
  });

  it.effect("closes a mutation-free session without reverting concurrent edits", () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const passive = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      setCurrentVersion(5);
      const result = yield* service.revert("proj_1", passive.editSessionId);
      expect(result).toMatchObject({ version: 5, commandCount: 0, paywallSlug: "trial" });
      expect(reverted).toEqual([]);
      expect(rows[0]?.status).toBe(PaywallEditSessionStatus.reverted);
      expect(rows[1]?.status).toBe(PaywallEditSessionStatus.active);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses to revert a finished edit session after newer document edits", () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      yield* service.recordPreview({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
        documentSignature: "doc-current",
        documentVersion: 7,
      });
      yield* service.finish({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
        reviewedDocumentSignature: "doc-current",
        currentDocumentSignature: "doc-current",
        currentDocumentVersion: 7,
        verdict: "Looks good",
      });
      rows[0]!.lastAgentVersion = 7;
      setCurrentVersion(8);
      const conflict = yield* Effect.flip(service.revert("proj_1", started.editSessionId));
      expect(conflict).toBeInstanceOf(PaywallEditSessionConflictError);
      expect(rows[0]?.status).toBe(PaywallEditSessionStatus.finished);
      expect(reverted).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses to overwrite interleaved multiplayer edits", () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "mcp",
      });
      rows[0]!.revertSafe = false;
      rows[0]!.lastAgentVersion = 7;
      setCurrentVersion(7);
      const conflict = yield* Effect.flip(service.revert("proj_1", started.editSessionId));
      expect(conflict).toBeInstanceOf(PaywallEditSessionConflictError);
      expect(reverted).toEqual([]);
      expect(rows[0]?.status).toBe(PaywallEditSessionStatus.active);
    }).pipe(Effect.provide(layer));
  });

  it.effect("only reverts through the durable agent session that owns the edit session", () => {
    const { layer, reverted } = makeLayers();
    return Effect.gen(function* () {
      const service = yield* PaywallEditSessionService;
      const started = yield* service.begin({
        projectId: "proj_1",
        paywallId: "pw_1",
        source: "built_in",
        agentSessionId: "agent_1",
      });
      const editForbidden = yield* Effect.flip(
        service.requireActive({
          projectId: "proj_1",
          editSessionId: started.editSessionId,
          agentSessionId: "agent_other",
        }),
      );
      expect(editForbidden).toBeInstanceOf(ActionForbiddenError);
      yield* service.requireActive({
        projectId: "proj_1",
        editSessionId: started.editSessionId,
        agentSessionId: "agent_1",
      });
      const forbidden = yield* Effect.flip(
        service.revertForAgentSession("proj_1", started.editSessionId, "agent_other"),
      );
      expect(forbidden).toBeInstanceOf(ActionForbiddenError);
      yield* service.revertForAgentSession("proj_1", started.editSessionId, "agent_1");
      expect(reverted).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});
