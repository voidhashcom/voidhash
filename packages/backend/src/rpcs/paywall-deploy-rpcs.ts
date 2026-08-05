import { PaywallDeployService } from "@voidhash/core/services";
import {
  PaywallDeployRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallDeployServiceError,
  RpcPaywallDeployValidationError,
  RpcReleaseNotFoundError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const PaywallDeployRpcsLive = PaywallDeployRpcsDef.toLayer(
  Effect.gen(function* () {
    const deployService = yield* PaywallDeployService;

    return {
      ListPaywallDeploys: ({ projectId }) =>
        deployService.listDeploys({ projectId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallDeployServiceError: (error) =>
              Effect.fail(new RpcPaywallDeployServiceError({ cause: error.cause })),
          }),
        ),
      SetActivePaywallRelease: ({ releaseId }) =>
        deployService.setActivePaywallRelease({ releaseId }).pipe(
          Effect.map((result) => ({ releaseId: result.id })),
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            AuditLogPortError: (error) =>
              Effect.fail(new RpcPaywallDeployServiceError({ cause: error.cause })),
            PaywallDeployServiceError: (error) =>
              Effect.fail(new RpcPaywallDeployServiceError({ cause: error.cause })),
            PaywallDeployValidationError: (error) =>
              Effect.fail(
                new RpcPaywallDeployValidationError({
                  message: error.message,
                  violations: error.violations,
                }),
              ),
            PaywallReleaseNotFoundError: () =>
              Effect.fail(new RpcReleaseNotFoundError({ releaseId })),
          }),
        ),
    };
  }),
);
