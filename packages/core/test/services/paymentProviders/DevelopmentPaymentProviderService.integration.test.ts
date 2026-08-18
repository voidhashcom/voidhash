import type { UserSession } from "@voidhash/core/domain/auth/Auth";
import { generateId } from "@voidhash/core/utils";
import {
  DevelopmentPaymentProviderService,
  DevelopmentPaymentProviderServiceError,
  IdentityProjectionPublisher,
  PerkGrantService,
  PersonIdentityService,
  PurchaseProcessingService,
} from "@voidhash/core/services";
import {
  Db,
  PersonUnlockedPerkStatus,
  ProviderEnvironment,
  eq,
  inArray,
  paymentProviderConfigurationProducts,
  paymentProviderConfigurations,
  personIdentities,
  personUnlockedPerks,
  persons,
  perks,
  productPerks,
  products,
  projects,
  purchaseLedger,
  purchases,
  subscriptions,
  transactions,
} from "@voidhash/db";
import { ProductType, PurchaseType, SubscriptionDuration, SubscriptionStatus } from "@voidhash/lib";
import { DateTime, Effect, Layer, Option } from "effect";
import { describe, expect } from "vitest";

import { CoreAuthSession } from "@testing/CoreAuthSession";
import { CoreIntegrationTestHarness } from "@testing/CoreIntegrationTestHarness";
import { CoreTestFixture } from "@testing/CoreTestFixture";

const { test } = CoreIntegrationTestHarness.make();

const DevelopmentEngineLive = DevelopmentPaymentProviderService.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(PurchaseProcessingService.layer, PersonIdentityService.layer)),
  Layer.provideMerge(Layer.mergeAll(PerkGrantService.layer, IdentityProjectionPublisher.noop)),
);

const makeSession = (projectId: string, projectSlug: string): UserSession => ({
  cookie: null,
  method: "user",
  name: CoreTestFixture.userName,
  organizations: [
    {
      id: CoreTestFixture.organizationId,
      logo: null,
      name: CoreTestFixture.organizationName,
      permissions: ["organization:all"],
      slug: CoreTestFixture.organizationSlug,
      workosOrganizationId: CoreTestFixture.workosOrganizationId,
    },
  ],
  person: null,
  projects: [
    {
      id: projectId,
      logo: null,
      name: "Development Provider Integration",
      organizationId: CoreTestFixture.organizationId,
      permissions: ["project:all"],
      slug: projectSlug,
    },
  ],
  user: {
    createdAt: DateTime.toDateUtc(DateTime.makeUnsafe(0)),
    email: CoreTestFixture.userEmail,
    emailVerified: true,
    id: CoreTestFixture.userId,
    image: null,
    name: CoreTestFixture.userName,
    role: null,
    updatedAt: DateTime.toDateUtc(DateTime.makeUnsafe(0)),
    workosUserId: CoreTestFixture.workosUserId,
  },
});

