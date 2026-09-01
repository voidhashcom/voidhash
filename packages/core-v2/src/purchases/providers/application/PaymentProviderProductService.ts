import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import {
  PaymentProviderProductOperations,
  type PaymentProviderProductOperationsShape,
} from "../../application/ports/PaymentProviderManagementOperations.ts";
import { PaymentProviderProductServiceError } from "../../domain/ProviderProduct.ts";

const Id = Schema.NonEmptyString;
const Configuration = Schema.Record(Schema.String, Schema.Unknown);
const CreateInput = Schema.Struct({
  configuration: Configuration,
  paymentProviderConfigurationId: Id,
  productId: Id,
});
const UpdateInput = Schema.Struct({ configuration: Configuration, id: Id });
const ActivateInput = Schema.Struct({
  paymentProviderConfigurationId: Id,
  productId: Id,
  providerProductKey: Id,
});
const DeleteInput = Schema.Struct({ id: Id });

export type PaymentProviderProductServiceShape = PaymentProviderProductOperationsShape;

const makePaymentProviderProductService = Effect.fn("makePaymentProviderProductService")(
  function* () {
  const operations = yield* PaymentProviderProductOperations;
  const invalid = (error: unknown) =>
    new PaymentProviderProductServiceError({ cause: String(error) });

  return {
    createPaymentProviderProduct: (input) =>
      Schema.decodeUnknownEffect(CreateInput)(input).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.createPaymentProviderProduct),
      ),
    deletePaymentProviderProduct: (input) =>
      Schema.decodeUnknownEffect(DeleteInput)(input).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.deletePaymentProviderProduct),
      ),
    getProviderProductById: (id) =>
      Schema.decodeUnknownEffect(Id)(id).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.getProviderProductById),
      ),
    getProviderProductsByProductId: (productId) =>
      Schema.decodeUnknownEffect(Id)(productId).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.getProviderProductsByProductId),
      ),
    getProviderProductsByProjectId: (projectId) =>
      Schema.decodeUnknownEffect(Id)(projectId).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.getProviderProductsByProjectId),
      ),
    setActivePaymentProviderProduct: (input) =>
      Schema.decodeUnknownEffect(ActivateInput)(input).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.setActivePaymentProviderProduct),
      ),
    updatePaymentProviderProduct: (input) =>
      Schema.decodeUnknownEffect(UpdateInput)(input).pipe(
        Effect.mapError(invalid),
        Effect.flatMap(operations.updatePaymentProviderProduct),
      ),
  } satisfies PaymentProviderProductServiceShape;
  },
)();

export class PaymentProviderProductService extends Context.Service<
  PaymentProviderProductService,
  PaymentProviderProductServiceShape
>()("@voidhash/core-v2/purchases/PaymentProviderProductService", {
  make: makePaymentProviderProductService,
}) {
  static readonly layer = Layer.effect(PaymentProviderProductService)(
    PaymentProviderProductService.make,
  );
}
