export type NativeAdapterNotInitializedError = {
  code: 'NATIVE_ADAPTER_NOT_INITIALIZED';
  message: 'Native adapter not initialized';
};

export type FailedToInitializeNativeAdapterError = {
  code: 'FAILED_TO_INITIALIZE_NATIVE_ADAPTER';
  message: 'Failed to initialize native adapter';
  cause?: Error;
};

export type FailedToEndNativeAdapterError = {
  code: 'FAILED_TO_END_NATIVE_ADAPTER';
  message: 'Failed to end native adapter';
  cause?: Error;
};

export type FailedToGetProductsError = {
  code: 'FAILED_TO_GET_PRODUCTS';
  message: 'Failed to get products';
  cause?: Error;
};

export type FailedToBuyProductError = {
  code: 'FAILED_TO_BUY_PRODUCT';
  message: 'Failed to buy product';
  cause?: Error;
};

export type ProductNotFoundError = {
  code: 'PRODUCT_NOT_FOUND';
  message: 'Product not found';
  cause?: Error;
};

export type UserCancelledError = {
  code: 'USER_CANCELLED';
  message: 'User cancelled';
  cause?: Error;
};

export type PurchasePendingError = {
  code: 'PURCHASE_PENDING';
  message: 'Purchase pending';
  cause?: Error;
};

export type FailedToAcknowledgePurchaseError = {
  code: 'FAILED_TO_ACKNOWLEDGE_PURCHASE';
  message: 'Failed to acknowledge purchase';
  cause?: Error;
};

export type GetPurchaseHistoryError = {
  code: 'GET_PURCHASE_HISTORY_ERROR';
  message: 'Failed to get purchase history';
  cause?: Error;
};

export type GetPendingTransactionsError = {
  code: 'GET_PENDING_TRANSACTIONS_ERROR';
  message: 'Failed to get pending transactions';
  cause?: Error;
};

export type FailedToPresentCodeRedemptionSheetError = {
  code: 'FAILED_TO_PRESENT_CODE_REDEMPTION_SHEET';
  message: 'Failed to present code redemption sheet';
  cause?: Error;
};

export type FailedToShowManageSubscriptionsError = {
  code: 'FAILED_TO_SHOW_MANAGE_SUBSCRIPTIONS';
  message: 'Failed to show manage subscriptions';
  cause?: Error;
};
