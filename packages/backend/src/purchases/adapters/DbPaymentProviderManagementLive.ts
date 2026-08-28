import {
  PaymentProviderConfiguration,
  PaymentProviderConfigurationOperations,
  PaymentProviderConfigurationService,
  PaymentProviderConfigurationServiceError,
  PaymentProviderConfigurations,
  PaymentProviderProduct,
  PaymentProviderProductOperations,
  PaymentProviderProductService,
  PaymentProviderProductServiceError,
  PaymentProviderProducts,
  ProjectPaymentProviderProducts,
} from "@voidhash/core-v2";
import { PaymentProviderConfigurationService as DbPaymentProviderConfigurationService } from "./DbPaymentProviderConfigurationService.ts";
import { PaymentProviderProductService as DbPaymentProviderProductService } from "./DbPaymentProviderProductService.ts";
import { Effect, Layer, Schema } from "effect";

const Created = Schema.Struct({ id: Schema.NonEmptyString });

const decodeConfiguration = <A, E, R, S extends Schema.Top>(
  effect: Effect.Effect<A, E, R>,
  schema: S,
) =>
  effect.pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError(
          (error) => new PaymentProviderConfigurationServiceError({ cause: String(error) }),
        ),
      ),
    ),
  );

const decodeProduct = <A, E, R, S extends Schema.Top>(effect: Effect.Effect<A, E, R>, schema: S) =>
  effect.pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError(
          (error) => new PaymentProviderProductServiceError({ cause: String(error) }),
        ),
      ),
    ),
  );

const DbPaymentProviderConfigurationOperationsLive = Layer.effect(
  PaymentProviderConfigurationOperations,
  Effect.gen(function* () {
    const service = yield* DbPaymentProviderConfigurationService;
    return PaymentProviderConfigurationOperations.of({
      createPaymentProviderConfiguration: (input) =>
        decodeConfiguration(service.createPaymentProviderConfiguration(input), Created),
      deletePaymentProviderConfiguration: service.deletePaymentProviderConfiguration,
      getPaymentProviderConfigurationById: (id) =>
        decodeConfiguration(
          service.getPaymentProviderConfigurationById(id),
          PaymentProviderConfiguration,
        ),
      getPaymentProviderConfigurations: (projectId) =>
        decodeConfiguration(
          service.getPaymentProviderConfigurations(projectId),
          PaymentProviderConfigurations,
        ),
      updatePaymentProviderConfiguration: (input) =>
        decodeConfiguration(service.updatePaymentProviderConfiguration(input), Created),
    });
  }),
);

const DbPaymentProviderProductOperationsLive = Layer.effect(
  PaymentProviderProductOperations,
  Effect.gen(function* () {
    const service = yield* DbPaymentProviderProductService;
    return PaymentProviderProductOperations.of({
      createPaymentProviderProduct: (input) =>
        decodeProduct(service.createPaymentProviderProduct(input), Created),
      deletePaymentProviderProduct: service.deletePaymentProviderProduct,
      getProviderProductById: (id) =>
        decodeProduct(service.getProviderProductById(id), PaymentProviderProduct),
      getProviderProductsByProductId: (productId) =>
        decodeProduct(service.getProviderProductsByProductId(productId), PaymentProviderProducts),
      getProviderProductsByProjectId: (projectId) =>
        decodeProduct(
          service.getProviderProductsByProjectId(projectId),
          ProjectPaymentProviderProducts,
        ),
      setActivePaymentProviderProduct: service.setActivePaymentProviderProduct,
      updatePaymentProviderProduct: service.updatePaymentProviderProduct,
    });
  }),
);

export const PaymentProviderConfigurationLive = PaymentProviderConfigurationService.layer.pipe(
  Layer.provide(
    DbPaymentProviderConfigurationOperationsLive.pipe(
      Layer.provide(DbPaymentProviderConfigurationService.layer),
    ),
  ),
);

export const PaymentProviderProductLive = PaymentProviderProductService.layer.pipe(
  Layer.provide(
    DbPaymentProviderProductOperationsLive.pipe(
      Layer.provide(DbPaymentProviderProductService.layer),
    ),
  ),
);

export const PaymentProviderManagementLive = Layer.merge(
  PaymentProviderConfigurationLive,
  PaymentProviderProductLive,
);
