import { Effect } from "effect";

import { CacheManager } from "../../src/core/caching/cache-manager";
import { PersonInfoManager } from "../../src/core/identity/person-info-manager";
import {
  createApiClientDouble,
  createEffectTestHarness,
  createInMemoryCacheAdapter,
  createPaymentAdapterDouble,
  createSdkPerson,
} from "../helpers/effect-test-harness";
import { describe, expect, it } from "../helpers/effect-vitest";

/** Runs a test body and always performs its cleanup, mirroring try/finally. */
const withCleanup = <T>(body: () => Promise<T>, cleanup: () => Promise<void>): Promise<T> =>
  Effect.runPromise(
    Effect.tryPromise({ try: body, catch: (error) => error }).pipe(
      Effect.ensuring(Effect.promise(cleanup)),
    ),
  );

const wait = (ms: number) => Effect.runPromise(Effect.sleep(ms));

describe("PersonInfoManager", () => {
  it("returns cached person for cache policy without API call", async () => {
    const person = createSdkPerson("cached-user");
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    await withCleanup(
      async () => {
        await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) => manager.cache("cached-user", person)),
        );

        const result = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) => manager.getPerson("cached-user", "cache")),
        );

        expect(result).toEqual(person);
        expect(apiDouble.state.getPersonCalls).toHaveLength(0);
      },
      async () => {
        await harness.runtime.dispose();
      },
    );
  });

  it("fetch policy always requests API and updates cache", async () => {
    const apiDouble = createApiClientDouble({
      getPersonResult: createSdkPerson("fetched-user"),
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    await withCleanup(
      async () => {
        const result = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) => manager.getPerson("fetched-user", "fetch")),
        );
        const cached = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) => manager.getPersonFromCache("fetched-user")),
        );

        if (result === null) {
          return Effect.runSync(Effect.die(new Error("Expected fetched person")));
        }

        expect(result.distinctId).toBe("fetched-user");
        expect(apiDouble.state.getPersonCalls).toHaveLength(1);
        expect(cached?.value.distinctId).toBe("fetched-user");
      },
      async () => {
        await harness.runtime.dispose();
      },
    );
  });

  it("fetch policy returns null (not a failure) when the person is not found", async () => {
    const apiDouble = createApiClientDouble({ getPersonShouldNotFound: true });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    await withCleanup(
      async () => {
        const result = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) =>
            manager.getPerson("brand-new-user", "fetch"),
          ),
        );
        const cached = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) =>
            manager.getPersonFromCache("brand-new-user"),
          ),
        );

        expect(result).toBeNull();
        expect(apiDouble.state.getPersonCalls).toHaveLength(1);
        // A not-found person must not be cached as an empty snapshot.
        expect(cached).toBeNull();
      },
      async () => {
        await harness.runtime.dispose();
      },
    );
  });

  it("fetch-while-stale returns fresh cache without API call", async () => {
    const person = createSdkPerson("fresh-user");
    const apiDouble = createApiClientDouble();
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    await withCleanup(
      async () => {
        await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) => manager.cache("fresh-user", person)),
        );

        const result = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) =>
            manager.getPerson("fresh-user", "fetch-while-stale"),
          ),
        );

        expect(result).toEqual(person);
        expect(apiDouble.state.getPersonCalls).toHaveLength(0);
      },
      async () => {
        await harness.runtime.dispose();
      },
    );
  });

  it("fetch-while-stale fetches from API when cache is stale", async () => {
    const stalePerson = createSdkPerson("stale-user");
    const fetchedPerson = createSdkPerson("fetched-stale-user");
    const apiDouble = createApiClientDouble({
      getPersonResult: fetchedPerson,
    });
    const paymentDouble = createPaymentAdapterDouble();
    const cache = createInMemoryCacheAdapter();
    const harness = createEffectTestHarness({
      apiClient: apiDouble.apiClient,
      cacheAdapter: cache.adapter,
      paymentAdapter: paymentDouble.paymentAdapter,
    });

    await withCleanup(
      async () => {
        await harness.runtime.runPromise(
          Effect.flatMap(CacheManager, (manager) =>
            manager.set("person:stale-user", stalePerson, {
              staleTime: 1,
              ttl: 1000,
            }),
          ),
        );
        await wait(5);

        const result = await harness.runtime.runPromise(
          Effect.flatMap(PersonInfoManager, (manager) =>
            manager.getPerson("stale-user", "fetch-while-stale"),
          ),
        );

        expect(apiDouble.state.getPersonCalls).toHaveLength(1);
        expect(result).toEqual(fetchedPerson);
      },
      async () => {
        await harness.runtime.dispose();
      },
    );
  });
});
