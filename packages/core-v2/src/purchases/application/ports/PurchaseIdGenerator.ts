import { Context } from "effect";

export const PurchaseIdKind = [
  "purchaseLedger",
  "subscription",
  "transaction",
  "purchase",
] satisfies readonly ["purchaseLedger", "subscription", "transaction", "purchase"];
export type PurchaseIdKind = (typeof PurchaseIdKind)[number];

export interface PurchaseIdGeneratorShape {
  readonly generate: (kind: PurchaseIdKind) => string;
}

/** Infrastructure-independent identifier generation for purchase records. */
export class PurchaseIdGenerator extends Context.Service<
  PurchaseIdGenerator,
  PurchaseIdGeneratorShape
>()("@voidhash/core-v2/purchases/PurchaseIdGenerator") {}
