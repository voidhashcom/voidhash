/**
 * How the product and perk commands name and describe the catalog: the
 * kinds people name on the command line, the product types and billing
 * periods as the CLI spells them, and the store products mapped to products.
 */
import type {
  BillingPeriod,
  PaymentProviderJsonEncoding,
  PaymentProviderProductMappingJsonEncoding,
  PaymentProviderType,
  PerkJsonEncoding,
  ProductJsonEncoding,
  ProductType,
} from "@voidhash/generated-clients";
import * as Effect from "effect/Effect";

import { ApiClient, readAll } from "../../utils/api-client";
import type { ItemKind } from "../input";

export const productKind: ItemKind<ProductJsonEncoding> = {
  noun: "product",
  label: (product) => `${product.name} (${product.slug})`,
  listCommand: "voidhash-cli product list",
  createCommand: "voidhash-cli product create",
  keys: (product) => [product.slug],
  names: (product) => [product.name],
};

export const perkKind: ItemKind<PerkJsonEncoding> = {
  noun: "perk",
  label: (perk) => `${perk.name} (${perk.slug})`,
  listCommand: "voidhash-cli perk list",
  createCommand: "voidhash-cli perk create",
  keys: (perk) => [perk.slug],
  names: (perk) => [perk.name],
};

/** The product types as `--type` takes them, with their API values. */
export const PRODUCT_TYPES = [
  ["subscription", "subscription"],
  ["one-time", "one_time"],
  ["consumable", "one_time_consumable"],
] as const satisfies ReadonlyArray<readonly [string, ProductType]>;

/** The billing periods as `--period` takes them, with their API values. */
export const BILLING_PERIODS = [
  ["weekly", "weekly"],
  ["monthly", "monthly"],
  ["quarterly", "quarterly"],
  ["semi-annual", "semi_annual"],
  ["annual", "annual"],
] as const satisfies ReadonlyArray<readonly [string, BillingPeriod]>;

/** A slug made from `name`: lowercase letters and digits, words joined by dashes. */
export const slugFrom = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const TYPE_LABELS: Readonly<Record<ProductType, string>> = {
  subscription: "Subscription",
  one_time: "One-time purchase",
  one_time_consumable: "Consumable",
};

const PERIOD_LABELS: Readonly<Record<BillingPeriod, string>> = {
  weekly: "weekly",
  monthly: "monthly",
  quarterly: "quarterly",
  semi_annual: "every 6 months",
  annual: "yearly",
};

/** What a product is, as people say it: "Subscription, monthly". */
export const productTypeLabel = (product: Pick<ProductJsonEncoding, "type" | "billingPeriod">) =>
  product.billingPeriod === null
    ? TYPE_LABELS[product.type]
    : `${TYPE_LABELS[product.type]}, ${PERIOD_LABELS[product.billingPeriod]}`;

const STORE_LABELS: Readonly<Record<PaymentProviderType, string>> = {
  app_store: "App Store",
  google_play: "Google Play",
  stripe: "Stripe",
  payment_source: "Payment source",
};

/** A payment provider as people know it: the store, or a payment source's own name. */
export const storeLabel = (provider: Pick<PaymentProviderJsonEncoding, "type" | "name">) =>
  provider.type === "payment_source" ? provider.name : STORE_LABELS[provider.type];

/** A store product mapped to one of the project's products, with the store it is in. */
export interface StoreProduct {
  readonly provider: PaymentProviderJsonEncoding;
  readonly mapping: PaymentProviderProductMappingJsonEncoding;
}

/**
 * The store products mapped to the project's products, across every payment
 * provider, or only those of `productId`: one listing per provider.
 */
export const listStoreProducts = (projectId: string, productId?: string) =>
  Effect.gen(function* () {
    const api = yield* ApiClient;
    const providers = yield* readAll((query) => api.paymentProvidersList(projectId, query));
    const perProvider = yield* Effect.forEach(
      providers,
      (provider) =>
        readAll((query) =>
          api.paymentProviderProductsList(projectId, provider.id, {
            ...query,
            productId,
          }),
        ).pipe(
          Effect.map((mappings) =>
            mappings.map((mapping): StoreProduct => ({ provider, mapping })),
          ),
        ),
      { concurrency: 4 },
    );
    return { providers, storeProducts: perProvider.flat() };
  });
