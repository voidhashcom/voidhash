import * as Match from "effect/Match";
import * as Option from "effect/Option";

import type {
  NativeProduct,
  NativePurchaseResult,
  NativeTransaction,
} from "../../specs/VoidhashNativeClient.nitro";
import { decodeAppStoreProduct, decodeAppStoreTransaction } from "../entities/app-store";
import { decodeGooglePlayProduct, decodeGooglePlayTransaction } from "../entities/google-play";
import type { Product } from "../entities/product";
import type { Transaction } from "../entities/transaction";

/*
 * Reads the native SDK's products and transactions into the facade's types.
 * The generic fields arrive as Nitro structs shaped like the facade's own;
 * the `appStore` and `googlePlay` parts arrive as JSON and are decoded here.
 */

/** Receives what the native client sent that breaks its contract; the facade reports it as a diagnostic. */
export type ContractViolation = (message: string) => void;

/** The facade's result of a purchase that went through to the store. */
export type StorePurchaseResult =
  | { readonly status: "purchased"; readonly transaction: Transaction; readonly synced: boolean }
  | { readonly status: "pending" }
  | { readonly status: "cancelled" };

/**
 * A store part sent as JSON, decoded. An unreadable part is left out and
 * reported: the product or transaction is still usable through its generic
 * fields.
 */
const decodePart = <A>(
  // oxlint-disable-next-line effect/prefer-option-over-null -- mirrors the Nitro contract, where an optional is `undefined`.
  json: string | undefined,
  decode: (json: string) => Option.Option<A>,
  onUnreadable: () => void,
): Option.Option<A> =>
  Option.flatMap(Option.fromUndefinedOr(json), (value) => {
    const decoded = decode(value);
    if (Option.isNone(decoded)) onUnreadable();
    return decoded;
  });

/**
 * A product as the facade types it. A `subscription` without its
 * subscription info breaks the contract and is left out (`None`), reported:
 * the types `voidhash-cli types generate` writes promise that a subscription
 * slug is a `SubscriptionProduct` or missing, never another type.
 */
export const toProduct = (
  native: NativeProduct,
  violation: ContractViolation,
): Option.Option<Product> => {
  const appStore = decodePart(native.appStoreJson, decodeAppStoreProduct, () =>
    violation(`The App Store part of product "${native.slug}" could not be read`),
  );
  const googlePlay = decodePart(native.googlePlayJson, decodeGooglePlayProduct, () =>
    violation(`The Google Play part of product "${native.slug}" could not be read`),
  );
  const fields = {
    description: native.description,
    displayName: native.displayName,
    name: native.name,
    offers: native.offers,
    price: native.price,
    productId: native.productId,
    slug: native.slug,
    store: native.store,
    storeProductId: native.storeProductId,
    ...Option.match(appStore, { onNone: () => ({}), onSome: (part) => ({ appStore: part }) }),
    ...Option.match(googlePlay, { onNone: () => ({}), onSome: (part) => ({ googlePlay: part }) }),
  };
  return Match.value(native.type).pipe(
    Match.withReturnType<Option.Option<Product>>(),
    Match.when("subscription", () => {
      if (native.subscription !== undefined) {
        return Option.some({ ...fields, subscription: native.subscription, type: "subscription" });
      }
      violation(
        `Subscription product "${native.slug}" came without its subscription info and is left out`,
      );
      return Option.none();
    }),
    Match.when("consumable", (type) => Option.some({ ...fields, type })),
    Match.when("nonConsumable", (type) => Option.some({ ...fields, type })),
    Match.when("nonRenewingSubscription", (type) => Option.some({ ...fields, type })),
    Match.when("unknown", () =>
      Option.some(
        native.subscription === undefined
          ? { ...fields, type: "unknown" }
          : { ...fields, subscription: native.subscription, type: "unknown" },
      ),
    ),
    Match.exhaustive,
  );
};

/** A transaction as the facade types it. */
export const toTransaction = (
  native: NativeTransaction,
  violation: ContractViolation,
): Transaction => {
  const appStore = decodePart(native.appStoreJson, decodeAppStoreTransaction, () =>
    violation(`The App Store part of transaction ${native.id} could not be read`),
  );
  const googlePlay = decodePart(native.googlePlayJson, decodeGooglePlayTransaction, () =>
    violation(`The Google Play part of transaction ${native.id} could not be read`),
  );
  return {
    environment: native.environment,
    id: native.id,
    purchasedAt: native.purchasedAt,
    quantity: native.quantity,
    store: native.store,
    storeProductId: native.storeProductId,
    ...(native.originalId === undefined ? {} : { originalId: native.originalId }),
    ...(native.productSlug === undefined ? {} : { productSlug: native.productSlug }),
    ...(native.expiresAt === undefined ? {} : { expiresAt: native.expiresAt }),
    ...(native.isRenewal === undefined ? {} : { isRenewal: native.isRenewal }),
    ...(native.offer === undefined ? {} : { offer: native.offer }),
    ...Option.match(appStore, { onNone: () => ({}), onSome: (part) => ({ appStore: part }) }),
    ...Option.match(googlePlay, { onNone: () => ({}), onSome: (part) => ({ googlePlay: part }) }),
  };
};

/**
 * A purchase result as the facade types it. A `purchased` result without its
 * transaction breaks the contract and reads as `None`.
 */
export const toPurchaseResult = (
  native: NativePurchaseResult,
  violation: ContractViolation,
): Option.Option<StorePurchaseResult> =>
  Match.value(native.outcome).pipe(
    Match.withReturnType<Option.Option<StorePurchaseResult>>(),
    Match.when("purchased", () =>
      Option.map(Option.fromUndefinedOr(native.transaction), (transaction) => ({
        status: "purchased" as const,
        synced: native.synced ?? false,
        transaction: toTransaction(transaction, violation),
      })),
    ),
    Match.when("pending", () => Option.some({ status: "pending" as const })),
    Match.when("cancelled", () => Option.some({ status: "cancelled" as const })),
    Match.exhaustive,
  );
