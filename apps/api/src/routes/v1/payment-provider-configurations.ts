import { HttpApiBuilder } from "@effect/platform";
import { VoidhashV1Api } from "@voidhash/api-spec";
import { PaymentProviderConfigurationService } from "@voidhash/core/services";
import { extractAuthorizedProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/shared";
import { Effect } from "effect";

export const PaymentProviderConfigurationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "payment_provider_configurations",
  (handlers) =>
    Effect.gen(function* PaymentProviderConfigurationsGroupLive() {
      const service = yield* PaymentProviderConfigurationService;

      return handlers.handle("listPaymentProviderConfigurations", () =>
        Effect.gen(function* listPaymentProviderConfigurations() {
          const authSession = yield* AuthSession;
          const projectId = yield* extractAuthorizedProjectId(authSession);
          const configs =
            yield* service.getPaymentProviderConfigurations(projectId);

          // Map to API response format (excluding sensitive configuration field)
          return configs.map((c) => ({
            enabled: c.enabled,
            id: c.id,
            name: c.name,
            projectId: c.projectId,
            providerId: c.providerId,
          }));
        })
      );
    })
);
