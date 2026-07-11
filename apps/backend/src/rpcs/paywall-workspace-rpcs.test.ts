/**
 * Unit tests for the surviving document-first paywall workspace RPC handlers.
 * They dispatch through `RpcTest.makeClient` against the REAL
 * {@link PaywallWorkspaceRpcsLive} handler graph fed by the REAL
 * {@link PaywallWorkspaceService} over mocked infrastructure (MimicHost /
 * PaywallService / manifest cache) plus a pass-through AuthMiddleware — so the
 * `ReadPaywallDocument` read seam (slug resolution + whole-document clean) is
 * exercised end to end without an HTTP transport or a live document.
 */
import {
  ComponentManifestCacheService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import { MimicHost } from "@voidhash/core/services/paywalls/MimicHost";
import { PaywallService } from "@voidhash/core/services/paywalls/PaywallService";
import { ScreenNode, TextNode } from "@voidhash/mimic-schema";
import { encodePaywallDocument } from "@voidhash/paywall-workspace";
import { AuthMiddleware, AuthSession, PaywallWorkspaceRpcsDef } from "@voidhash/rpc";
import { Effect, Exit, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";

import { PaywallWorkspaceRpcsLive } from "./paywall-workspace-rpcs.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const paywallRow = () => ({
  id: "pw_1",
  slug: "trial",
  projectId: "proj_1",
  name: "Trial",
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  source: 1,
  thumbnailUrl: null,
  thumbnailSeq: null,
  designFileMetadata: null,
});

/** A raw document tree with no components (a single screen). */
const emptyDoc = () =>
  encodePaywallDocument([
    { type: "root", name: "Paywall", children: [{ type: "screen", name: "Main" }] },
  ]);

interface Fakes {
  /** The session the pass-through AuthMiddleware injects (default: a signed-in user). */
  readonly session?: unknown;
  /** Decoded document root `getPaywallDocument` returns (the `ReadPaywallDocument` read path). */
  readonly root?: unknown;
}

/** A cookie-authenticated user session. */
const USER_SESSION = { method: "user", user: { id: "user_1" } };

/** The mocked infrastructure + REAL workspace service + RPC handlers. */
const buildHandlerLayer = (fakes: Fakes) => {
  const paywallLayer = Layer.succeed(PaywallService, {
    getPaywalls: () => Effect.succeed([paywallRow()]),
  } as unknown as PaywallService["Service"]);

  const mimicLayer = Layer.succeed(MimicHost, {
    ensurePaywallDocument: () => Effect.void,
    getPaywallSnapshot: () => Effect.succeed(null),
    getPaywallDocument: () =>
      Effect.sync(() => ({ tree: emptyDoc(), version: 1, root: fakes.root ?? null })),
    submitPaywallTransaction: (_id: string, input: { baseVersion: number }) =>
      Effect.succeed({ accepted: true, version: input.baseVersion + 1 }),
    createPaywallEditToken: () =>
      Effect.succeed({ token: "", url: "", expiresAt: new Date() }),
  } as unknown as MimicHost["Service"]);

  const cacheLayer = Layer.succeed(ComponentManifestCacheService, {
    record: () => Effect.void,
    getMany: () => Effect.succeed(new Map()),
  } as unknown as ComponentManifestCacheService["Service"]);

  const infra = Layer.mergeAll(paywallLayer, mimicLayer, cacheLayer);
  const workspaceLayer = PaywallWorkspaceService.layer.pipe(Layer.provide(infra));

  // A pass-through AuthMiddleware that injects the request session.
  const session = fakes.session ?? USER_SESSION;
  const authMiddlewareLayer = Layer.succeed(
    AuthMiddleware,
    AuthMiddleware.of((effect) => Effect.provideService(effect, AuthSession, session as never)),
  );

  return Layer.mergeAll(
    PaywallWorkspaceRpcsLive.pipe(
      Layer.provide(Layer.mergeAll(workspaceLayer, cacheLayer)),
    ),
    authMiddlewareLayer,
  );
};

/**
 * A local view of the RPC client. The generated `RpcClient` types resolve
 * `Effect` from the rpc package's own effect instance, which trips a dual-
 * instance clash; a hand-written interface keeps every effect on one instance.
 */
interface ReadDocumentResult {
  slug: string;
  name: string;
  paywallId: string;
  document: unknown;
}

interface WorkspaceClient {
  ReadPaywallDocument: (payload: {
    projectId: string;
    slug: string;
  }) => Effect.Effect<ReadDocumentResult, unknown>;
}

const dispatch = <A>(fakes: Fakes, f: (client: WorkspaceClient) => Effect.Effect<A, unknown>) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const client = (yield* RpcTest.makeClient(PaywallWorkspaceRpcsDef)) as unknown as WorkspaceClient;
      return yield* f(client);
    }).pipe(Effect.provide(buildHandlerLayer(fakes)), Effect.scoped),
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const decodeNodeData = (prim: any, input: unknown): Record<string, unknown> =>
  prim.data.decode(prim.data.encode(input)) as Record<string, unknown>;

/**
 * A decoded document root (`root` → `screen` → `text`) with the CRDT envelopes
 * the engine's decode produces — the exact shape `getPaywallDocument.root` carries
 * and `serializeDocument` cleans. One authored deviation (`paddingTop`) + literal
 * text so the cleaned JSON is non-trivial to assert on.
 */
const decodedRoot = () => ({
  id: "root_1",
  type: "root",
  parentId: null,
  pos: 0,
  data: {},
  children: [
    {
      id: "scr_1",
      type: "screen",
      parentId: "root_1",
      pos: 0,
      data: decodeNodeData(ScreenNode, { name: "Main", style: { paddingTop: 24 } }),
      children: [
        {
          id: "txt_1",
          type: "text",
          parentId: "scr_1",
          pos: 0,
          data: decodeNodeData(TextNode, { text: "Hello" }),
          children: [],
        },
      ],
    },
  ],
});

describe("PaywallWorkspaceRpcs — ReadPaywallDocument (read_paywall)", () => {
  it("returns the slug/name/id + the cleaned document JSON", async () => {
    const exit = await dispatch({ root: decodedRoot() }, (client) =>
      client.ReadPaywallDocument({ projectId: "proj_1", slug: "trial" }),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.slug).toBe("trial");
      expect(exit.value.name).toBe("Trial");
      expect(exit.value.paywallId).toBe("pw_1");
      const doc = exit.value.document as {
        id: string;
        type: string;
        children: ReadonlyArray<{ type: string; style?: unknown; children?: unknown[] }>;
      };
      expect(doc.id).toBe("root_1");
      expect(doc.type).toBe("root");
      // Defaults are stripped: the screen shows only the authored paddingTop.
      const screen = doc.children[0]!;
      expect(screen.type).toBe("screen");
      expect(screen.style).toEqual({ paddingTop: 24 });
      const text = (screen.children as ReadonlyArray<{ type: string; text?: string }>)[0]!;
      expect(text.type).toBe("text");
      expect(text.text).toBe("Hello");
    }
  });

  it("returns an empty document object when the live document has no root", async () => {
    const exit = await dispatch({ root: null }, (client) =>
      client.ReadPaywallDocument({ projectId: "proj_1", slug: "trial" }),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.document).toEqual({});
    }
  });

  it("maps an unknown slug to Rpc/PaywallNotFoundError", async () => {
    const exit = await dispatch({ root: decodedRoot() }, (client) =>
      client.ReadPaywallDocument({ projectId: "proj_1", slug: "missing" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("Rpc/PaywallNotFoundError");
    }
  });
});
