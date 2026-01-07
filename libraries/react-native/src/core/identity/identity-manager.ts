import { Effect } from "effect";

import { ANONYMOUS_USER_ID_PREFIX } from "../../constants";
import { CacheManager } from "../caching/cache-manager";
import { EventBusProvider } from "../event-bus";
import { ApiClient } from "../networking/api-client";
import { getCommonSdkHeaders } from "../utils/get-common-sdk-headers";
import { CustomerAttributeManager } from "./customer-attribute-manager";
import { CustomerInfoManager } from "./customer-info-manager";

const CACHE_KEY = "appUserId";

export class IdentityManager extends Effect.Service<IdentityManager>()(
  "rn-voidhash/IdentityManager",
  {
    dependencies: [
      CacheManager.Default,
      CustomerAttributeManager.Default,
      CustomerInfoManager.Default,
      ApiClient.Default,
    ],
    effect: Effect.gen(function* effect() {
      const cacheManager = yield* CacheManager;
      const customerAttributeManager = yield* CustomerAttributeManager;
      const customerInfoManager = yield* CustomerInfoManager;
      const eventBus = yield* EventBusProvider;
      const apiClient = yield* ApiClient;

      /**
       * Returns the app user id. If no app user id is cached, a new anonymous user id is generated and cached.
       * @returns The app user id.
       */
      const getAppUserId = () =>
        Effect.gen(function* getAppUserId() {
          const appUserId = yield* getAppUserIdFromCache();
          if (appUserId) {
            yield* Effect.logDebug(`Using cached app user id: ${appUserId}`);
            return appUserId;
          }

          const anonymousUserId = generateAnonymousUserId();
          yield* setAppUserIdInCache(anonymousUserId);
          return anonymousUserId;
        });

      /**
       * Identifies the customer. It makes a request to the server to identify the customer and caches the app user id.
       * @param appUserId - The app user id.
       * @param options - The options.
       */
      const identify = (
        appUserId: string,
        options: {
          email?: string;
          name?: string;
        }
      ) =>
        Effect.gen(function* identify() {
          const currentAppUserId = yield* getAppUserId();
          yield* customerAttributeManager.syncCustomerAttributes(
            currentAppUserId
          );
          const commonHeaders = yield* getCommonSdkHeaders();
          const identifyRequest = yield* apiClient.sdk.identify({
            headers: {
              ...commonHeaders,
              "x-app-user-id": currentAppUserId,
            },
            payload: {
              appUserId,
              email: options.email,
              name: options.name,
            },
          });

          yield* Effect.all([
            setAppUserIdInCache(appUserId),
            customerInfoManager.cache(appUserId, identifyRequest),
          ]);

          eventBus.emit("customer-identified");
          eventBus.emit("customer-fetched", {
            ...identifyRequest,
            appUserId,
          });
        });

      const signOut = () =>
        Effect.gen(function* signOut() {
          const currentAppUserId = yield* getAppUserId();
          yield* customerAttributeManager.syncCustomerAttributes(
            currentAppUserId
          );
          yield* cacheManager.clear();
          eventBus.emit("customer-signed-out");
        });

      // Helpers
      const generateAnonymousUserId = () =>
        `${ANONYMOUS_USER_ID_PREFIX}${Math.random().toString(36).slice(2, 15)}`;
      const getAppUserIdFromCache = () =>
        cacheManager
          .get<string>(CACHE_KEY)
          .pipe(Effect.map((appUserId) => appUserId?.value ?? null));
      const setAppUserIdInCache = (appUserId: string) =>
        cacheManager.set(CACHE_KEY, appUserId);

      return {
        getAppUserId,
        getAppUserIdFromCache,
        identify,
        signOut,
      } as const;
    }),
  }
) {}
