import { Db, PaywallEditChangeSetStatus } from "@voidhash/db";
import { ActionForbiddenError, AuthSession } from "../../domain/auth/Auth.ts";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  PaywallEditChangeSetService,
  PaywallEditChangeSetConflictError,
} from "./PaywallEditChangeSetService.ts";
import { PaywallWorkspaceService } from "./PaywallWorkspaceService.ts";

interface ChangeSetRow {
  id: string;
  agentSessionId: string | null;
  projectId: string;
  paywallId: string;
  paywallSlug: string;
  baselineTree: unknown;
  baselineVersion: number;
  status: "active" | "finished" | "reverted";
  lastPreviewSignature: string | null;
  lastPreviewVersion: number | null;
  reviewVerdict: string | null;
  finishedAt: Date | null;
}

const makeLayers = () => {
  const rows: ChangeSetRow[] = [];
  const reverted: unknown[] = [];
  let currentVersion: number | undefined;
  const db = {
    query: {
      paywallEditChangeSets: {
        findFirst: ({ where }: { where: Partial<ChangeSetRow> }) =>
          Effect.succeed(
            rows.find((row) =>
              Object.entries(where).every(([key, value]) =>
                value === undefined ? true : row[key as keyof ChangeSetRow] === value,
              ),
            ),
          ),
      },
    },
    insert: () => ({
      values: (
        value: Omit<
          ChangeSetRow,
          | "agentSessionId"
          | "lastPreviewSignature"
          | "lastPreviewVersion"
          | "reviewVerdict"
          | "finishedAt"
        > & { agentSessionId?: string },
      ) =>
        Effect.sync(() => {
          rows.push({
            ...value,
            agentSessionId: value.agentSessionId ?? null,
            lastPreviewSignature: null,
            lastPreviewVersion: null,
            reviewVerdict: null,
            finishedAt: null,
          });
        }),
    }),
    update: () => ({
      set: (patch: Partial<ChangeSetRow>) => ({
        where: () =>
          Effect.sync(() => {
            Object.assign(rows[0]!, patch);
          }),
      }),
    }),
  };
  const workspace = {
    readDocument: () =>
      Effect.succeed({
        slug: "trial",
        name: "Trial",
        paywallId: "pw_1",
        tree: { encoded: "baseline" },
        root: { id: "root_1", type: "root", children: [] },
        version: currentVersion ?? rows[0]?.lastPreviewVersion ?? 4,
      }),
    revertDocument: (_paywallId: string, tree: unknown) =>
      Effect.sync(() => {
        reverted.push(tree);
        return { version: 8, commandCount: 2 };
      }),
  } as unknown as PaywallWorkspaceService["Service"];
  const layer = PaywallEditChangeSetService.layer.pipe(
    Layer.provide(Layer.succeed(Db, db as never)),
    Layer.provide(Layer.succeed(PaywallWorkspaceService, workspace)),
    Layer.provideMerge(Layer.succeed(AuthSession, {} as never)),
  );
  return {
    layer,
    rows,
    reverted,
    setCurrentVersion: (version: number) => {
      currentVersion = version;
    },
  };
};

