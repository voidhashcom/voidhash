import { Data } from 'effect';

export class NativeAdapterNotInitializedError extends Data.TaggedError(
  'NativeAdapterNotInitializedError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToInitializeNativeAdapterError extends Data.TaggedError(
  'FailedToInitializeNativeAdapterError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToEndNativeAdapterError extends Data.TaggedError(
  'FailedToEndNativeAdapterError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToGetProductsError extends Data.TaggedError(
  'FailedToGetProductsError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToBuyProductError extends Data.TaggedError(
  'FailedToBuyProductError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class UserCancelledError extends Data.TaggedError('UserCancelledError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class PurchasePendingError extends Data.TaggedError(
  'PurchasePendingError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToAcknowledgePurchaseError extends Data.TaggedError(
  'FailedToAcknowledgePurchaseError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class GetPurchaseHistoryError extends Data.TaggedError(
  'GetPurchaseHistoryError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class GetPendingTransactionsError extends Data.TaggedError(
  'GetPendingTransactionsError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToPresentCodeRedemptionSheetError extends Data.TaggedError(
  'FailedToPresentCodeRedemptionSheetError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class FailedToShowManageSubscriptionsError extends Data.TaggedError(
  'FailedToShowManageSubscriptionsError'
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