const cleanupProject = (projectId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const [people, configurations, catalogProducts] = yield* Effect.all([
      db.query.persons.findMany({ columns: { id: true }, where: { projectId } }),
      db.query.paymentProviderConfigurations.findMany({
        columns: { id: true },
        where: { projectId },
      }),
      db.query.products.findMany({ columns: { id: true }, where: { projectId } }),
    ]);
    const personIds = people.map(({ id }) => id);
    const configurationIds = configurations.map(({ id }) => id);
    let mappings: ReadonlyArray<{ readonly id: string }> = [];
    if (configurationIds.length > 0) {
      mappings = yield* db.query.paymentProviderConfigurationProducts.findMany({
        columns: { id: true },
        where: { paymentProviderConfigurationId: { in: configurationIds } },
      });
    }
    const mappingIds = mappings.map(({ id }) => id);
    const productIds = catalogProducts.map(({ id }) => id);

    if (personIds.length > 0) {
      yield* db
        .delete(personUnlockedPerks)
        .where(inArray(personUnlockedPerks.personId, personIds))
        .pipe(Effect.ignore);
    }
    if (mappingIds.length > 0) {
      yield* db
        .delete(transactions)
        .where(inArray(transactions.paymentProviderConfigurationProductId, mappingIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(purchases)
        .where(inArray(purchases.paymentProviderConfigurationProductId, mappingIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(subscriptions)
        .where(inArray(subscriptions.paymentProviderConfigurationProductId, mappingIds))
        .pipe(Effect.ignore);
      yield* db
        .delete(paymentProviderConfigurationProducts)
        .where(inArray(paymentProviderConfigurationProducts.id, mappingIds))
        .pipe(Effect.ignore);
    }
    yield* db
      .delete(purchaseLedger)
      .where(eq(purchaseLedger.projectId, projectId))
      .pipe(Effect.ignore);
    yield* db
      .delete(personIdentities)
      .where(eq(personIdentities.projectId, projectId))
      .pipe(Effect.ignore);
    if (personIds.length > 0) {
      yield* db.delete(persons).where(inArray(persons.id, personIds)).pipe(Effect.ignore);
    }
    if (productIds.length > 0) {
      yield* db
        .delete(productPerks)
        .where(inArray(productPerks.productId, productIds))
        .pipe(Effect.ignore);
    }
    if (configurationIds.length > 0) {
      yield* db
        .delete(paymentProviderConfigurations)
        .where(inArray(paymentProviderConfigurations.id, configurationIds))
        .pipe(Effect.ignore);
    }
    yield* db.delete(products).where(eq(products.projectId, projectId)).pipe(Effect.ignore);
    yield* db.delete(perks).where(eq(perks.projectId, projectId)).pipe(Effect.ignore);
    yield* db.delete(projects).where(eq(projects.id, projectId)).pipe(Effect.ignore);
  }).pipe(Effect.ignore);

interface DevelopmentScenario {
  readonly consumableProductId: string;
  readonly distinctId: string;
  readonly perkId: string;
  readonly projectId: string;
  readonly projectSlug: string;
  readonly purchaseDate: Date;
  readonly subscriptionProductId: string;
  readonly suffix: string;
}

const seedScenario = (scenario: DevelopmentScenario) =>
  Effect.gen(function* () {
    const db = yield* Db;
    yield* db.insert(projects).values({
      createdByUserId: CoreTestFixture.userId,
      id: scenario.projectId,
      name: "Development Provider Integration",
      organizationId: CoreTestFixture.organizationId,
      slug: scenario.projectSlug,
    });
    yield* db.insert(products).values([
      {
        duration: SubscriptionDuration.Weekly,
        id: scenario.subscriptionProductId,
        name: "Weekly development subscription",
        projectId: scenario.projectId,
        slug: "weekly-dev",
        type: ProductType.Subscription,
      },
      {
        duration: null,
        id: scenario.consumableProductId,
        name: "Development credits",
        projectId: scenario.projectId,
        slug: "dev-credits",
        type: ProductType.OneTimeConsumable,
      },
    ]);
    yield* db.insert(perks).values({
      id: scenario.perkId,
      name: "Development access",
      projectId: scenario.projectId,
      slug: "development-access",
    });
    yield* db.insert(productPerks).values([
      {
        id: generateId("productPerk"),
        perkId: scenario.perkId,
        productId: scenario.subscriptionProductId,
      },
      {
        id: generateId("productPerk"),
        perkId: scenario.perkId,
        productId: scenario.consumableProductId,
      },
    ]);
  });

const runSubscriptionFlow = (scenario: DevelopmentScenario) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* DevelopmentPaymentProviderService;
    const input = {
      devTransactionId: `subscription-${scenario.suffix}`,
      distinctId: scenario.distinctId,
      productSlug: "weekly-dev",
      projectId: scenario.projectId,
      purchaseDate: scenario.purchaseDate,
    };
    const concurrent = yield* Effect.all(
      [service.processSdkPurchase(input), service.processSdkPurchase(input)],
      { concurrency: "unbounded" },
    );
    expect(concurrent.filter(({ result }) => result.idempotent)).toHaveLength(1);

    const subscriptionId = Option.getOrThrow(concurrent[0].result.subscriptionId);
    const identity = yield* db.query.personIdentities.findFirst({
      where: { distinctId: scenario.distinctId, projectId: scenario.projectId },
    });
    expect(identity).toBeDefined();
    const personId = identity?.personId ?? "";
    const configurations = yield* db.query.paymentProviderConfigurations.findMany({
      where: { projectId: scenario.projectId, providerId: "development" },
    });
    expect(configurations).toHaveLength(1);
    const mappings = yield* db.query.paymentProviderConfigurationProducts.findMany({
      where: { paymentProviderConfigurationId: configurations[0].id },
    });
    expect(mappings).toHaveLength(1);

    const subscription = yield* db.query.subscriptions.findFirst({ where: { id: subscriptionId } });
    expect(subscription?.providerEnvironment).toBe(ProviderEnvironment.Development);
    expect(subscription?.expiresAt?.getTime()).toBe(
      scenario.purchaseDate.getTime() + 7 * 24 * 60 * 60 * 1_000,
    );
    const subscriptionTransactions = yield* db.query.transactions.findMany({
      where: { personId, providerEnvironment: ProviderEnvironment.Development },
    });
    expect(subscriptionTransactions).toHaveLength(1);
    expect(subscriptionTransactions[0].grossAmount).toBe(499);
    const initialLedger = yield* db.query.purchaseLedger.findMany({
      where: { projectId: scenario.projectId, providerId: "development" },
    });
    expect(initialLedger).toHaveLength(1);
    expect(initialLedger[0].idempotencyKey.startsWith("dev:")).toBe(true);

    yield* service.applyLifecycleAction({
      action: "renew",
      actionId: `renew-${scenario.suffix}`,
      projectId: scenario.projectId,
      targetId: subscriptionId,
      targetType: "subscription",
    });
    const renewed = yield* db.query.subscriptions.findFirst({ where: { id: subscriptionId } });
    expect(renewed?.expiresAt?.getTime()).toBe(
      scenario.purchaseDate.getTime() + 14 * 24 * 60 * 60 * 1_000,
    );

    const expireAction = {
      action: "expire",
      actionId: `expire-${scenario.suffix}`,
      projectId: scenario.projectId,
      targetId: subscriptionId,
      targetType: "subscription",
    } satisfies Parameters<typeof service.applyLifecycleAction>[0];
    yield* service.applyLifecycleAction(expireAction);
    yield* service.applyLifecycleAction(expireAction);
    const expired = yield* db.query.subscriptions.findFirst({ where: { id: subscriptionId } });
    expect(expired?.status).toBe(SubscriptionStatus.Canceled);
    const expiredGrant = yield* db.query.personUnlockedPerks.findFirst({
      where: {
        environment: ProviderEnvironment.Development,
        perkId: scenario.perkId,
        personId,
      },
    });
    expect(expiredGrant?.status).toBe(PersonUnlockedPerkStatus.Expired);
    return { input, mappingId: mappings[0].id, personId };
  });

const runConsumableFlow = (scenario: DevelopmentScenario, personId: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* DevelopmentPaymentProviderService;
    const purchaseDate = yield* DateTime.nowAsDate;
    const consumable = yield* service.processSdkPurchase({
      devTransactionId: `consumable-${scenario.suffix}`,
      distinctId: scenario.distinctId,
      productSlug: "dev-credits",
      projectId: scenario.projectId,
      purchaseDate,
      quantity: 3,
    });
    const purchaseId = Option.getOrThrow(consumable.result.purchaseId);
    const purchase = yield* db.query.purchases.findFirst({ where: { id: purchaseId } });
    expect(purchase?.providerEnvironment).toBe(ProviderEnvironment.Development);
    expect(purchase?.type).toBe(PurchaseType.OneTimeConsumable);
    const consumableTransaction = yield* db.query.transactions.findFirst({
      where: {
        personId,
        storeTransactionId: `development:${scenario.projectId}:consumable-${scenario.suffix}`,
      },
    });
    expect(consumableTransaction?.grossAmount).toBe(1_497);

    yield* service.applyLifecycleAction({
      action: "refund",
      actionId: `refund-${scenario.suffix}`,
      projectId: scenario.projectId,
      targetId: purchaseId,
      targetType: "purchase",
    });
    const refunded = yield* db.query.purchases.findFirst({ where: { id: purchaseId } });
    expect(refunded?.refundedAt).toBeInstanceOf(Date);
  });

