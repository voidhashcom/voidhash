import { encodePaywallDocument } from "@voidhash/paywall-workspace";
import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { MimicHost, type SubmitPaywallTransactionResult } from "../paywalls/MimicHost.ts";
import { PaywallService } from "../paywalls/PaywallService.ts";
import { PaywallWorkspaceService } from "./PaywallWorkspaceService.ts";

const paywallRow = (over: Partial<{ id: string; slug: string; projectId: string }> = {}) => ({
  id: over.id ?? "pw_1",
  slug: over.slug ?? "trial",
  projectId: over.projectId ?? "proj_1",
  name: "Trial",
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  source: 1,
  thumbnailUrl: null,
  thumbnailSeq: null,
  designFileMetadata: null,
});

/**
 * A fake `submitPaywallTransaction`: given the read version + commands, decide
 * accept/reject and the resulting version. Lets a test model a version conflict
 * on the first attempt then acceptance on the retry.
 */
type SubmitFake = (input: {
  readonly baseVersion: number;
  readonly commands: ReadonlyArray<unknown>;
  readonly attempt: number;
}) => SubmitPaywallTransactionResult;

interface Fakes {
  readonly paywalls?: ReadonlyArray<ReturnType<typeof paywallRow>>;
  readonly snapshot?: unknown;
  /** Raw document trees returned by `getPaywallDocument`, in read order. */
  readonly documents?: ReadonlyArray<{ tree: unknown; version: number }>;
  readonly submit?: SubmitFake;
}

/** Encode a decoded document snapshot to the raw tree value the write path reads. */
const encodeTree = (roots: unknown): unknown => encodePaywallDocument(roots);

const testLayer = (fakes: Fakes) => {
  const paywallLayer = Layer.succeed(PaywallService, {
    getPaywalls: () => Effect.succeed(fakes.paywalls ?? [paywallRow()]),
    getPaywallById: (paywallId: string) =>
      Effect.succeed(
        (fakes.paywalls ?? [paywallRow()]).find((paywall) => paywall.id === paywallId) ??
          paywallRow({ id: paywallId }),
      ),
  } as unknown as PaywallService["Service"]);

  // Read cursor over `fakes.documents` (each getPaywallDocument returns the next
  // one, clamping at the last) and attempt counter for the submit fake.
  let docReads = 0;
  let submitAttempts = 0;
  const documents = fakes.documents ?? [];

  const readDocument = () =>
    Effect.sync(() => {
      const doc = documents[Math.min(docReads, documents.length - 1)] ?? {
        tree: encodeTree([{ type: "root", name: "Paywall", children: [{ type: "screen" }] }]),
        version: 1,
      };
      docReads += 1;
      return { ...doc, root: fakes.snapshot ?? null };
    });

  const submitTransaction = (input: {
    readonly baseVersion: number;
    readonly commands: ReadonlyArray<unknown>;
  }) =>
    Effect.sync(() => {
      const attempt = submitAttempts;
      submitAttempts += 1;
      return (
        fakes.submit?.({ ...input, attempt }) ?? {
          accepted: true,
          version: input.baseVersion + 1,
        }
      );
    });

  const mimicLayer = Layer.succeed(MimicHost, {
    ensurePaywallDocument: () => Effect.void,
    getPaywallSnapshot: () => Effect.succeed(fakes.snapshot ?? null),
    getPaywallDocument: readDocument,
    submitPaywallTransaction: (_paywallId, input) => submitTransaction(input),
    openPaywallConnection: () => readDocument(),
    getConnectedPaywallDocument: () => readDocument(),
    heartbeatPaywallConnection: () => Effect.void,
    closePaywallConnection: () => Effect.void,
    submitConnectedPaywallTransaction: (_paywallId, _connectionId, input) =>
      submitTransaction(input),
    createPaywallEditToken: () => Effect.succeed({ token: "", url: "", expiresAt: new Date() }),
  });

  // A stub session; the faked PaywallService ignores it, but the workspace
  // service's type surfaces AuthSession (getPaywalls requires it), so it must be
  // in context.
  const session = {
    cookie: null,
    method: "secret-key",
    name: "ci",
    organizations: [],
    person: null,
    projects: [],
    user: null,
  };
  const authLayer = Layer.succeed(AuthSession, session as never);

  return Layer.mergeAll(
    PaywallWorkspaceService.layer.pipe(Layer.provide(Layer.mergeAll(paywallLayer, mimicLayer))),
    authLayer,
  );
};

