import { Schema } from "effect";

// ============================================================================
// Paywall Location Changes
// ============================================================================

export const PaywallLocationCreateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("create-paywall-location"),
  key: Schema.String,
  payload: Schema.Struct({
    description: Schema.optional(Schema.NullOr(Schema.String)),
    name: Schema.String,
    slug: Schema.String,
  }),
});

export const PaywallLocationUpdateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("update-paywall-location"),
  key: Schema.String,
  payload: Schema.Struct({
    description: Schema.optional(Schema.NullOr(Schema.String)),
    name: Schema.String,
    slug: Schema.String,
  }),
});

export const PaywallLocationArchiveChangeSchema = Schema.Struct({
  changeType: Schema.Literal("archive-paywall-location"),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
  }),
});

// ============================================================================
// Perk Changes
// ============================================================================

export const PerkCreateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("create-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});

export const PerkUpdateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("update-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});

export const PerkDeleteChangeSchema = Schema.Struct({
  changeType: Schema.Literal("delete-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
  }),
});

// ============================================================================
// Product Changes
// ============================================================================

export const ProductCreateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("create-product"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});

export const ProductUpdateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("update-product"),
  key: Schema.String,
  payload: Schema.Struct({
    name: Schema.String,
    slug: Schema.String,
  }),
});

export const ProductDeleteChangeSchema = Schema.Struct({
  changeType: Schema.Literal("delete-product"),
  key: Schema.String,
  payload: Schema.Struct({
    slug: Schema.String,
  }),
});

// ============================================================================
// Product Perk Changes
// ============================================================================

export const ProductPerkCreateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("create-product-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    perkSlug: Schema.String,
    productSlug: Schema.String,
  }),
});

export const ProductPerkDeleteChangeSchema = Schema.Struct({
  changeType: Schema.Literal("delete-product-perk"),
  key: Schema.String,
  payload: Schema.Struct({
    perkSlug: Schema.String,
    productSlug: Schema.String,
  }),
});

// ============================================================================
// Payment Provider Product Changes
// ============================================================================

export const PaymentProviderProductCreateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("create-payment-provider-product"),
  key: Schema.String,
  payload: Schema.Struct({
    configuration: Schema.Record(Schema.String, Schema.Unknown),
    productSlug: Schema.String,
    providerId: Schema.String,
  }),
});

export const PaymentProviderProductUpdateChangeSchema = Schema.Struct({
  changeType: Schema.Literal("update-payment-provider-product"),
  key: Schema.String,
  payload: Schema.Struct({
    configuration: Schema.Record(Schema.String, Schema.Unknown),
    productSlug: Schema.String,
    providerId: Schema.String,
  }),
});

export const PaymentProviderProductDeleteChangeSchema = Schema.Struct({
  changeType: Schema.Literal("delete-payment-provider-product"),
  key: Schema.String,
  payload: Schema.Struct({
    productSlug: Schema.String,
    providerId: Schema.String,
  }),
});

// ============================================================================
// Combined Schemas
// ============================================================================

export const ChangeSchema = Schema.Union([
  PaywallLocationCreateChangeSchema,
  PaywallLocationUpdateChangeSchema,
  PaywallLocationArchiveChangeSchema,
  PerkCreateChangeSchema,
  PerkUpdateChangeSchema,
  PerkDeleteChangeSchema,
  ProductCreateChangeSchema,
  ProductUpdateChangeSchema,
  ProductDeleteChangeSchema,
  ProductPerkCreateChangeSchema,
  ProductPerkDeleteChangeSchema,
  PaymentProviderProductCreateChangeSchema,
  PaymentProviderProductUpdateChangeSchema,
  PaymentProviderProductDeleteChangeSchema,
]);

export const ChangesetSchema = Schema.Struct({
  changes: Schema.Array(ChangeSchema),
});

// ============================================================================
// Utility Functions
// ============================================================================

export function sortChangeset(changeset: typeof ChangesetSchema.Type) {
  const sortedChangeTypesByPriority: (typeof ChangeSchema.Type.changeType)[] = [
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

  const sortedChangeset = [...changeset.changes].sort(
    (a, b) =>
      sortedChangeTypesByPriority.indexOf(a.changeType) -
      sortedChangeTypesByPriority.indexOf(b.changeType)
  );

  return sortedChangeset;
}
