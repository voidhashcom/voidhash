import { ActionForbiddenError, type UserSession } from "@voidhash/core/domain/auth/Auth";
import {
  ApplePushNotificationService,
  FirebaseCloudMessagingService,
  NotificationsConfigurationService,
  PushNotificationSendNotFoundError,
  PushNotificationSendService,
  type PushDeliveryProviderShape,
} from "@voidhash/core/services";
import {
  Db,
  PushNotificationDeliveryStatus,
  PushNotificationSendStatus,
  auditLogs,
  eq,
  pushNotificationConfigs,
  pushNotificationDeliveries,
  pushNotificationSends,
} from "@voidhash/db";
import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

const { test } = CoreIntegrationTestHarness.make();
const suffix = `${Date.now()}-${crypto.randomUUID()}`;
const configurationId = `it_push_config_auth_${suffix}`;
const sendId = `it_push_send_auth_${suffix}`;
const deliveryId = `it_push_delivery_auth_${suffix}`;
const foreignProjectId = `it_project_push_auth_${suffix}`;

const provider = <TKind extends "fcm" | "apns">(id: TKind): PushDeliveryProviderShape<TKind> => ({
  defaultGlobalConfiguration: () => Effect.succeed({}),
  deliver: () => Effect.die("not used"),
  hasPlaintextSecret: () => false,
  id,
  title: id,
  toReadDto: () => ({}),
  validateGlobalConfiguration: (configuration) =>
    Effect.succeed({ parsedConfiguration: configuration, pushProviderKey: id }),
});

const ProviderStubs = Layer.merge(
  Layer.succeed(FirebaseCloudMessagingService, provider("fcm")),
  Layer.succeed(ApplePushNotificationService, provider("apns")),
);
const ConfigurationServiceUnderTest = NotificationsConfigurationService.layer({
  requireEncryption: Effect.succeed(false),
}).pipe(Layer.provide(ProviderStubs));
const ServicesUnderTest = Layer.merge(
  ConfigurationServiceUnderTest,
  PushNotificationSendService.layer,
);

const sessionWithoutProjectAccess = (): UserSession => ({
  cookie: null,
  method: "user",
  name: `${CoreTestFixture.userName} <${CoreTestFixture.userEmail}>`,
  organizations: [],
  person: null,
  projects: [],
  user: {
    createdAt: new Date(0),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: new Date(0),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

const asUnauthorized = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(CoreAuthSession.authenticate(sessionWithoutProjectAccess()));

test(
  "push configuration and send-history operations enforce project ownership",
  Effect.gen(function* () {
    const db = yield* Db;
    const configurations = yield* NotificationsConfigurationService;
    const sends = yield* PushNotificationSendService;

    yield* db.insert(pushNotificationConfigs).values({
      configuration: { secret: "must-not-leak" },
      enabled: false,
      id: configurationId,
      name: "Original configuration",
      projectId: CoreTestFixture.projectId,
      providerId: "test",
      pushProviderKey: `test-provider-key-${suffix}`,
    });
    yield* db.insert(pushNotificationSends).values({
      deviceCount: 1,
      failedCount: 0,
      id: sendId,
      message: { body: "private", title: "Private" },
      projectId: foreignProjectId,
      requestedDistinctIds: [],
      requestedPersonIds: ["foreign-person"],
      skippedCount: 0,
      status: PushNotificationSendStatus.Pending,
      succeededCount: 0,
      unresolvedDistinctIds: [],
    });
    yield* db.insert(pushNotificationDeliveries).values({
      attemptCount: 0,
      id: deliveryId,
      maxAttempts: 5,
      personId: "foreign-person",
      projectId: foreignProjectId,
      provider: "fcm",
      pushDeviceTokenId: `it_push_token_auth_${suffix}`,
      pushNotificationSendId: sendId,
      status: PushNotificationDeliveryStatus.Pending,
    });

    const expectForbidden = <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.gen(function* () {
        const error = yield* asUnauthorized(operation).pipe(Effect.flip);
        expect(error).toBeInstanceOf(ActionForbiddenError);
      });

    yield* expectForbidden(
      configurations.getPushNotificationConfigurations(CoreTestFixture.projectId),
    );
    yield* expectForbidden(configurations.getPushNotificationConfigurationById(configurationId));
    yield* expectForbidden(
      configurations.createPushNotificationConfiguration({
        projectId: CoreTestFixture.projectId,
        providerId: "fcm",
      }),
    );
    yield* expectForbidden(
      configurations.updatePushNotificationConfiguration({
        configuration: { secret: "attacker" },
        enabled: false,
        id: configurationId,
        name: "Compromised",
      }),
    );
    yield* expectForbidden(
      configurations.deletePushNotificationConfiguration({
        pushNotificationConfigurationId: configurationId,
      }),
    );
    yield* expectForbidden(sends.listSends({ projectId: foreignProjectId }));
    yield* expectForbidden(sends.getSendDeliveries({ projectId: foreignProjectId, sendId }));

    const nestedLookupError = yield* sends
      .getSendDeliveries({ projectId: CoreTestFixture.projectId, sendId })
      .pipe(Effect.flip);
    expect(nestedLookupError).toBeInstanceOf(PushNotificationSendNotFoundError);

    const configuration = yield* db.query.pushNotificationConfigs.findFirst({
      where: { id: configurationId },
    });
    expect(configuration).toMatchObject({
      deletedAt: null,
      enabled: false,
      name: "Original configuration",
    });
  }).pipe(
    Effect.ensuring(
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db
          .delete(pushNotificationDeliveries)
          .where(eq(pushNotificationDeliveries.id, deliveryId))
          .pipe(Effect.ignore);
        yield* db
          .delete(pushNotificationSends)
          .where(eq(pushNotificationSends.id, sendId))
          .pipe(Effect.ignore);
        yield* db
          .delete(auditLogs)
          .where(eq(auditLogs.entityId, configurationId))
          .pipe(Effect.ignore);
        yield* db
          .delete(pushNotificationConfigs)
          .where(eq(pushNotificationConfigs.id, configurationId))
          .pipe(Effect.ignore);
      }),
    ),
    Effect.provide(ServicesUnderTest),
    CoreAuthSession.authenticate(),
  ),
);
