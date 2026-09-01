import type { ActionForbiddenError } from "@voidhash/core/domain/auth/Auth";
import { RequestEnvironmentMode } from "@voidhash/core-v2";
import {
  DevelopmentPaymentProviderService,
  type DevelopmentPaymentProviderServiceError,
} from "../purchases/providers/development/DevelopmentPaymentProviderService.ts";
import {
  DevelopmentModeRpcsDef,
  RpcActionForbiddenError,
  RpcDevelopmentModeServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";

/**
 * Refuses any request that is not explicitly development traffic — the RPC
 * twin of the fail-closed gate on the `/v1/development/*` HTTP routes.
 * Unannotated requests resolve to the production environment, so a caller
 * must opt in with `x-environment: development` before any simulated
 * purchase can be created, read or wiped.
 */
const requireDevelopmentEnvironment = Effect.fn("requireDevelopmentEnvironment")(function* () {
  const environment = yield* RequestEnvironmentMode;
  if (environment.name !== "development") {
    return yield* Effect.fail(
      new RpcActionForbiddenError({
        message: "This operation requires the 'x-environment: development' header.",
      }),
    );
  }
})();

const mapErrors = <A, R>(
  effect: Effect.Effect<A, ActionForbiddenError | DevelopmentPaymentProviderServiceError, R>,
) =>
  requireDevelopmentEnvironment.pipe(
    Effect.andThen(effect),
    Effect.catchTags({
      ActionForbiddenError: (error) =>
        Effect.fail(new RpcActionForbiddenError({ message: error.message })),
      DevelopmentPaymentProviderServiceError: (error) =>
        Effect.fail(new RpcDevelopmentModeServiceError({ message: error.message })),
    }),
  );

export const DevelopmentModeRpcsLive = DevelopmentModeRpcsDef.toLayer(
  Effect.gen(function* () {
    const service = yield* DevelopmentPaymentProviderService;
    return {
      ApplyDevelopmentLifecycleAction: (input) => mapErrors(service.applyLifecycleAction(input)),
      GetDevelopmentModeState: (input) =>
        mapErrors(service.getDevelopmentState(input)).pipe(
          Effect.map(({ developmentPurchasesEnabled, ...state }) => ({
            ...state,
            isDevelopmentPurchasesEnabled: developmentPurchasesEnabled,
          })),
        ),
      GetDevelopmentModeSettings: ({ projectId }) =>
        mapErrors(service.getDevelopmentSettings(projectId)).pipe(
          Effect.map(({ developmentPurchasesEnabled }) => ({
            isDevelopmentPurchasesEnabled: developmentPurchasesEnabled,
          })),
        ),
      ResetDevelopmentData: ({ projectId }) => mapErrors(service.resetDevelopmentData(projectId)),
      SetDevelopmentPurchasesEnabled: ({ isEnabled, projectId }) =>
        mapErrors(service.setDevelopmentPurchasesEnabled({ enabled: isEnabled, projectId })),
    };
  }),
);
