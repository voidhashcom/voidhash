import { VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiDevelopmentEnvironmentRequiredError,
  ApiDevelopmentModeServiceError,
} from "@voidhash/api-contracts/errors";
import { DevelopmentPaymentProviderService } from "../../purchases/providers/development/DevelopmentPaymentProviderService.ts";
import { RequestEnvironmentMode } from "@voidhash/core-v2";
import { resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import {
  type ApiCredentialMethod,
  bridgeAuthSession,
  requireCredential,
} from "../../ApiMiddlewares.ts";

/** The sandbox mutates entitlements; publishable keys are rejected. */
const MANAGEMENT_CREDENTIALS: ReadonlyArray<ApiCredentialMethod> = ["user", "secret-key"];

/**
 * Refuses any request that is not explicitly development traffic.
 *
 * Unannotated requests resolve to the production environment, so this is
 * fail-closed: a caller must opt in with `x-environment: development` before a
 * single simulated purchase can be created, read or wiped.
 */
const requireDevelopmentEnvironment = Effect.gen(function* () {
  const environment = yield* RequestEnvironmentMode;
  if (environment.name !== "development") {
    return yield* Effect.fail(
      new ApiDevelopmentEnvironmentRequiredError({
        message: "This endpoint requires the 'x-environment: development' header.",
      }),
    );
  }
});

/**
 * Development sandbox routes (`/api/v1/development/*`). Simulated purchases,
 * subscriptions and perk grants for integration testing, backed by
 * {@link DevelopmentPaymentProviderService}. Every handler is gated on the
 * development environment header and on a management credential.
 */
export const DevelopmentGroupLive = HttpApiBuilder.group(VoidhashV1Api, "development", (handlers) =>
  Effect.gen(function* () {
    const service = yield* DevelopmentPaymentProviderService;

    return handlers
      .handle("getDevelopmentSettings", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* requireDevelopmentEnvironment;
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const settings = yield* service.getDevelopmentSettings(projectId);
            return { developmentPurchasesEnabled: settings.developmentPurchasesEnabled };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            DevelopmentPaymentProviderServiceError: (e) =>
              Effect.fail(new ApiDevelopmentModeServiceError({ message: e.message })),
          }),
        ),
      )
      .handle("updateDevelopmentSettings", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* requireDevelopmentEnvironment;
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            yield* service.setDevelopmentPurchasesEnabled({
              enabled: payload.developmentPurchasesEnabled,
              projectId,
            });
            const settings = yield* service.getDevelopmentSettings(projectId);
            return { developmentPurchasesEnabled: settings.developmentPurchasesEnabled };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            DevelopmentPaymentProviderServiceError: (e) =>
              Effect.fail(new ApiDevelopmentModeServiceError({ message: e.message })),
          }),
        ),
      )
      .handle("getDevelopmentState", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* requireDevelopmentEnvironment;
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            const state = yield* service.getDevelopmentState({
              personId: query.personId,
              projectId,
            });
            return {
              developmentPurchasesEnabled: state.developmentPurchasesEnabled,
              grants: state.grants,
              purchases: state.purchases,
              subscriptions: state.subscriptions,
            };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            DevelopmentPaymentProviderServiceError: (e) =>
              Effect.fail(new ApiDevelopmentModeServiceError({ message: e.message })),
          }),
        ),
      )
      .handle("applyDevelopmentLifecycleAction", ({ payload }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* requireDevelopmentEnvironment;
            const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
            yield* service.applyLifecycleAction({
              action: payload.action,
              actionId: payload.actionId,
              projectId,
              targetId: payload.targetId,
              targetType: payload.targetType,
            });
            return { actionId: payload.actionId };
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            DevelopmentPaymentProviderServiceError: (e) =>
              Effect.fail(new ApiDevelopmentModeServiceError({ message: e.message })),
          }),
        ),
      )
      .handle("resetDevelopmentData", ({ query }) =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            yield* requireCredential(authSession, MANAGEMENT_CREDENTIALS);
            yield* requireDevelopmentEnvironment;
            const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
            return yield* service.resetDevelopmentData(projectId);
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            DevelopmentPaymentProviderServiceError: (e) =>
              Effect.fail(new ApiDevelopmentModeServiceError({ message: e.message })),
          }),
        ),
      );
  }),
);
