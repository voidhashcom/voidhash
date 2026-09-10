import * as Encoding from "effect/Encoding";
import * as Result from "effect/Result";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import { Transaction } from "./transaction";

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

const identifier = Schema.String.check(Schema.isPattern(/\S/));
const decodeJson = Schema.decodeUnknownSync(Schema.UnknownFromJsonString);
const decodeReport = Schema.decodeUnknownSync(
  Schema.Union([
    Schema.Struct({ platform: Schema.Literal("ios"), transactionId: identifier }),
    Schema.Struct({
      platform: Schema.Literal("android"),
      purchaseToken: identifier,
      purchaseState: Schema.optional(Schema.Literals(["purchased", "pending", "unspecified"])),
    }),
  ]),
);

// Only the ID is extracted; the server fetches and verifies the transaction with Apple.
const fromStoreKitJws = (jws: string): ReportedTransaction => {
  const parts = jws.split(".");
  if (parts.length !== 3 || !parts[1]) throw new TypeError("Expected a StoreKit transaction JWS");
  const payload = Schema.decodeUnknownSync(Schema.Struct({ transactionId: identifier }))(
    Result.match(Encoding.decodeBase64UrlString(parts[1]), {
      onFailure: () => {
        throw new TypeError("Invalid StoreKit transaction encoding");
      },
      onSuccess: decodeJson,
    }),
  );
  return { platform: "ios", transactionId: payload.transactionId };
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

/** Extracts only verification identifiers and leaves store finalization with the host. */
export const fromReportedTransaction = (input: StoreTransaction): Transaction => {
  const report = decodeReport(
    P.isString(input)
      ? fromStoreKitJws(input)
      : input && "originalJson" in input
        ? fromPlayPurchase(input)
        : input,
  );
  const id = report.platform === "ios" ? report.transactionId : report.purchaseToken;
  // The purchase model also serves SDK-owned purchases. These unused defaults never
  // leave the process: host reports are persisted and sent using store identifiers only.
  return new Transaction(id, id, "", 0, 1, false, report.platform, {
    externallyManaged: true,
    purchaseToken: report.platform === "android" ? report.purchaseToken : undefined,
    purchaseState: report.platform === "android" ? report.purchaseState : "purchased",
  });
};
