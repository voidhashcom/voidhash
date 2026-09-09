import { Transaction } from "./transaction";

/** Store values captured from the host billing SDK's purchase or restore result. */
export type ReportedTransaction = {
  /** Store transaction/order ID; use the purchase token if Play supplies no order ID. */
  transactionId: string;
  /** Store product identifier, not the Voidhash product slug. */
  productId: string;
  /** Original store purchase timestamp in milliseconds since the Unix epoch. */
  purchaseDate: number;
  /** Purchased quantity; defaults to one. */
  quantity?: number;
  /** Signed store receipt, when exposed by the host SDK. */
  receipt?: string;
  /** Store account token, when present. */
  appAccountToken?: string;
} & (
  | { platform: "ios" }
  | {
      platform: "android";
      /** Google Play purchase token; an order ID alone cannot verify a purchase. */
      purchaseToken: string;
      /** Report again when a pending purchase becomes purchased. */
      purchaseState: "purchased" | "pending" | "unspecified";
    }
);

/** Validates host-supplied store values and pins finalization to the host. */
export const fromReportedTransaction = (report: ReportedTransaction): Transaction => {
  const quantity = report.quantity ?? 1;
  if (
    !report.transactionId?.trim() ||
    !report.productId?.trim() ||
    !Number.isFinite(report.purchaseDate) ||
    report.purchaseDate < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    (report.platform !== "ios" && report.platform !== "android") ||
    (report.platform === "android" &&
      (!report.purchaseToken?.trim() ||
        !["purchased", "pending", "unspecified"].includes(report.purchaseState)))
  ) {
    throw new TypeError(
      "A transaction requires valid store identifiers, purchase date, quantity and Android purchase token/state",
    );
  }
  return new Transaction(
    report.transactionId,
    report.transactionId,
    report.productId,
    report.purchaseDate,
    quantity,
    false,
    report.platform,
    {
      externallyManaged: true,
      receipt: report.receipt,
      appAccountToken: report.appAccountToken,
      purchaseToken: report.platform === "android" ? report.purchaseToken : undefined,
      purchaseState: report.platform === "android" ? report.purchaseState : "purchased",
    },
  );
};
