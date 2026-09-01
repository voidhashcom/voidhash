import * as Schema from "effect/Schema";

export class NativeAdapterNotInitializedError extends Schema.TaggedErrorClass<NativeAdapterNotInitializedError>()(
  "NativeAdapterNotInitializedError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToInitializeNativeAdapterError extends Schema.TaggedErrorClass<FailedToInitializeNativeAdapterError>()(
  "FailedToInitializeNativeAdapterError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToEndNativeAdapterError extends Schema.TaggedErrorClass<FailedToEndNativeAdapterError>()(
  "FailedToEndNativeAdapterError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToGetProductsError extends Schema.TaggedErrorClass<FailedToGetProductsError>()(
  "FailedToGetProductsError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToBuyProductError extends Schema.TaggedErrorClass<FailedToBuyProductError>()(
  "FailedToBuyProductError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class UserCancelledError extends Schema.TaggedErrorClass<UserCancelledError>()(
  "UserCancelledError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class PurchasePendingError extends Schema.TaggedErrorClass<PurchasePendingError>()(
  "PurchasePendingError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToAcknowledgePurchaseError extends Schema.TaggedErrorClass<FailedToAcknowledgePurchaseError>()(
  "FailedToAcknowledgePurchaseError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class GetPurchaseHistoryError extends Schema.TaggedErrorClass<GetPurchaseHistoryError>()(
  "GetPurchaseHistoryError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class GetPendingTransactionsError extends Schema.TaggedErrorClass<GetPendingTransactionsError>()(
  "GetPendingTransactionsError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToPresentCodeRedemptionSheetError extends Schema.TaggedErrorClass<FailedToPresentCodeRedemptionSheetError>()(
  "FailedToPresentCodeRedemptionSheetError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class FailedToShowManageSubscriptionsError extends Schema.TaggedErrorClass<FailedToShowManageSubscriptionsError>()(
  "FailedToShowManageSubscriptionsError",
  { cause: Schema.optional(Schema.Unknown), message: Schema.String },
) {}

export class ProductNotFoundError extends Schema.TaggedErrorClass<ProductNotFoundError>()(
  "ProductNotFoundError",
  { message: Schema.String },
) {}
