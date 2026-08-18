import type { ActionForbiddenError } from "@voidhash/core/domain/auth/Auth";
import {
  DevelopmentPaymentProviderService,
  type DevelopmentPaymentProviderServiceError,
} from "@voidhash/core/services";
import {
  DevelopmentModeRpcsDef,
  RpcActionForbiddenError,
  RpcDevelopmentModeServiceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

const mapErrors = <A, R>(
  effect: Effect.Effect<A, ActionForbiddenError | DevelopmentPaymentProviderServiceError, R>,
) =>
  effect.pipe(
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
      GetDevelopmentModeState: (input) => mapErrors(service.getDevelopmentState(input)),
      GetDevelopmentModeSettings: ({ projectId }) =>
        mapErrors(service.getDevelopmentSettings(projectId)),
      ResetDevelopmentData: ({ projectId }) => mapErrors(service.resetDevelopmentData(projectId)),
      SetDevelopmentPurchasesEnabled: (input) =>
        mapErrors(service.setDevelopmentPurchasesEnabled(input)),
    };
  }),
);
