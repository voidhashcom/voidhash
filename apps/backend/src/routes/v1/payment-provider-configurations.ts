import { PaymentProviderConfiguration, VoidhashV1Api } from "@voidhash/api-contracts";
import {
  ApiActionForbiddenError,
  ApiPaymentProviderConfigurationServiceError,
} from "@voidhash/api-contracts/errors";
import { PaymentProviderConfigurationService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession } from "../../ApiMiddlewares.ts";

export const PaymentProviderConfigurationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "payment_provider_configurations",
  (handlers) =>
    Effect.gen(function* () {
      const service = yield* PaymentProviderConfigurationService;

      return handlers.handle("listPaymentProviderConfigurations", () =>
        bridgeAuthSession(
          Effect.gen(function* () {
            const authSession = yield* AuthSession;
            const projectId = yield* extractAuthorizedProjectId(authSession);
            const configs = yield* service.getPaymentProviderConfigurations(projectId);

            return configs.map(
              (c) =>
                new PaymentProviderConfiguration({
                  enabled: c.enabled,
                  id: c.id,
                  name: c.name,
                  projectId: c.projectId,
                  providerId: c.providerId,
                }),
            );
          }),
        ).pipe(
          Effect.catchTags({
            ActionForbiddenError: (e) =>
              Effect.fail(new ApiActionForbiddenError({ message: e.message })),
            PaymentProviderConfigurationServiceError: (e) =>
              Effect.fail(new ApiPaymentProviderConfigurationServiceError({ cause: e.cause })),
          }),
        ),
      );
    }),
);