const useWs = <A, E>(
  f: (ws: PaywallWorkspaceService["Service"]) => Effect.Effect<A, E, AuthSession>,
  fakes: Fakes,
) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const ws = yield* PaywallWorkspaceService;
      return yield* f(ws);
    }).pipe(Effect.provide(testLayer(fakes))),
  );

describe("PaywallWorkspaceService", () => {
  it("listPaywalls returns just directories (slug + id), no snapshot reads", async () => {
    const exit = await useWs((ws) => ws.listPaywalls("proj_1"), {
      paywalls: [
        paywallRow({ id: "a", slug: "trial" }),
        paywallRow({ id: "b", slug: "onboarding" }),
      ],
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual([
        { slug: "trial", paywallId: "a" },
        { slug: "onboarding", paywallId: "b" },
      ]);
    }
  });

  it("readDocumentTree returns the raw tree, decoded root, and version for a paywall id", async () => {
    const root = { id: "root_1", type: "root", parentId: null, pos: 0, data: {}, children: [] };
    const tree = encodeTree([{ type: "root", name: "Paywall", children: [{ type: "screen" }] }]);
    const exit = await useWs((ws) => ws.readDocumentTree("pw_1"), {
      // `getPaywallDocument` returns `{ tree, version, root: fakes.snapshot }`.
      documents: [{ tree, version: 7 }],
      snapshot: root,
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.tree).toEqual(tree);
      expect(exit.value.root).toEqual(root);
      expect(exit.value.version).toBe(7);
    }
  });

  it("readDocument resolves the slug and returns a consistent document snapshot", async () => {
    const root = { id: "root_1", type: "root", parentId: null, pos: 0, data: {}, children: [] };
    const tree = encodeTree([{ type: "root", name: "Paywall", children: [] }]);
    const exit = await useWs((ws) => ws.readDocument("proj_1", "trial"), {
      documents: [{ tree, version: 7 }],
      paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
      snapshot: root,
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toEqual({
        slug: "trial",
        name: "Trial",
        paywallId: "pw_1",
        tree,
        root,
        version: 7,
      });
    }
  });

  it("readDocument fails not-found when the slug is not in the project (authz boundary)", async () => {
    const exit = await useWs((ws) => ws.readDocument("proj_1", "does-not-exist"), {
      paywalls: [paywallRow({ slug: "trial" })],
    });
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("PaywallNotFoundError");
    }
  });

  const docTreeWithComponent = (source: string) =>
    encodeTree([
      {
        type: "root",
        name: "Paywall",
        children: [
          { type: "screen", name: "Main" },
          {
            type: "library",
            children: [{ type: "codeComponent", path: "components/hero.tsx", source }],
          },
        ],
      },
    ]);

  it("moveComponentFile repaths the component and reports the new version", async () => {
    const exit = await useWs(
      (ws) => ws.moveComponentFile("proj_1", "trial", "hero.tsx", "hero-banner.tsx"),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: docTreeWithComponent("export const Hero = () => null;"), version: 3 }],
        submit: ({ baseVersion }) => ({ accepted: true, version: baseVersion + 1 }),
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(4);
      expect(exit.value.commandCount).toBeGreaterThan(0);
    }
  });

  it("moveComponentFile rejects an unknown source component (diagnostics)", async () => {
    const exit = await useWs(
      (ws) => ws.moveComponentFile("proj_1", "trial", "ghost.tsx", "phantom.tsx"),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: docTreeWithComponent("export const Hero = () => null;"), version: 1 }],
      },
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("WorkspaceWriteRejectedError");
    }
  });

  it("deleteComponentFile removes the component and reports the new version", async () => {
    const exit = await useWs((ws) => ws.deleteComponentFile("proj_1", "trial", "hero.tsx"), {
      paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
      documents: [{ tree: docTreeWithComponent("export const Hero = () => null;"), version: 6 }],
      submit: ({ baseVersion }) => ({ accepted: true, version: baseVersion + 1 }),
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(7);
      expect(exit.value.commandCount).toBeGreaterThan(0);
    }
  });

  it("conflict-retry-then-accept captures ONCE, with the attempt-0 pre-turn image", async () => {
    const captures: Array<{ paywallId: string; version: number }> = [];
    const exit = await useWs(
      (ws) =>
        ws.moveComponentFile(
          "proj_1",
          "trial",
          "hero.tsx",
          "hero-banner.tsx",
          ({ paywallId, version }) => Effect.sync(() => captures.push({ paywallId, version })),
        ),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        // Two reads: first conflicts (version 5), retry succeeds (version 6). The
        // checkpoint must be captured ONCE, from the attempt-0 pre-turn read
        // (version 5), NOT the retried attempt's newer base (version 6).
        documents: [
          { tree: docTreeWithComponent("export const Hero = () => null;"), version: 5 },
          { tree: docTreeWithComponent("export const Hero = () => null;"), version: 6 },
        ],
        submit: ({ attempt, baseVersion }) =>
          attempt === 0
            ? { accepted: false, version: baseVersion }
            : { accepted: true, version: baseVersion + 1 },
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    // Captured exactly once, with the attempt-0 (pre-turn) version.
    expect(captures).toEqual([{ paywallId: "pw_1", version: 5 }]);
  });

  it("rejected-only turn captures NOTHING (checkpoint gated on acceptance)", async () => {
    const captures: Array<{ paywallId: string; version: number }> = [];
    const exit = await useWs(
      (ws) =>
        // Unknown source component → the lowering rejects before any submit.
        ws.moveComponentFile(
          "proj_1",
          "trial",
          "ghost.tsx",
          "phantom.tsx",
          ({ paywallId, version }) => Effect.sync(() => captures.push({ paywallId, version })),
        ),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: docTreeWithComponent("export const Hero = () => null;"), version: 3 }],
      },
    );
    expect(Exit.isFailure(exit)).toBe(true);
    // A rejected turn never modified the document, so it must NOT checkpoint —
    // else a revert would clobber concurrent human edits for a no-write turn.
    expect(captures).toEqual([]);
  });

  it("no-op turn (move to the same name) captures NOTHING", async () => {
    const captures: Array<{ paywallId: string; version: number }> = [];
    const exit = await useWs(
      (ws) =>
        ws.moveComponentFile("proj_1", "trial", "hero.tsx", "hero.tsx", ({ paywallId, version }) =>
          Effect.sync(() => captures.push({ paywallId, version })),
        ),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: docTreeWithComponent("export const Hero = () => null;"), version: 4 }],
        submit: () => {
          throw new Error("submit should not be called for a no-op move");
        },
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.commandCount).toBe(0);
    }
    // A committed no-op did not modify the document, so it must not capture.
    expect(captures).toEqual([]);
  });

  it("revertDocument reconciles the live tree back to a captured pre-image", async () => {
    const captured = encodeTree([
      {
        type: "root",
        name: "Paywall",
        children: [
          { type: "screen", name: "Main" },
          {
            type: "library",
            children: [
              {
                type: "codeComponent",
                path: "components/hero.tsx",
                source: "export const Hero = () => null;",
              },
            ],
          },
        ],
      },
    ]);
    const exit = await useWs((ws) => ws.revertDocument("pw_1", captured), {
      paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
      // The live document has an EDITED Hero source; revert reconciles it back.
      documents: [{ tree: docTreeWithComponent("export const Hero = () => 999;"), version: 8 }],
      submit: ({ baseVersion }) => ({ accepted: true, version: baseVersion + 1 }),
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(9);
      expect(exit.value.commandCount).toBeGreaterThan(0);
    }
  });

  it("revertDocument is a no-op when the live document already matches the checkpoint", async () => {
    const tree = docTreeWithComponent("export const Hero = () => null;");
    const exit = await useWs((ws) => ws.revertDocument("pw_1", tree), {
      paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
      documents: [{ tree, version: 4 }],
      submit: () => {
        throw new Error("submit should not be called for a no-op revert");
      },
    });
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.commandCount).toBe(0);
      expect(exit.value.version).toBe(4);
    }
  });

  // A live document tree with a root → screen (the edit target).
  const docTreeWithScreen = () =>
    encodeTree([
      {
        type: "root",
        name: "Paywall",
        children: [{ type: "screen", name: "Main" }],
      },
    ]);

  it("editDocument inserts a subtree, submits, and returns real minted ids", async () => {
    // Resolve the live screen id so the insert targets a real parent.
    const live = docTreeWithScreen();
    const screenId = (
      live as { nodes: { id: string; value: { fields: { type?: { value?: string } } } }[] }
    ).nodes.find((node) => node.value.fields.type?.value === "screen")!.id;

    const exit = await useWs(
      (ws) =>
        ws.editDocument("proj_1", "trial", [
          { op: "insert", parentId: screenId, node: { type: "view", name: "Card" } },
        ]),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: live, version: 4 }],
        submit: ({ baseVersion }) => ({ accepted: true, version: baseVersion + 1 }),
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(5);
      expect(exit.value.commandCount).toBeGreaterThan(0);
      const minted = exit.value.mintedIds["0"];
      expect(minted).toBeDefined();
      expect(minted).toHaveLength(1);
      // A real 10-char mimic short id.
      expect(minted![0]).toMatch(/^[0-9A-Za-z]{10}$/);
    }
  });

  it("editDocument no-op (commandCount 0) reports empty minted ids", async () => {
    const live = docTreeWithScreen();
    const screenId = (
      live as { nodes: { id: string; value: { fields: { type?: { value?: string } } } }[] }
    ).nodes.find((node) => node.value.fields.type?.value === "screen")!.id;

    const exit = await useWs(
      // Setting the screen name to its CURRENT value reconciles to zero commands.
      (ws) =>
        ws.editDocument("proj_1", "trial", [
          { op: "update", nodeId: screenId, set: { name: "Main" } },
        ]),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: live, version: 4 }],
        submit: () => {
          throw new Error("submit should not be called for a no-op edit");
        },
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.commandCount).toBe(0);
      // A no-op committed no new nodes → no dangling minted ids.
      expect(exit.value.mintedIds).toEqual({});
    }
  });

  it("editDocument conflict-then-accept re-derives the target and reports the accepted version", async () => {
    const live = docTreeWithScreen();
    const screenId = (
      live as { nodes: { id: string; value: { fields: { type?: { value?: string } } } }[] }
    ).nodes.find((node) => node.value.fields.type?.value === "screen")!.id;

    const exit = await useWs(
      (ws) =>
        ws.editDocument("proj_1", "trial", [
          { op: "insert", parentId: screenId, node: { type: "view" } },
        ]),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        // First read conflicts (version 7), retry succeeds (version 8).
        documents: [
          { tree: live, version: 7 },
          { tree: live, version: 8 },
        ],
        submit: ({ attempt, baseVersion }) =>
          attempt === 0
            ? { accepted: false, version: baseVersion }
            : { accepted: true, version: baseVersion + 1 },
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(9);
      // The minted ids returned are the accepted attempt's.
      expect(exit.value.mintedIds["0"]).toHaveLength(1);
    }
  });

  it("writeComponentSource CREATES a new component (library minted) and reports the version", async () => {
    const exit = await useWs(
      (ws) =>
        ws.writeComponentSource(
          "proj_1",
          "trial",
          "components/hero.tsx",
          "export default () => null;",
        ),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        // A document with NO library yet → the write creates it.
        documents: [{ tree: docTreeWithScreen(), version: 2 }],
        submit: ({ baseVersion }) => ({ accepted: true, version: baseVersion + 1 }),
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(3);
      expect(exit.value.commandCount).toBeGreaterThan(0);
    }
  });

  it("writeComponentSource REPLACES an existing component's source", async () => {
    const withComponent = encodeTree([
      {
        type: "root",
        name: "Paywall",
        children: [
          { type: "screen", name: "Main" },
          {
            type: "library",
            children: [
              {
                type: "codeComponent",
                path: "components/hero.tsx",
                source: "export const Old = 1;",
              },
            ],
          },
        ],
      },
    ]);
    const exit = await useWs(
      (ws) =>
        ws.writeComponentSource("proj_1", "trial", "components/hero.tsx", "export const New = 2;"),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: withComponent, version: 5 }],
        submit: ({ baseVersion }) => ({ accepted: true, version: baseVersion + 1 }),
      },
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.version).toBe(6);
      // Only the source field changed → at least one command.
      expect(exit.value.commandCount).toBeGreaterThan(0);
    }
  });

  it("writeComponentSource rejects an invalid component file name", async () => {
    const exit = await useWs(
      (ws) => ws.writeComponentSource("proj_1", "trial", "components/../evil.tsx", "x"),
      {
        paywalls: [paywallRow({ id: "pw_1", slug: "trial" })],
        documents: [{ tree: docTreeWithScreen(), version: 1 }],
      },
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("WorkspaceWriteRejectedError");
    }
  });
});
