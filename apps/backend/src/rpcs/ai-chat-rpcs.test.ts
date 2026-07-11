/**
 * Unit tests for the AI-chat RPC handlers that touch paywall documents:
 * `CaptureAiCheckpoint`. They dispatch through `RpcTest.makeClient` against the
 * REAL {@link AiChatRpcsLive} handler graph fed by faked domain services
 * (AiChatService / PaywallService / PaywallWorkspaceService) plus a pass-through
 * `AuthMiddleware`, so the whole handler seam (chat resolution, paywall
 * cross-project scoping, live-tree read, first-write-wins capture reporting) runs
 * without an HTTP transport or a live document.
 */
import {
  AiChatForbiddenError,
  AiChatNotFoundError,
  AiChatService,
  PaywallService,
  PaywallWorkspaceService,
} from "@voidhash/core/services";
import { PaywallNotFoundError } from "@voidhash/core/domain/paywall/Paywall";
import { ActionForbiddenError } from "@voidhash/core/domain/auth/Auth";
import { AiChatRpcsDef, AuthMiddleware, AuthSession } from "@voidhash/rpc";
import { Effect, Exit, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";

import { AiChatRpcsLive } from "./ai-chat-rpcs.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const chatRow = (over: Partial<{ id: string; projectId: string; organizationId: string }> = {}) => ({
  id: over.id ?? "chat_1",
  organizationId: over.organizationId ?? "org_1",
  projectId: over.projectId ?? "proj_1",
  surface: "designer",
  chatType: "persistent",
  paywallId: "pw_1",
  title: "Chat",
  messages: "[]",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const paywallRow = (over: Partial<{ id: string; projectId: string }> = {}) => ({
  id: over.id ?? "pw_1",
  slug: "trial",
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

interface CaptureCall {
  readonly chatId: string;
  readonly turnId: string;
  readonly paywallId: string;
  readonly tree: unknown;
}

interface Fakes {
  /** Override `AiChatService.get`; default resolves `chatRow()`. */
  readonly getChat?: () => Effect.Effect<ReturnType<typeof chatRow>, unknown>;
  /** Override `PaywallService.getPaywallById`; default resolves `paywallRow()`. */
  readonly getPaywall?: () => Effect.Effect<ReturnType<typeof paywallRow>, unknown>;
  /** Whether the capture reports a fresh insert (`captured: true`) or a no-op. */
  readonly captured?: boolean;
  /** Raw document tree `readDocumentTree` returns. */
  readonly tree?: unknown;
  /** Collects each capture call so a test can assert what was captured. */
  readonly captures?: CaptureCall[];
}

const buildHandlerLayer = (fakes: Fakes) => {
  const chatLayer = Layer.succeed(AiChatService, {
    get: fakes.getChat ?? (() => Effect.succeed(chatRow())),
    captureCheckpointReporting: (input: CaptureCall) =>
      Effect.sync(() => {
        fakes.captures?.push(input);
        return { captured: fakes.captured ?? true };
      }),
    // The revert handler is provided in the same group; stub the methods it uses
    // so the layer is a complete AiChatService.
    getLastTurnCheckpoints: () => Effect.succeed([]),
  } as unknown as AiChatService["Service"]);

  const paywallLayer = Layer.succeed(PaywallService, {
    getPaywallById: fakes.getPaywall ?? (() => Effect.succeed(paywallRow())),
  } as unknown as PaywallService["Service"]);

  const workspaceLayer = Layer.succeed(PaywallWorkspaceService, {
    readDocumentTree: () =>
      Effect.succeed({ tree: fakes.tree ?? { kind: "tree" }, root: null, version: 3 }),
    revertDocument: () => Effect.succeed({ version: 1, commandCount: 0 }),
  } as unknown as PaywallWorkspaceService["Service"]);

  const authMiddlewareLayer = Layer.succeed(
    AuthMiddleware,
    AuthMiddleware.of((effect) =>
      Effect.provideService(effect, AuthSession, { method: "user", user: { id: "user_1" } } as never),
    ),
  );

  return Layer.mergeAll(
    AiChatRpcsLive.pipe(Layer.provide(Layer.mergeAll(chatLayer, paywallLayer, workspaceLayer))),
    authMiddlewareLayer,
  );
};

interface CaptureResult {
  readonly captured: boolean;
}

interface AiChatClient {
  CaptureAiCheckpoint: (payload: {
    chatId: string;
    turnId: string;
    paywallId: string;
  }) => Effect.Effect<CaptureResult, unknown>;
}

const dispatch = <A>(fakes: Fakes, f: (client: AiChatClient) => Effect.Effect<A, unknown>) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const client = (yield* RpcTest.makeClient(AiChatRpcsDef)) as unknown as AiChatClient;
      return yield* f(client);
    }).pipe(Effect.provide(buildHandlerLayer(fakes)), Effect.scoped),
  );

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AiChatRpcs — CaptureAiCheckpoint", () => {
  it("captures the current tree and reports captured: true", async () => {
    const captures: CaptureCall[] = [];
    const exit = await dispatch({ captures, tree: { kind: "tree", nodes: [] } }, (client) =>
      client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.captured).toBe(true);
    }
    // The capture is keyed by (chat, turn, paywall) and carries the LIVE tree.
    expect(captures).toEqual([
      { chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1", tree: { kind: "tree", nodes: [] } },
    ]);
  });

  it("reports captured: false on the first-write-wins no-op (checkpoint already exists)", async () => {
    const exit = await dispatch({ captured: false }, (client) =>
      client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.captured).toBe(false);
    }
  });

  it("rejects a paywall from a DIFFERENT project than the chat (anti-cross-project)", async () => {
    const captures: CaptureCall[] = [];
    const exit = await dispatch(
      {
        captures,
        getChat: () => Effect.succeed(chatRow({ projectId: "proj_1" })),
        getPaywall: () => Effect.succeed(paywallRow({ projectId: "proj_2" })),
      },
      (client) =>
        client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("Rpc/ActionForbiddenError");
    }
    // No checkpoint may be taken when the paywall is out of the chat's project.
    expect(captures).toEqual([]);
  });

  it("maps a missing chat to Rpc/AiChatNotFoundError", async () => {
    const exit = await dispatch(
      { getChat: () => Effect.fail(new AiChatNotFoundError({ chatId: "chat_1" })) },
      (client) =>
        client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("Rpc/AiChatNotFoundError");
    }
  });

  it("maps a chat-membership denial to Rpc/ActionForbiddenError", async () => {
    const exit = await dispatch(
      { getChat: () => Effect.fail(new AiChatForbiddenError({ message: "not a member" })) },
      (client) =>
        client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("Rpc/ActionForbiddenError");
    }
  });

  it("maps a missing paywall to Rpc/AiChatServiceError", async () => {
    const exit = await dispatch(
      { getPaywall: () => Effect.fail(new PaywallNotFoundError({ message: "gone" })) },
      (client) =>
        client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("Rpc/AiChatServiceError");
    }
  });

  it("maps a paywall permission denial to Rpc/ActionForbiddenError", async () => {
    const exit = await dispatch(
      { getPaywall: () => Effect.fail(new ActionForbiddenError({ message: "no access" })) },
      (client) =>
        client.CaptureAiCheckpoint({ chatId: "chat_1", turnId: "turn_1", paywallId: "pw_1" }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain("Rpc/ActionForbiddenError");
    }
  });
});
