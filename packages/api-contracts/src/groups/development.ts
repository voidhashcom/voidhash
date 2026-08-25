import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import {
  ApiDevelopmentEnvironmentRequiredError,
  ApiDevelopmentModeServiceError,
} from "../errors/Development.ts";
import { ApiActionForbiddenError } from "../errors/index.ts";
import { AuthMiddleware } from "../Middlewares.ts";
import {
  DevelopmentLifecycleActionAccepted,
  DevelopmentLifecycleActionBody,
  DevelopmentProjectQuery,
  DevelopmentSettings,
  DevelopmentState,
  DevelopmentStateQuery,
  UpdateDevelopmentSettingsBody,
} from "../schemas/providers.ts";

/**
 * The development sandbox: simulated purchases, subscriptions and grants used
 * to exercise an integration without a real store.
 *
 * Every endpoint requires `x-environment: development` and a secret key or a
 * user credential; a production-scoped request is refused with
 * `Api/DevelopmentEnvironmentRequiredError` so sandbox writes can never touch
 * production entitlements.
 */
export const DevelopmentGroup = HttpApiGroup.make("development")
  .add(
    HttpApiEndpoint.get("getDevelopmentSettings", "/settings", {
      query: DevelopmentProjectQuery,
      success: DevelopmentSettings,
      error: [
        ApiActionForbiddenError,
        ApiDevelopmentEnvironmentRequiredError,
        ApiDevelopmentModeServiceError,
      ],
    }),
  )
  .add(
    // Toggles whether the project accepts development-provider purchases.
    // Last-writer-wins.
    HttpApiEndpoint.patch("updateDevelopmentSettings", "/settings", {
      payload: UpdateDevelopmentSettingsBody,
      success: DevelopmentSettings,
      error: [
        ApiActionForbiddenError,
        ApiDevelopmentEnvironmentRequiredError,
        ApiDevelopmentModeServiceError,
      ],
    }),
  )
  .add(
    // The sandbox entitlements currently held by one person.
    HttpApiEndpoint.get("getDevelopmentState", "/state", {
      query: DevelopmentStateQuery,
      success: DevelopmentState,
      error: [
        ApiActionForbiddenError,
        ApiDevelopmentEnvironmentRequiredError,
        ApiDevelopmentModeServiceError,
      ],
    }),
  )
  .add(
    // Simulates a store lifecycle event (expire / revoke / renew / refund /
    // grace period) against a sandbox purchase or subscription. `actionId` is
    // the idempotency key, so a retried request is not applied twice.
    HttpApiEndpoint.post("applyDevelopmentLifecycleAction", "/lifecycle-actions", {
      payload: DevelopmentLifecycleActionBody,
      success: DevelopmentLifecycleActionAccepted.pipe(HttpApiSchema.status(202)),
      error: [
        ApiActionForbiddenError,
        ApiDevelopmentEnvironmentRequiredError,
        ApiDevelopmentModeServiceError,
      ],
    }),
  )
  .add(
    // Wipes every sandbox purchase, subscription and grant in the project.
    // Production rows are untouched — the environment gate guarantees it.
    HttpApiEndpoint.delete("resetDevelopmentData", "/data", {
      query: DevelopmentProjectQuery,
      error: [
        ApiActionForbiddenError,
        ApiDevelopmentEnvironmentRequiredError,
        ApiDevelopmentModeServiceError,
      ],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/development");
