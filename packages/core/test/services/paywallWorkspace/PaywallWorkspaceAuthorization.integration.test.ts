import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import { MimicHost, PaywallService, PaywallWorkspaceService } from "@voidhash/core/services";
import { Db, eq, paywalls } from "@voidhash/db";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { generateId } from "@voidhash/core/utils/generate-id";
import { DateTime, Effect, Layer } from "effect";
import { expect } from "vitest";

const { test } = CoreIntegrationTestHarness.make();
const suffix = generateId("test");
const epoch = DateTime.toDateUtc(DateTime.makeUnsafe(0));
const paywallId = `it_workspace_auth_${suffix}`;
const paywallSlug = `workspace-auth-${suffix}`;
const mimicCalls: string[] = [];

const MimicHostTest = Layer.succeed(MimicHost, {
  closePaywallConnection: () => Effect.void,
  ensurePaywallDocument: (id: string) =>
    Effect.sync(() => {
      mimicCalls.push(`ensure:${id}`);
    }),
  createPaywallEditToken: () =>
    Effect.succeed({ expiresAt: epoch, token: "unused", url: "ws://unused" }),
  getPaywallSnapshot: (id: string) =>
    Effect.sync(() => {
      mimicCalls.push(`snapshot:${id}`);
      return null;
    }),
  getPaywallDocument: (id: string) =>
    Effect.sync(() => {
      mimicCalls.push(`document:${id}`);
      return { root: null, tree: { kind: "tree", nodes: [] }, version: 1 };
    }),
  getConnectedPaywallDocument: (input) =>
    Effect.sync(() => {
      mimicCalls.push(`connected-document:${input.paywallId}`);
      return { root: null, tree: { kind: "tree", nodes: [] }, version: 1 };
    }),
  heartbeatPaywallConnection: () => Effect.void,
  openPaywallConnection: (input) =>
    Effect.sync(() => {
      mimicCalls.push(`open:${input.paywallId}`);
      return { root: null, tree: { kind: "tree", nodes: [] }, version: 1 };
    }),
  submitConnectedPaywallTransaction: (id: string) =>
    Effect.sync(() => {
      mimicCalls.push(`connected-submit:${id}`);
      return { accepted: true, version: 2 };
    }),
  submitPaywallTransaction: (id: string) =>
    Effect.sync(() => {
      mimicCalls.push(`submit:${id}`);
      return { accepted: true, version: 2 };
    }),
});

const ServiceUnderTest = PaywallWorkspaceService.layer.pipe(
  Layer.provide(Layer.merge(PaywallService.layer, MimicHostTest)),
);

const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: epoch,
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: epoch,
    workosUserId: CoreTestFixture.workosUserId,
  },
});

const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

test(
  "workspace reads and mutations authorize stored paywalls before touching Mimic",
  Effect.gen(function* () {
    const db = yield* Db;
    const workspace = yield* PaywallWorkspaceService;
    mimicCalls.length = 0;

    yield* db.insert(paywalls).values({
      id: paywallId,
      name: "Victim workspace",
      projectId: CoreTestFixture.projectId,
      slug: paywallSlug,
    });

    const expectForbidden = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const error = yield* asUnauthorized(operation).pipe(Effect.flip);
        expect(error).toBeInstanceOf(ActionForbiddenError);
      });

    yield* expectForbidden(workspace.listPaywalls(CoreTestFixture.projectId));
    yield* expectForbidden(workspace.readDocument(CoreTestFixture.projectId, paywallSlug));
    yield* expectForbidden(workspace.readDocumentTree(paywallId));
    yield* expectForbidden(workspace.editDocument(CoreTestFixture.projectId, paywallSlug, []));
    yield* expectForbidden(
      workspace.writeComponentSource(
        CoreTestFixture.projectId,
        paywallSlug,
        "components/attacker.tsx",
        "export default () => null",
      ),
    );
    yield* expectForbidden(
      workspace.moveComponentFile(
        CoreTestFixture.projectId,
        paywallSlug,
        "victim.tsx",
        "attacker.tsx",
      ),
    );
    yield* expectForbidden(
      workspace.deleteComponentFile(CoreTestFixture.projectId, paywallSlug, "victim.tsx"),
    );
    yield* expectForbidden(workspace.revertDocument(paywallId, { kind: "tree", nodes: [] }));

    const row = yield* db.query.paywalls.findFirst({ where: { id: paywallId } });
    expect(row).toMatchObject({ projectId: CoreTestFixture.projectId, slug: paywallSlug });
    expect(mimicCalls).toEqual([]);
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.delete(paywalls).where(eq(paywalls.id, paywallId)).pipe(Effect.ignore);
      }),
    ),
    Effect.provide(ServiceUnderTest),
    CoreAuthSession.authenticate(),
  ),
);
