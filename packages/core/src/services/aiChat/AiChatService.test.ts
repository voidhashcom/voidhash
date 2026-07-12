import { Db } from "@voidhash/db";
import { Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { AuthSession, type AnyAuthSession } from "../../domain/auth/Auth.ts";
import { PublicFileStore } from "../storage/PublicFileStore.ts";
import { isSessionOrganizationMember, isSessionProjectMember } from "../../utils/permissions.ts";
import { AiChatService } from "./AiChatService.ts";

const makeSession = (
  orgIds: readonly string[],
  projects: ReadonlyArray<{ id: string; organizationId: string }> = [],
): AnyAuthSession => ({
  cookie: null,
  method: "secret-key",
  name: "ci-key",
  organizations: orgIds.map((id) => ({
    id,
    logo: null,
    name: id,
    permissions: ["project:all"],
    slug: id,
    workosOrganizationId: null,
  })),
  projects: projects.map((project) => ({
    id: project.id,
    logo: null,
    name: project.id,
    organizationId: project.organizationId,
    permissions: ["project:all"],
    slug: project.id,
  })),
  person: null,
  user: null,
});

describe("isSessionOrganizationMember", () => {
  it("is true when the org is present in the session", () => {
    expect(isSessionOrganizationMember(makeSession(["org_1", "org_2"]), "org_2")).toBe(true);
  });

  it("is false when the org is absent (cross-org access denied)", () => {
    expect(isSessionOrganizationMember(makeSession(["org_1"]), "org_2")).toBe(false);
  });
});

describe("isSessionProjectMember", () => {
  it("is true when the project belongs to the caller under the claimed org", () => {
    const session = makeSession(["org_1"], [{ id: "proj_1", organizationId: "org_1" }]);
    expect(isSessionProjectMember(session, "proj_1", "org_1")).toBe(true);
  });

  it("is false when the project exists but under a different org (anti-spoof)", () => {
    const session = makeSession(["org_1"], [{ id: "proj_1", organizationId: "org_1" }]);
    expect(isSessionProjectMember(session, "proj_1", "org_2")).toBe(false);
  });

  it("is false when the project is not in the session", () => {
    const session = makeSession(["org_1"], [{ id: "proj_1", organizationId: "org_1" }]);
    expect(isSessionProjectMember(session, "proj_2", "org_1")).toBe(false);
  });
});

// ── AI checkpoint capture + last-turn revert lookup ───────────────────────────

interface ChatRow {
  id: string;
  organizationId: string;
  projectId: string;
}
interface CheckpointRow {
  chatId: string;
  turnId: string;
  paywallId: string;
  tree: unknown;
  createdAt: number;
}

/**
 * A tiny in-memory `Db` fake covering just the calls the checkpoint methods make:
 * - `insert(checkpoint).values(...).onConflictDoNothing(...)` — first-write-wins
 *   per (chatId, turnId, paywallId), mirroring the real unique index;
 * - the chat-row `findRow` select (for the project-membership check);
 * - the checkpoint `select().from().where().orderBy().limit(1)` (newest turn) and
 *   the follow-up select of that turn's pre-images.
 *
 * The fake keys tables by a marker set on the drizzle table object; the service
 * passes the real table objects, so we distinguish them by a stable property.
 */
const makeCheckpointDb = (chats: ChatRow[]) => {
  const checkpoints: CheckpointRow[] = [];
  let clock = 0;

  // `onConflictDoNothing()` performs the first-write-wins insert and returns a
  // builder whose `.returning(...)` resolves to the inserted row on a real insert
  // and an EMPTY array on the conflict no-op — mirroring drizzle, and the signal
  // `captureCheckpointReporting` reads for `captured`. Awaiting the builder
  // directly (no `.returning()`) is also supported for the void `captureCheckpoint`.
  const insert = () => ({
    values: (value: CheckpointRow & { id: string; createdAt?: number }) => ({
      onConflictDoNothing: () => {
        const run = () => {
          const exists = checkpoints.some(
            (row) =>
              row.chatId === value.chatId &&
              row.turnId === value.turnId &&
              row.paywallId === value.paywallId,
          );
          if (!exists) {
            checkpoints.push({ ...value, createdAt: (clock += 1) });
          }
          return exists ? [] : [{ id: value.id }];
        };
        const effect = Effect.sync(run);
        return Object.assign(effect, {
          returning: (_projection?: unknown) => Effect.sync(run),
        });
      },
    }),
  });

  // Both `findRow` (chat) and the checkpoint reads go through `select`. The chat
  // read passes no projection (`select()`), the checkpoint reads pass one — we
  // branch on that. A `where` that is then `.orderBy().limit()` is the newest-turn
  // query; a `where` awaited directly is the turn's pre-images; a `where().limit()`
  // is `findRow`. The `where(...)` result is therefore both an Effect (awaited
  // directly for the pre-images) and a builder (for the chained terminals).
  const newestTurnId = () =>
    checkpoints.length > 0
      ? [...checkpoints].sort((a, b) => b.createdAt - a.createdAt)[0]!.turnId
      : undefined;

  const db = {
    insert,
    select: (projection?: unknown) => {
      const isCheckpoint = projection !== undefined;
      return {
        from: () => ({
          where: (..._args: unknown[]) => {
            const preImages = checkpoints
              .filter((row) => row.turnId === newestTurnId())
              .map((row) => ({ paywallId: row.paywallId, tree: row.tree }));
            const base = {
              orderBy: () => ({
                limit: (_n: number) =>
                  Effect.sync(() => {
                    const turnId = newestTurnId();
                    return turnId !== undefined ? [{ turnId }] : [];
                  }),
              }),
              limit: (_n: number) => Effect.sync(() => (chats.length > 0 ? [chats[0]] : [])),
            };
            return isCheckpoint
              ? Object.assign(
                  Effect.sync(() => preImages),
                  base,
                )
              : base;
          },
        }),
      };
    },
    __checkpoints: checkpoints,
  };

  return { layer: Layer.succeed(Db, db as never), checkpoints };
};

const checkpointLayers = (chats: ChatRow[], session: AnyAuthSession) => {
  const { layer: dbLayer, checkpoints } = makeCheckpointDb(chats);
  const layer = AiChatService.layer.pipe(
    Layer.provide(dbLayer),
    Layer.provide(Layer.succeed(PublicFileStore, {} as never)),
    Layer.provideMerge(Layer.succeed(AuthSession, session as never)),
  );
  return { layer, checkpoints };
};

describe("AiChatService checkpoints", () => {
  it("captureCheckpoint records a pre-image once per (chat, turn, document)", async () => {
    const { layer, checkpoints } = checkpointLayers([], makeSession(["org_1"]));
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const svc = yield* AiChatService;
        yield* svc.captureCheckpoint({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_1",
          tree: { a: 1 },
        });
        // Same (chat, turn, doc) again → first-write-wins, ignored.
        yield* svc.captureCheckpoint({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_1",
          tree: { a: 2 },
        });
        // Different doc in the same turn → new row.
        yield* svc.captureCheckpoint({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_2",
          tree: { b: 1 },
        });
      }).pipe(Effect.provide(layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(checkpoints.map((r) => `${r.turnId}:${r.paywallId}`)).toEqual(["t1:pw_1", "t1:pw_2"]);
    // The preserved pre-image is the FIRST one (tree { a: 1 }).
    expect(checkpoints.find((r) => r.paywallId === "pw_1")?.tree).toEqual({ a: 1 });
  });

  it("captureCheckpointReporting reports captured true then false (first-write-wins)", async () => {
    const { layer, checkpoints } = checkpointLayers([], makeSession(["org_1"]));
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const svc = yield* AiChatService;
        // First capture for the turn takes the checkpoint.
        const first = yield* svc.captureCheckpointReporting({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_1",
          tree: { a: 1 },
        });
        // Re-capturing the same (chat, turn, doc) is a no-op — captured: false,
        // and the original pre-image is preserved.
        const second = yield* svc.captureCheckpointReporting({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_1",
          tree: { a: 2 },
        });
        return { first, second };
      }).pipe(Effect.provide(layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      expect(exit.value.first.captured).toBe(true);
      expect(exit.value.second.captured).toBe(false);
    }
    // Only one row, holding the original pre-image.
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]!.tree).toEqual({ a: 1 });
  });

  it("getLastTurnCheckpoints returns the newest turn's pre-images (project membership required)", async () => {
    const { layer } = checkpointLayers(
      [{ id: "c1", organizationId: "org_1", projectId: "proj_1" }],
      makeSession(["org_1"], [{ id: "proj_1", organizationId: "org_1" }]),
    );
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const svc = yield* AiChatService;
        yield* svc.captureCheckpoint({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_1",
          tree: { v: 1 },
        });
        yield* svc.captureCheckpoint({
          chatId: "c1",
          turnId: "t2",
          paywallId: "pw_1",
          tree: { v: 2 },
        });
        return yield* svc.getLastTurnCheckpoints({ chatId: "c1" });
      }).pipe(Effect.provide(layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      // Only the LAST turn (t2) is returned.
      expect(exit.value).toEqual([{ paywallId: "pw_1", tree: { v: 2 } }]);
    }
  });

  it("getLastTurnCheckpoints forbids a non-member of the chat's org", async () => {
    const { layer } = checkpointLayers(
      [{ id: "c1", organizationId: "org_other", projectId: "proj_other" }],
      makeSession(["org_1"], [{ id: "proj_1", organizationId: "org_1" }]),
    );
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const svc = yield* AiChatService;
        return yield* svc.getLastTurnCheckpoints({ chatId: "c1" });
      }).pipe(Effect.provide(layer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("AiChatForbiddenError");
    }
  });

  it("getLastTurnCheckpoints forbids an org member outside the chat's project (no revert)", async () => {
    // The caller belongs to the chat's ORG but not its PROJECT. Reverting mutates
    // that project's paywalls, so project membership — not just org membership —
    // must gate the lookup, else a cross-project org member could revert paywalls.
    const { layer, checkpoints } = checkpointLayers(
      [{ id: "c1", organizationId: "org_1", projectId: "proj_1" }],
      makeSession(["org_1"], [{ id: "proj_2", organizationId: "org_1" }]),
    );
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const svc = yield* AiChatService;
        yield* svc.captureCheckpoint({
          chatId: "c1",
          turnId: "t1",
          paywallId: "pw_1",
          tree: { v: 1 },
        });
        return yield* svc.getLastTurnCheckpoints({ chatId: "c1" });
      }).pipe(Effect.provide(layer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("AiChatForbiddenError");
    }
    // The forbidden lookup returned no pre-images, so no document is reverted.
    expect(checkpoints.length).toBe(1);
  });
});
