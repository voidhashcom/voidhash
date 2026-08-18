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
