import { Schema } from "effect";

const NullableDate = Schema.NullOr(Schema.Date);

/** Purchase history row exposed by the purchase query application. */
export class Purchase extends Schema.Class<Purchase>("Purchase")({
  createdAt: NullableDate,
  id: Schema.NonEmptyString,
  lastEventOccurredAt: NullableDate,
  paymentProviderConfigurationProductId: Schema.NonEmptyString,
  personId: Schema.NonEmptyString,
  providerEnvironment: Schema.Number,
  providerKey: Schema.NonEmptyString,
  refundedAt: NullableDate,
  refundReason: Schema.NullOr(Schema.String),
  revokedAt: NullableDate,
  revocationReason: Schema.NullOr(Schema.String),
  type: Schema.Number,
  updatedAt: NullableDate,
}) {}

export const PurchaseRows = Schema.Array(Purchase);
