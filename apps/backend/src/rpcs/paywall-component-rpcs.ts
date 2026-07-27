import { PaywallDeployService } from "@voidhash/core/services";
import {
  PaywallComponentRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallDeployServiceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

export const PaywallComponentRpcsLive = PaywallComponentRpcsDef.toLayer(
  Effect.gen(function* () {
    const deployService = yield* PaywallDeployService;

    return {
      GetPaywallComponentVersions: ({ projectId, refs }) =>
        deployService.getComponentVersions({ projectId, refs }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallDeployServiceError: (error) =>
              Effect.fail(new RpcPaywallDeployServiceError({ cause: error.cause })),
          }),
        ),
      ListPaywallComponents: ({ projectId }) =>
        deployService.listComponents({ projectId }).pipe(
          Effect.catchTags({
            ActionForbiddenError: (error) =>
              Effect.fail(new RpcActionForbiddenError({ message: error.message })),
            PaywallDeployServiceError: (error) =>
              Effect.fail(new RpcPaywallDeployServiceError({ cause: error.cause })),
          }),
        ),
    };
  }),
);
