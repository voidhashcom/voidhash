import { Db, PaywallEditSessionStatus } from "@voidhash/db";
import { ActionForbiddenError, AuthSession } from "../../domain/auth/Auth.ts";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  PaywallEditSessionService,
  PaywallEditSessionConflictError,
} from "./PaywallEditSessionService.ts";
import { PaywallWorkspaceService } from "./PaywallWorkspaceService.ts";

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
          Effect.succeed(
            rows.find((row) =>
              Object.entries(where).every(([key, value]) =>
                value === undefined ? true : row[key as keyof EditSessionRow] === value,
              ),
            ),
          ),
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
            createdAt: new Date(),
            updatedAt: new Date(),
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
    heartbeatDocumentConnection: () =>
      heartbeatFails ? Effect.fail(new Error("connection expired")) : Effect.void,
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
  } as unknown as PaywallWorkspaceService["Service"];
  const layer = PaywallEditSessionService.layer.pipe(
    Layer.provide(Layer.succeed(Db, db as never)),
    Layer.provide(Layer.succeed(PaywallWorkspaceService, workspace)),
    Layer.provideMerge(Layer.succeed(AuthSession, {} as never)),
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
  it("renews an active connection and reopens it after lease expiry", async () => {
    const { layer, getOpenCount, setHeartbeatFailure } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
  });

  it("resumes its owning agent while allowing independent concurrent sessions", async () => {
    const { layer, rows, getOpenCount } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
  });

  it("finishes only when the latest preview matches the current document", async () => {
    const { layer, rows, setCurrentVersion } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
  });

  it("reconciles the captured baseline and marks the edit session reverted", async () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
    expect(reverted).toEqual([{ encoded: "baseline" }]);
    expect(rows[0]?.status).toBe(PaywallEditSessionStatus.reverted);
  });

  it("closes a mutation-free session without reverting concurrent edits", async () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
    expect(reverted).toEqual([]);
    expect(rows[0]?.status).toBe(PaywallEditSessionStatus.reverted);
    expect(rows[1]?.status).toBe(PaywallEditSessionStatus.active);
  });

  it("refuses to revert a finished edit session after newer document edits", async () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
    expect(rows[0]?.status).toBe(PaywallEditSessionStatus.finished);
    expect(reverted).toEqual([]);
  });

  it("refuses to overwrite interleaved multiplayer edits", async () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
    expect(reverted).toEqual([]);
    expect(rows[0]?.status).toBe(PaywallEditSessionStatus.active);
  });

  it("only reverts through the durable agent session that owns the edit session", async () => {
    const { layer, reverted } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(layer)),
    );
    expect(reverted).toEqual([]);
  });
});
