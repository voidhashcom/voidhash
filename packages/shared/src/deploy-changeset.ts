import * as Schema from "effect/Schema";

// ChangesetDeploymentServiceError has been moved to:
// - @voidhash/generated-clients (API layer)
// - @voidhash/core/domain/errors (domain layer)

// Paywall Locations
export const PaywallLocationCreateChange = Schema.Struct({
  changeType: Schema.Literal("create-paywall-location"),
  key: Schema.String,
  payload: Schema.Struct({
    description: Schema.optional(Schema.NullOr(Schema.String)),
    name: Schema.String,
    slug: Schema.String,
  }),
});
export type PaywallLocationCreateChange = typeof PaywallLocationCreateChange.Type;

export const PaywallLocationUpdateChange = Schema.Struct({
  changeType: Schema.Literal("update-paywall-location"),
  key: Schema.String,
  payload: Schema.Struct({
    description: Schema.optional(Schema.NullOr(Schema.String)),
    name: Schema.String,
    slug: Schema.String,
  }),
});
export type PaywallLocationUpdateChange = typeof PaywallLocationUpdateChange.Type;

export const PaywallLocationArchiveChange = Schema.Struct({
  changeType: Schema.Literal("archive-paywall-location"),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
  }),
});
export type PaywallLocationArchiveChange = typeof PaywallLocationArchiveChange.Type;

// Perks
export const PerkCreateChange = Schema.Struct({
  changeType: Schema.Literal("create-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});
export type PerkCreateChange = typeof PerkCreateChange.Type;

export const PerkUpdateChange = Schema.Struct({
  changeType: Schema.Literal("update-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});
export type PerkUpdateChange = typeof PerkUpdateChange.Type;

export const PerkDeleteChange = Schema.Struct({
  changeType: Schema.Literal("delete-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
  }),
});
export type PerkDeleteChange = typeof PerkDeleteChange.Type;

// Products
export const ProductCreateChange = Schema.Struct({
  changeType: Schema.Literal("create-product"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});
export type ProductCreateChange = typeof ProductCreateChange.Type;

export const ProductUpdateChange = Schema.Struct({
  changeType: Schema.Literal("update-product"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});
export type ProductUpdateChange = typeof ProductUpdateChange.Type;

export const ProductDeleteChange = Schema.Struct({
  changeType: Schema.Literal("delete-product"),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
  }),
});
export type ProductDeleteChange = typeof ProductDeleteChange.Type;

// Product Perks
export const ProductPerkCreateChange = Schema.Struct({
  changeType: Schema.Literal("create-product-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    perkSlug: Schema.String,
    productSlug: Schema.String,
  }),
});
export type ProductPerkCreateChange = typeof ProductPerkCreateChange.Type;

export const ProductPerkDeleteChange = Schema.Struct({
  changeType: Schema.Literal("delete-product-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    perkSlug: Schema.String,
    productSlug: Schema.String,
  }),
});
export type ProductPerkDeleteChange = typeof ProductPerkDeleteChange.Type;

// Payment Provider Products
export const PaymentProviderProductCreateChange = Schema.Struct({
  changeType: Schema.Literal("create-payment-provider-product"),
  key: Schema.String,
  payload: Schema.Struct({
    configuration: Schema.Record(Schema.String, Schema.Unknown),
    productSlug: Schema.String,
    providerId: Schema.String,
  }),
});
export type PaymentProviderProductCreateChange = typeof PaymentProviderProductCreateChange.Type;

export const PaymentProviderProductUpdateChange = Schema.Struct({
  changeType: Schema.Literal("update-payment-provider-product"),
  key: Schema.String,
  payload: Schema.Struct({
    configuration: Schema.Record(Schema.String, Schema.Unknown),
    productSlug: Schema.String,
    providerId: Schema.String,
  }),
});
export type PaymentProviderProductUpdateChange = typeof PaymentProviderProductUpdateChange.Type;

export const PaymentProviderProductDeleteChange = Schema.Struct({
  changeType: Schema.Literal("delete-payment-provider-product"),
  key: Schema.String,
  payload: Schema.Struct({
    productSlug: Schema.String,
    providerId: Schema.String,
  }),
});
export type PaymentProviderProductDeleteChange = typeof PaymentProviderProductDeleteChange.Type;

export const Change = Schema.Union([
  PaywallLocationCreateChange,
  PaywallLocationUpdateChange,
  PaywallLocationArchiveChange,
  PerkCreateChange,
  PerkUpdateChange,
  PerkDeleteChange,
  ProductCreateChange,
  ProductUpdateChange,
  ProductDeleteChange,
  ProductPerkCreateChange,
  ProductPerkDeleteChange,
  PaymentProviderProductCreateChange,
  PaymentProviderProductUpdateChange,
  PaymentProviderProductDeleteChange,
]);
export type Change = typeof Change.Type;

export const Changeset = Schema.Struct({
  changes: Schema.Array(Change),
});
export type Changeset = typeof Changeset.Type;

export function sortChangeset(changeset: typeof Changeset.Type) {
  const sortedChangeTypesByPriority: (typeof Change.Type.changeType)[] = [
    "create-paywall-location",
    "create-perk",
    "create-product",
    "update-paywall-location",
    "update-perk",
    "update-product",
    "create-product-perk",
    "create-payment-provider-product",
    "update-payment-provider-product",
    "archive-paywall-location",
    "delete-product-perk",
    "delete-payment-provider-product",
    "delete-product",
    "delete-perk",
  ];

  const sortedChangeset = Arr.sort(
    changeset.changes,
    Order.mapInput(Order.Number, (change: (typeof Changeset.Type.changes)[number]) =>
      sortedChangeTypesByPriority.indexOf(change.changeType),
    ),
  );

  return sortedChangeset;
}

export { PaywallLocationCreateChange as PaywallLocationCreateChangeSchema };
export { PaywallLocationUpdateChange as PaywallLocationUpdateChangeSchema };
export { PaywallLocationArchiveChange as PaywallLocationArchiveChangeSchema };
export { PerkCreateChange as PerkCreateChangeSchema };
export { PerkUpdateChange as PerkUpdateChangeSchema };
export { PerkDeleteChange as PerkDeleteChangeSchema };
export { ProductCreateChange as ProductCreateChangeSchema };
export { ProductUpdateChange as ProductUpdateChangeSchema };
export { ProductDeleteChange as ProductDeleteChangeSchema };
export { ProductPerkCreateChange as ProductPerkCreateChangeSchema };
export { ProductPerkDeleteChange as ProductPerkDeleteChangeSchema };
export { PaymentProviderProductCreateChange as PaymentProviderProductCreateChangeSchema };
export { PaymentProviderProductUpdateChange as PaymentProviderProductUpdateChangeSchema };
export { PaymentProviderProductDeleteChange as PaymentProviderProductDeleteChangeSchema };
export { Change as ChangeSchema };
export { Changeset as ChangesetSchema };
import * as Arr from "effect/Array";
import * as Order from "effect/Order";