const runGuardAndResetFlow = (
  scenario: DevelopmentScenario,
  state: {
    readonly input: {
      readonly devTransactionId: string;
      readonly distinctId: string;
      readonly productSlug: string;
      readonly projectId: string;
      readonly purchaseDate: Date;
    };
    readonly mappingId: string;
    readonly personId: string;
  },
) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const service = yield* DevelopmentPaymentProviderService;
    const realSubscriptionId = generateId("subscription");
    const expiresAt = DateTime.toDateUtc(DateTime.add(yield* DateTime.now, { days: 1 }));
    yield* db.insert(subscriptions).values({
      expiresAt,
      id: realSubscriptionId,
      initialTransactionId: `real-initial-${scenario.suffix}`,
      latestTransactionId: `real-latest-${scenario.suffix}`,
      paymentProviderConfigurationProductId: state.mappingId,
      personId: state.personId,
      providerEnvironment: ProviderEnvironment.Production,
      purchasedAt: scenario.purchaseDate,
      startsAt: scenario.purchaseDate,
      status: SubscriptionStatus.Active,
      storeSubscriptionId: `real-store-${scenario.suffix}`,
    });
    const realTargetError = yield* Effect.flip(
      service.applyLifecycleAction({
        action: "revoke",
        actionId: `invalid-real-${scenario.suffix}`,
        projectId: scenario.projectId,
        targetId: realSubscriptionId,
        targetType: "subscription",
      }),
    );
    expect(realTargetError).toBeInstanceOf(DevelopmentPaymentProviderServiceError);

    yield* service.setDevelopmentPurchasesEnabled({
      enabled: false,
      projectId: scenario.projectId,
    });
    const disabledError = yield* Effect.flip(
      service.processSdkPurchase({
        ...state.input,
        devTransactionId: `disabled-${scenario.suffix}`,
      }),
    );
    expect(disabledError.message).toContain("disabled");
    yield* service.setDevelopmentPurchasesEnabled({
      enabled: true,
      projectId: scenario.projectId,
    });

    const current = yield* service.getDevelopmentState({
      personId: state.personId,
      projectId: scenario.projectId,
    });
    expect(current.subscriptions).toHaveLength(1);
    expect(current.purchases).toHaveLength(1);
    expect(current.developmentPurchasesEnabled).toBe(true);

    yield* service.resetDevelopmentData(scenario.projectId);
    expect(
      yield* db.query.transactions.findMany({
        where: {
          personId: state.personId,
          providerEnvironment: ProviderEnvironment.Development,
        },
      }),
    ).toHaveLength(0);
    expect(
      yield* db.query.purchaseLedger.findMany({
        where: { projectId: scenario.projectId, providerId: "development" },
      }),
    ).toHaveLength(0);
    expect(
      yield* db.query.subscriptions.findFirst({ where: { id: realSubscriptionId } }),
    ).toBeDefined();
  });

describe("DevelopmentPaymentProviderService", () => {
  const suffix = generateId("test");
  const scenario: DevelopmentScenario = {
    consumableProductId: generateId("product"),
    distinctId: `dev-person-${suffix}`,
    perkId: generateId("perk"),
    projectId: `it-dev-project-${suffix}`,
    projectSlug: `it-dev-${suffix}`,
    purchaseDate: DateTime.toDateUtc(DateTime.subtract(DateTime.nowUnsafe(), { minutes: 1 })),
    subscriptionProductId: generateId("product"),
    suffix,
  };

  test(
    "runs the storeless purchase, lifecycle, guard, and reset paths end to end",
    Effect.gen(function* () {
      yield* seedScenario(scenario);
      const state = yield* runSubscriptionFlow(scenario);
      yield* runConsumableFlow(scenario, state.personId);
      yield* runGuardAndResetFlow(scenario, state);
    }).pipe(
      CoreAuthSession.authenticate(makeSession(scenario.projectId, scenario.projectSlug)),
      Effect.ensuring(cleanupProject(scenario.projectId)),
      Effect.provide(DevelopmentEngineLive),
    ),
  );
});
