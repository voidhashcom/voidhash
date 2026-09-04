import * as P from "effect/Predicate";

export class Transaction {
  readonly id: string;
  readonly transactionId: string;
  readonly productId: string;
  readonly purchaseDate: number;
  readonly quantity: number;
  readonly isAcknowledged: boolean;
  readonly platform: "ios" | "android";
  readonly originalTransactionId?: string;
  readonly originalPurchaseDate?: number;
  readonly expirationDate?: number;
  readonly isAutoRenewing?: boolean;
  readonly purchaseToken?: string; // Android specific
  readonly receipt?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly appAccountToken?: string;
  readonly purchaseState: "purchased" | "pending" | "unspecified";
  readonly store: "app-store" | "google-play" | "development";

  constructor(
    id: string,
    transactionId: string,
    productId: string,
    purchaseDate: number,
    quantity: number,
    isAcknowledged: boolean,
    platform: "ios" | "android",
    options?: {
      originalTransactionId?: string;
      originalPurchaseDate?: number;
      expirationDate?: number;
      isAutoRenewing?: boolean;
      purchaseToken?: string;
      receipt?: string;
      price?: number;
      currency?: string;
      appAccountToken?: string;
      purchaseState?: "purchased" | "pending" | "unspecified";
      store?: "app-store" | "google-play" | "development";
    },
  ) {
    this.id = id;
    this.transactionId = transactionId;
    this.productId = productId;
    this.purchaseDate = purchaseDate;
    this.quantity = quantity;
    this.isAcknowledged = isAcknowledged;
    this.platform = platform;
    this.originalTransactionId = options?.originalTransactionId;
    this.originalPurchaseDate = options?.originalPurchaseDate;
    this.expirationDate = options?.expirationDate;
    this.isAutoRenewing = options?.isAutoRenewing;
    this.purchaseToken = options?.purchaseToken;
    this.receipt = options?.receipt;
    this.price = options?.price;
    this.currency = options?.currency;
    this.appAccountToken = options?.appAccountToken;
    this.purchaseState = options?.purchaseState ?? "purchased";
    this.store = options?.store ?? (platform === "ios" ? "app-store" : "google-play");
  }
}

/** Plain-object form of a {@link Transaction}, as persisted in the outbox. */
export type TransactionRecord = Record<string, unknown>;

/** Flattens a transaction for storage. */
export const toTransactionRecord = (transaction: Transaction): TransactionRecord => ({
  appAccountToken: transaction.appAccountToken,
  currency: transaction.currency,
  expirationDate: transaction.expirationDate,
  id: transaction.id,
  isAcknowledged: transaction.isAcknowledged,
  isAutoRenewing: transaction.isAutoRenewing,
  originalPurchaseDate: transaction.originalPurchaseDate,
  originalTransactionId: transaction.originalTransactionId,
  platform: transaction.platform,
  price: transaction.price,
  productId: transaction.productId,
  purchaseDate: transaction.purchaseDate,
  purchaseState: transaction.purchaseState,
  purchaseToken: transaction.purchaseToken,
  quantity: transaction.quantity,
  receipt: transaction.receipt,
  store: transaction.store,
  transactionId: transaction.transactionId,
});

// oxlint-disable-next-line effect/prefer-option-over-null -- reading an optional field out of an untyped storage record; `undefined` is what the record itself carries.
const optionalString = (value: unknown): string | undefined =>
  P.isString(value) ? value : undefined;

// oxlint-disable-next-line effect/prefer-option-over-null -- reading an optional field out of an untyped storage record; `undefined` is what the record itself carries.
const optionalNumber = (value: unknown): number | undefined =>
  P.isNumber(value) ? value : undefined;

// oxlint-disable-next-line effect/prefer-option-over-null -- reading an optional field out of an untyped storage record; `undefined` is what the record itself carries.
const optionalBoolean = (value: unknown): boolean | undefined =>
  P.isBoolean(value) ? value : undefined;

/**
 * Rebuilds a transaction from its persisted form. Returns `undefined` when the
 * record is missing the fields the sync payload requires, so a corrupt entry
 * is skipped rather than sent as a malformed receipt.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- internal storage decoder kept `undefined`-shaped to match the plain records it reads.
export const fromTransactionRecord = (record: TransactionRecord): Transaction | undefined => {
  const { id, transactionId, productId, purchaseDate, quantity, isAcknowledged, platform } = record;
  if (
    !P.isString(id) ||
    !P.isString(transactionId) ||
    !P.isString(productId) ||
    !P.isNumber(purchaseDate) ||
    !P.isNumber(quantity) ||
    !P.isBoolean(isAcknowledged) ||
    (platform !== "ios" && platform !== "android")
  ) {
    return undefined;
  }

  const purchaseState = record.purchaseState;
  const store = record.store;
  return new Transaction(
    id,
    transactionId,
    productId,
    purchaseDate,
    quantity,
    isAcknowledged,
    platform,
    {
      appAccountToken: optionalString(record.appAccountToken),
      currency: optionalString(record.currency),
      expirationDate: optionalNumber(record.expirationDate),
      isAutoRenewing: optionalBoolean(record.isAutoRenewing),
      originalPurchaseDate: optionalNumber(record.originalPurchaseDate),
      originalTransactionId: optionalString(record.originalTransactionId),
      price: optionalNumber(record.price),
      purchaseState:
        purchaseState === "purchased" ||
        purchaseState === "pending" ||
        purchaseState === "unspecified"
          ? purchaseState
          : undefined,
      purchaseToken: optionalString(record.purchaseToken),
      receipt: optionalString(record.receipt),
      store:
        store === "app-store" || store === "google-play" || store === "development"
          ? store
          : undefined,
    },
  );
};