describe("PaywallEditChangeSetService", () => {
  it("resumes its owning agent and rejects a second caller", async () => {
    const { layer, rows } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PaywallEditChangeSetService;
        const started = yield* service.begin("proj_1", "trial", "agent_1");
        expect(started.baselineVersion).toBe(4);
        expect(rows[0]?.baselineTree).toEqual({ encoded: "baseline" });
        expect(rows[0]?.agentSessionId).toBe("agent_1");
        const resumed = yield* service.begin("proj_1", "trial", "agent_1");
        expect(resumed.id).toBe(started.id);
        expect(rows).toHaveLength(1);
        const conflict = yield* Effect.flip(service.begin("proj_1", "trial"));
        expect(conflict).toBeInstanceOf(PaywallEditChangeSetConflictError);
      }).pipe(Effect.provide(layer)),
    );
  });

  it("finishes only when the latest preview matches the current document", async () => {
    const { layer, rows } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PaywallEditChangeSetService;
        const started = yield* service.begin("proj_1", "trial");
        yield* service.recordPreview({
          projectId: "proj_1",
          changeSetId: started.id,
          paywallSlug: "trial",
          documentSignature: "doc-current",
          documentVersion: 7,
        });
        const stale = yield* Effect.flip(
          service.finish({
            projectId: "proj_1",
            changeSetId: started.id,
            paywallSlug: "trial",
            reviewedDocumentSignature: "doc-current",
            currentDocumentSignature: "doc-newer",
            currentDocumentVersion: 8,
            verdict: "Looks good",
          }),
        );
        expect(stale).toBeInstanceOf(PaywallEditChangeSetConflictError);
        yield* service.finish({
          projectId: "proj_1",
          changeSetId: started.id,
          paywallSlug: "trial",
          reviewedDocumentSignature: "doc-current",
          currentDocumentSignature: "doc-current",
          currentDocumentVersion: 7,
          verdict: "Looks good",
        });
        expect(rows[0]?.status).toBe(PaywallEditChangeSetStatus.finished);
        expect(rows[0]?.reviewVerdict).toBe("Looks good");
        yield* service.revert("proj_1", started.id);
        expect(rows[0]?.status).toBe(PaywallEditChangeSetStatus.reverted);
      }).pipe(Effect.provide(layer)),
    );
  });

  it("reconciles the captured baseline and marks the change set reverted", async () => {
    const { layer, rows, reverted } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PaywallEditChangeSetService;
        const started = yield* service.begin("proj_1", "trial");
        const result = yield* service.revert("proj_1", started.id);
        expect(result).toMatchObject({ version: 8, commandCount: 2, paywallSlug: "trial" });
      }).pipe(Effect.provide(layer)),
    );
    expect(reverted).toEqual([{ encoded: "baseline" }]);
    expect(rows[0]?.status).toBe(PaywallEditChangeSetStatus.reverted);
  });

  it("refuses to revert a finished change set after newer document edits", async () => {
    const { layer, rows, reverted, setCurrentVersion } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PaywallEditChangeSetService;
        const started = yield* service.begin("proj_1", "trial");
        yield* service.recordPreview({
          projectId: "proj_1",
          changeSetId: started.id,
          paywallSlug: "trial",
          documentSignature: "doc-current",
          documentVersion: 7,
        });
        yield* service.finish({
          projectId: "proj_1",
          changeSetId: started.id,
          paywallSlug: "trial",
          reviewedDocumentSignature: "doc-current",
          currentDocumentSignature: "doc-current",
          currentDocumentVersion: 7,
          verdict: "Looks good",
        });
        setCurrentVersion(8);
        const conflict = yield* Effect.flip(service.revert("proj_1", started.id));
        expect(conflict).toBeInstanceOf(PaywallEditChangeSetConflictError);
      }).pipe(Effect.provide(layer)),
    );
    expect(rows[0]?.status).toBe(PaywallEditChangeSetStatus.finished);
    expect(reverted).toEqual([]);
  });

  it("only reverts through the durable agent session that owns the change set", async () => {
    const { layer, reverted } = makeLayers();
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* PaywallEditChangeSetService;
        const started = yield* service.begin("proj_1", "trial", "agent_1");
        const editForbidden = yield* Effect.flip(
          service.requireActive({
            projectId: "proj_1",
            changeSetId: started.id,
            paywallSlug: "trial",
            agentSessionId: "agent_other",
          }),
        );
        expect(editForbidden).toBeInstanceOf(ActionForbiddenError);
        yield* service.requireActive({
          projectId: "proj_1",
          changeSetId: started.id,
          paywallSlug: "trial",
          agentSessionId: "agent_1",
        });
        const forbidden = yield* Effect.flip(
          service.revertForAgentSession("proj_1", started.id, "agent_other"),
        );
        expect(forbidden).toBeInstanceOf(ActionForbiddenError);
        yield* service.revertForAgentSession("proj_1", started.id, "agent_1");
      }).pipe(Effect.provide(layer)),
    );
    expect(reverted).toEqual([{ encoded: "baseline" }]);
  });
});
