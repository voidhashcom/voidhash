import { HttpApiSchema } from "@effect/platform";
import { ChangesetSchema } from "@voidhash/shared";
import { Schema } from "effect";

export const PublishableKeyAuthHeaders = Schema.Struct({
  "x-app-user-id": Schema.String,
  "x-publishable-key": Schema.String,
});

export const ApiKeyAuthHeaders = Schema.Struct({
  "x-api-key": Schema.String,
});

export const SecretKeyAuthHeaders = Schema.Struct({
  "x-secret-key": Schema.String,
});

// ========================================================
// Auth
// ========================================================

const SessionAuthMethods = Schema.Union(
  Schema.Literal("api-key"),
  Schema.Literal("publishable-key"),
  Schema.Literal("secret-key")
);

export const Session = Schema.Struct({
  method: SessionAuthMethods,
  name: Schema.String,
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      slug: Schema.String,
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      organizationId: Schema.String,
      slug: Schema.String,
    })
  ),
});

// ========================================================
// API Keys
// ========================================================

export class ApiKey extends Schema.Class<ApiKey>("ApiKey")({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
}) {}

export class ApiKeyWithRawKey extends Schema.Class<ApiKeyWithRawKey>(
  "ApiKeyWithRawKey"
)({
  end: Schema.String,
  id: Schema.String,
  isPublic: Schema.Boolean,
  name: Schema.String,
  prefix: Schema.String,
  projectId: Schema.String,
  rawKey: Schema.String,
}) {}

export class CreateSecretKeyBody extends Schema.Class<CreateSecretKeyBody>(
  "CreateSecretKeyBody"
)({
  name: Schema.String,
  projectId: Schema.String,
}) {}

export const ApiKeyIdParam = HttpApiSchema.param("apiKeyId", Schema.String);

// ========================================================
// Customers
// ========================================================

export class Customer extends Schema.Class<Customer>("Customer")({
  appUserId: Schema.String,
  email: Schema.NullOr(Schema.String),
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
}) {}

export class CreateCustomerBody extends Schema.Class<CreateCustomerBody>(
  "CreateCustomerBody"
)({
  appUserId: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
}) {}

export const CustomerIdParam = HttpApiSchema.param("customerId", Schema.String);

export const AppUserIdParam = HttpApiSchema.param("appUserId", Schema.String);

// ========================================================
// Organizations
// ========================================================

export class CreateOrganizationBody extends Schema.Class<CreateOrganizationBody>(
  "CreateOrganizationBody"
)({
  name: Schema.String,
}) {}

export class Organization extends Schema.Class<Organization>("Organization")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
}) {}

// ========================================================
// Perks
// ========================================================

export class Perk extends Schema.Class<Perk>("Perk")({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
}) {}

// ========================================================
// Products
// ========================================================

export const ProductType = Schema.Literal(
  "subscription",
  "one-time",
  "one-time-consumable"
);

export class Product extends Schema.Class<Product>("Product")({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  slug: Schema.String,
  type: ProductType,
}) {}

// ========================================================
// Product Perks
// ========================================================

export const ProductIdParam = HttpApiSchema.param("productId", Schema.String);

export class ProductPerk extends Schema.Class<ProductPerk>("ProductPerk")({
  id: Schema.String,
  perkId: Schema.String,
  productId: Schema.String,
}) {}

// ========================================================
// Payment Provider Configurations
// ========================================================

export class PaymentProviderConfiguration extends Schema.Class<PaymentProviderConfiguration>(
  "PaymentProviderConfiguration"
)({
  enabled: Schema.Boolean,
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  providerId: Schema.String,
}) {}

// ========================================================
// Payment Provider Products
// ========================================================

export class PaymentProviderProduct extends Schema.Class<PaymentProviderProduct>(
  "PaymentProviderProduct"
)({
  configuration: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  id: Schema.String,
  paymentProviderConfigurationId: Schema.String,
  productId: Schema.String,
  providerId: Schema.String,
}) {}

// ========================================================
// Changesets
// ========================================================

export class DeployChangesetBody extends Schema.Class<DeployChangesetBody>(
  "DeployChangesetBody"
)({
  changeset: ChangesetSchema,
}) {}

export class DeployChangesetResponse extends Schema.Class<DeployChangesetResponse>(
  "DeployChangesetResponse"
)({
  deploymentId: Schema.String,
}) {}

// ========================================================
// Projects
// ========================================================

export class CreateProjectBody extends Schema.Class<CreateProjectBody>(
  "CreateProjectBody"
)({
  name: Schema.String,
  organizationId: Schema.String,
}) {}

export class Project extends Schema.Class<Project>("Project")({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
}) {}

export const OrganizationIdParam = HttpApiSchema.param(
  "organizationId",
  Schema.String
);

// ========================================================
// SDK
// ========================================================

const CommonSdkHeaders = Schema.Struct({
  "x-client-bundle-id": Schema.String,
  "x-client-locale": Schema.optional(Schema.String),
  "x-client-version": Schema.optional(Schema.String),
  "x-is-backgrounded": Schema.Literal("false"),
  "x-is-debug-build": Schema.Literal("true", "false"),
  "x-nonce": Schema.optional(Schema.String),
  "x-observer-mode": Schema.Literal("false"),
  "x-platform": Schema.String,
  "x-platform-brand": Schema.optional(Schema.String),
  "x-platform-device": Schema.optional(Schema.String),
  "x-platform-flavor": Schema.Literal("native"),
  "x-platform-flavor-version": Schema.optional(Schema.String),
  "x-platform-version": Schema.optional(Schema.String),
  "x-preferred-locales": Schema.optional(Schema.String),
  "x-sdk": Schema.Literal("react-native"),
  "x-sdk-version": Schema.String,
  "x-storefront": Schema.optional(Schema.String),
});

export const SdkHeaders = Schema.Struct({
  ...PublishableKeyAuthHeaders.fields,
  ...CommonSdkHeaders.fields,
});

// SDK Identify
export class SdkIdentifyBody extends Schema.Class<SdkIdentifyBody>(
  "SdkIdentifyBody"
)({
  appUserId: Schema.String,
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
}) {}

// SDK Sync Customer Attributes
export class SdkSyncCustomerAttributesBody extends Schema.Class<SdkSyncCustomerAttributesBody>(
  "SdkSyncCustomerAttributesBody"
)({
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
}) {}

export class SdkCustomer extends Schema.Class<SdkCustomer>("SdkCustomer")({
  appUserId: Schema.String,
  customerId: Schema.String,
  email: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
}) {}

// ========================================================
// User
// ========================================================

export class User extends Schema.Class<User>("User")({
  createdAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      slug: Schema.String,
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      logo: Schema.NullOr(Schema.String),
      name: Schema.String,
      organizationId: Schema.String,
      slug: Schema.String,
    })
  ),
  updatedAt: Schema.Date,
}) {}
