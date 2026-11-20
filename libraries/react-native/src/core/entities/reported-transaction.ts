import { Base64Url } from "effect/encoding";
import * as Result from "effect/Result";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";

/** Only the store identifier is required. Legacy metadata is accepted but discarded. */
export type ReportedTransaction = {
  productId?: string;
  purchaseDate?: number;
  quantity?: number;
  receipt?: string;
  appAccountToken?: string;
} & (
  | { platform: "ios"; transactionId: string }
  | {
      platform: "android";
      purchaseToken: string;
      transactionId?: string;
      /** If supplied, pending/unspecified purchases are ignored until reported as purchased. */
      purchaseState?: "purchased" | "pending" | "unspecified";
    }
);

/** Original bridge data accepted as a convenience; only the token and state are read. */
export interface GooglePlayPurchaseData {
  readonly originalJson: string;
  readonly signature?: string;
}

/** Minimal store identifiers, or original store data from which the SDK extracts them. */
export type StoreTransaction = ReportedTransaction | string | GooglePlayPurchaseData;

/** What Voidhash needs of a reported purchase: its store identifier and, on Google Play, its state. */
export type StoreReport =
  | {
      readonly platform: "ios";
      readonly transactionId: string;
      /** The JWS the report was made from, the proof a purchase or restore claim needs. */
      readonly signedTransaction?: string;
    }
  | {
      readonly platform: "android";
      readonly purchaseToken: string;
      readonly purchaseState?: "purchased" | "pending" | "unspecified";
    };

const identifier = Schema.String.check(Schema.isPattern(/\S/));
const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const decodeReport = Schema.decodeUnknownSync(
  Schema.Union([
    Schema.Struct({
      platform: Schema.Literal("ios"),
      transactionId: identifier,
      signedTransaction: Schema.optional(identifier),
    }),
    Schema.Struct({
      platform: Schema.Literal("android"),
      purchaseToken: identifier,
      purchaseState: Schema.optional(Schema.Literals(["purchased", "pending", "unspecified"])),
    }),
  ]),
);

// The server fetches the transaction with Apple by its ID; the JWS goes along as the device's
// proof of a purchase or restore claim, so the native SDK need not look it up in the history.
const fromStoreKitJws = (jws: string): StoreReport => {
  const parts = jws.split(".");
  if (parts.length !== 3 || !parts[1]) throw new TypeError("Expected a StoreKit transaction JWS");
  const payload = Schema.decodeUnknownSync(Schema.Struct({ transactionId: identifier }))(
    Result.match(Base64Url.decodeString(parts[1]), {
      onFailure: () => {
        throw new TypeError("Invalid StoreKit transaction encoding");
      },
      onSuccess: decodeJson,
    }),
  );
  return { platform: "ios", signedTransaction: jws, transactionId: payload.transactionId };
};

const fromPlayPurchase = (input: GooglePlayPurchaseData): ReportedTransaction => {
  const payload = Schema.decodeUnknownSync(
    Schema.Struct({
      token: Schema.optional(identifier),
      purchaseToken: Schema.optional(identifier),
      purchaseState: Schema.optional(Schema.Literals([0, 1, 4])),
      productIds: Schema.optional(Schema.Array(Schema.Unknown)),
    }),
  )(decodeJson(input.originalJson));
  if (payload.productIds && payload.productIds.length > 1) {
    throw new TypeError("Multi-product purchases are not supported");
  }
  const token = payload.token ?? payload.purchaseToken;
  if (!token) throw new TypeError("A Google Play purchase token is required");
  return {
    platform: "android",
    purchaseToken: token,
    purchaseState: payload.purchaseState === 4 ? "pending" : "purchased",
  };
};

/**
 * Extracts only the store identifiers of a purchase another billing
 * integration reported, leaving its finalization with that integration.
 * Throws for input that names no purchase.
 */
export const fromReportedTransaction = (input: StoreTransaction): StoreReport =>
  decodeReport(
    P.isString(input)
      ? fromStoreKitJws(input)
      : input && "originalJson" in input
        ? fromPlayPurchase(input)
        : input,
  );
