import { Db } from "@voidhash/db";
import { Effect, Layer, Result } from "effect";

import { AuthSession } from "../../domain/auth/Auth.ts";
import { describe, expect, it } from "../../testing/effect-vitest.ts";
import {
  AgentSessionForbiddenError,
  AgentSessionIndexService,
  AgentSessionNotFoundError,
} from "./AgentSessionIndexService.ts";

interface SessionRow {
  id: string;
  organizationId: string;
  projectId: string;
  surface: string;
  paywallId: string | null;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const auth = {
  cookie: null,
  method: "user" as const,
  name: "User",
  person: null,
  organizations: [],
  projects: [
    {
      id: "project_1",
      logo: null,
      name: "Project",
      organizationId: "org_1",
      permissions: ["project:all"],
      slug: "project",
    },
  ],
  user: {
    id: "user_1",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    email: "user@example.com",
    emailVerified: true,
    image: null,
    name: "User",
    role: null,
    workosUserId: "workos_user_1",
  },
};

const makeRow = (overrides: Partial<SessionRow> = {}): SessionRow => ({
  id: "agent_1",
  organizationId: "org_1",
  projectId: "project_1",
  surface: "designer",
  paywallId: null,
  userId: "user_1",
  title: "Session",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
  ...overrides,
});

const collectColumnNames = (value: unknown, names = new Set<string>()): Set<string> => {
  if (value === null || typeof value !== "object") return names;
  if ("name" in value && "table" in value && typeof value.name === "string") {
    names.add(value.name);
    return names;
  }
  if ("queryChunks" in value && Array.isArray(value.queryChunks)) {
    for (const chunk of value.queryChunks) collectColumnNames(chunk, names);
  }
  return names;
};

const makeFixture = (initial?: SessionRow) => {
  let row = initial;
  let listColumns = new Set<string>();
  let insertCount = 0;

  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: () => Effect.succeed(row === undefined ? [] : [row]),
          orderBy: () => {
            listColumns = collectColumnNames(condition);
            return Effect.succeed(row === undefined ? [] : [row]);
          },
        }),
      }),
    }),
    insert: () => ({
      values: (value: SessionRow) => ({
        onConflictDoNothing: () => ({
          returning: () =>
            Effect.sync(() => {
              insertCount += 1;
              if (row !== undefined) return [];
              row = {
                ...value,
                createdAt: new Date(0),
                updatedAt: new Date(0),
                deletedAt: null,
              };
              return [row];
            }),
        }),
      }),
    }),
    update: () => ({
      set: (patch: Partial<SessionRow>) => ({
        where: () => {
          const apply = () => {
            if (row === undefined) return undefined;
            row = { ...row, ...patch };
            return row;
          };
          return Object.assign(Effect.sync(apply), {
            returning: () =>
              Effect.sync(() => {
                const updated = apply();
                return updated === undefined ? [] : [updated];
              }),
          });
        },
      }),
    }),
  };

  const layer = AgentSessionIndexService.layer.pipe(Layer.provide(Layer.succeed(Db, db as never)));
  return {
    get insertCount() {
      return insertCount;
    },
    get listColumns() {
      return listColumns;
    },
    get row() {
      return row;
    },
    layer,
  };
};

describe("AgentSessionIndexService", () => {
  it.effect("tombstones deletion and prevents the durable session from being re-indexed", () => {
    const fixture = makeFixture(makeRow());
    return Effect.gen(function* () {
      const sessions = yield* AgentSessionIndexService;
      yield* sessions.delete({ sessionId: "agent_1" });
      expect(fixture.row?.deletedAt).toBeInstanceOf(Date);

      const missing = yield* Effect.result(sessions.get({ sessionId: "agent_1" }));
      expect(Result.isFailure(missing) && missing.failure).toBeInstanceOf(
        AgentSessionNotFoundError,
      );

      const reopened = yield* Effect.result(
        sessions.touch({
          id: "agent_1",
          organizationId: "org_1",
          projectId: "project_1",
          userId: "user_1",
        }),
      );
      expect(Result.isFailure(reopened) && reopened.failure).toBeInstanceOf(
        AgentSessionForbiddenError,
      );
    }).pipe(Effect.provideService(AuthSession, auth), Effect.provide(fixture.layer));
  });

  it.effect("rejects attempts to assign a session to a different user", () => {
    const fixture = makeFixture();
    return Effect.gen(function* () {
      const sessions = yield* AgentSessionIndexService;
      const result = yield* Effect.result(
        sessions.touch({
          id: "agent_1",
          organizationId: "org_1",
          projectId: "project_1",
          userId: "user_other",
        }),
      );
      expect(Result.isFailure(result) && result.failure).toBeInstanceOf(AgentSessionForbiddenError);
      expect(fixture.insertCount).toBe(0);
    }).pipe(Effect.provideService(AuthSession, auth), Effect.provide(fixture.layer));
  });

  it.effect("scopes history to the current user and excludes tombstones", () => {
    const fixture = makeFixture(makeRow());
    return Effect.gen(function* () {
      const sessions = yield* AgentSessionIndexService;
      const rows = yield* sessions.list({
        organizationId: "org_1",
        projectId: "project_1",
        surface: "designer",
      });
      expect(rows).toHaveLength(1);
      expect(fixture.listColumns).toContain("user_id");
      expect(fixture.listColumns).toContain("deleted_at");
    }).pipe(Effect.provideService(AuthSession, auth), Effect.provide(fixture.layer));
  });
});
