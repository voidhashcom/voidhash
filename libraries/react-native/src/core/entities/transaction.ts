import type { AppStoreTransactionInfo } from "./app-store";
import type { GooglePlayTransactionInfo } from "./google-play";
import type { PaymentMode, Store } from "./product";
import type { ProductSlug } from "../schema/registry";

/**
 * Where a purchase was made: the stores' `production` and `sandbox`, Xcode's
 * StoreKit testing (`xcode`), or Voidhash's development mode (`development`).
 */
export type Environment = "production" | "sandbox" | "xcode" | "development" | "unknown";

/**
 * The offer a transaction was bought with: an `introductory`, `promotional`,
 * `winBack` or `oneTime` offer, or an offer `code` the end user redeemed.
 */
export type TransactionOfferKind =
  | "introductory"
  | "promotional"
  | "winBack"
  | "oneTime"
  | "code"
  | "unknown";

/** The offer a transaction was bought with. */
export interface TransactionOffer {
  readonly id?: string;
  readonly kind?: TransactionOfferKind;
  readonly paymentMode?: PaymentMode;
}

/**
 * A purchase as the store completed it on this device. Access never comes
 * from a transaction: check the person's entitlements.
 */
export interface Transaction {
  /**
   * The store's id: the App Store transaction id, or the Google Play purchase
   * token. The same while a purchase goes from pending to purchased.
   */
  readonly id: string;
  /** The App Store original transaction id; absent on Google Play. */
  readonly originalId?: string;
  /** The slug of the product bought; absent when the project does not know the store product. */
  readonly productSlug?: ProductSlug;
  readonly storeProductId: string;
  readonly store: Store;
  /** When it was bought, in milliseconds since the epoch. */
  readonly purchasedAt: number;
  /** When a subscription period it paid for ends, in milliseconds since the epoch. */
  readonly expiresAt?: number;
  /** How many were bought; what the store charged for. */
  readonly quantity: number;
  /** Whether it renews a subscription; absent where the store does not say (Google Play). */
  readonly isRenewal?: boolean;
  readonly offer?: TransactionOffer;
  readonly environment: Environment;
  /** The App Store's own view of the transaction; present when `store` is `appStore`. */
  readonly appStore?: AppStoreTransactionInfo;
  /** Google Play's own view of the purchase; present when `store` is `googlePlay`. */
  readonly googlePlay?: GooglePlayTransactionInfo;
}

/**
 * A purchase that completed outside `purchase()`: an approved Ask to Buy, a
 * pending Google Play payment that went through, a renewal seen on the
 * device, a redeemed offer code or a promoted purchase. Reported once the SDK
 * handled it: Voidhash accepted it (`synced`) or its receipt waits on the
 * device to be sent. It tells the UI something happened; access always comes
 * from the person's entitlements.
 */
export interface TransactionUpdate {
  readonly transaction: Transaction;
  readonly synced: boolean;
}
