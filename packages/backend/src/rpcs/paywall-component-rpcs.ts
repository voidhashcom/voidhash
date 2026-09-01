import { PaywallDeployService } from "@voidhash/core/services";
import {
  PaywallComponentRpcsDef,
  RpcActionForbiddenError,
  RpcPaywallDeployServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

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
          Effect.map((components) =>
            components.map((component) => ({
              ...component,
              title: Option.getOrNull(component.title),
            })),
          ),
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
