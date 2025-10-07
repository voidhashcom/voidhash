import { HttpApiSchema } from '@effect/platform';
import { Schema } from 'effect';

export const PublishableKeyAuthHeaders = Schema.Struct({
  'x-publishable-key': Schema.String,
  'x-app-user-id': Schema.String
});

export const ApiKeyAuthHeaders = Schema.Struct({
  'x-api-key': Schema.String
});

export const SecretKeyAuthHeaders = Schema.Struct({
  'x-secret-key': Schema.String
});

// ========================================================
// Auth
// ========================================================

const SessionAuthMethods = Schema.Union(
  Schema.Literal('api-key'),
  Schema.Literal('publishable-key'),
  Schema.Literal('secret-key')
);

export const Session = Schema.Struct({
  method: SessionAuthMethods,
  name: Schema.String,
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      slug: Schema.String,
      name: Schema.String
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      slug: Schema.String,
      name: Schema.String,
      organizationId: Schema.String
    })
  )
});

// ========================================================
// API Keys
// ========================================================

export class ApiKey extends Schema.Class<ApiKey>('ApiKey')({
  id: Schema.String,
  name: Schema.String,
  end: Schema.String,
  prefix: Schema.String,
  isPublic: Schema.Boolean,
  projectId: Schema.String
}) {}

export class ApiKeyWithRawKey extends Schema.Class<ApiKeyWithRawKey>(
  'ApiKeyWithRawKey'
)({
  id: Schema.String,
  name: Schema.String,
  end: Schema.String,
  prefix: Schema.String,
  isPublic: Schema.Boolean,
  projectId: Schema.String,
  rawKey: Schema.String
}) {}

export class CreateSecretKeyBody extends Schema.Class<CreateSecretKeyBody>(
  'CreateSecretKeyBody'
)({
  projectId: Schema.String,
  name: Schema.String
}) {}

export const ApiKeyIdParam = HttpApiSchema.param('apiKeyId', Schema.String);

// ========================================================
// Customers
// ========================================================

export class Customer extends Schema.Class<Customer>('Customer')({
  id: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  appUserId: Schema.String
}) {}

export class CreateCustomerBody extends Schema.Class<CreateCustomerBody>(
  'CreateCustomerBody'
)({
  appUserId: Schema.String,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String)
}) {}

export const CustomerIdParam = HttpApiSchema.param('customerId', Schema.String);

export const AppUserIdParam = HttpApiSchema.param('appUserId', Schema.String);

// ========================================================
// Organizations
// ========================================================

export class CreateOrganizationBody extends Schema.Class<CreateOrganizationBody>(
  'CreateOrganizationBody'
)({
  name: Schema.String
}) {}

export class Organization extends Schema.Class<Organization>('Organization')({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String
}) {}

// ========================================================
// Perks
// ========================================================

export class Perk extends Schema.Class<Perk>('Perk')({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  projectId: Schema.String
}) {}

// ========================================================
// Products
// ========================================================

export const ProductType = Schema.Literal(
  'subscription',
  'one-time',
  'one-time-consumable'
);

export class Product extends Schema.Class<Product>('Product')({
  id: Schema.String,
  type: ProductType,
  name: Schema.String,
  projectId: Schema.String
}) {}

// ========================================================
// Product Perks
// ========================================================

export const ProductIdParam = HttpApiSchema.param('productId', Schema.String);

export class ProductPerk extends Schema.Class<ProductPerk>('ProductPerk')({
  id: Schema.String,
  productId: Schema.String,
  perkId: Schema.String
}) {}

// ========================================================
// Projects
// ========================================================

export class CreateProjectBody extends Schema.Class<CreateProjectBody>(
  'CreateProjectBody'
)({
  name: Schema.String,
  organizationId: Schema.String
}) {}

export class Project extends Schema.Class<Project>('Project')({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String
}) {}

export const OrganizationIdParam = HttpApiSchema.param(
  'organizationId',
  Schema.String
);

// ========================================================
// SDK
// ========================================================

const CommonSdkHeaders = Schema.Struct({
  'x-platform': Schema.String,
  'x-sdk': Schema.Literal('react-native'),
  'x-sdk-version': Schema.String,
  'x-platform-flavor': Schema.Literal('native'),
  'x-platform-flavor-version': Schema.optional(Schema.String),
  'x-platform-version': Schema.optional(Schema.String),
  'x-platform-device': Schema.optional(Schema.String),
  'x-platform-brand': Schema.optional(Schema.String),
  'x-preferred-locales': Schema.optional(Schema.String),
  'x-client-locale': Schema.optional(Schema.String),
  'x-client-version': Schema.optional(Schema.String),
  'x-client-bundle-id': Schema.String,
  'x-observer-mode': Schema.Literal('false'),
  'x-nonce': Schema.optional(Schema.String),
  'x-storefront': Schema.optional(Schema.String),
  'x-is-debug-build': Schema.Literal('true', 'false'),
  'x-is-backgrounded': Schema.Literal('false')
});

export const SdkHeaders = Schema.Struct({
  ...PublishableKeyAuthHeaders.fields,
  ...CommonSdkHeaders.fields
});

// SDK Identify
export class SdkIdentifyBody extends Schema.Class<SdkIdentifyBody>(
  'SdkIdentifyBody'
)({
  appUserId: Schema.String,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String)
}) {}

// SDK Sync Customer Attributes
export class SdkSyncCustomerAttributesBody extends Schema.Class<SdkSyncCustomerAttributesBody>(
  'SdkSyncCustomerAttributesBody'
)({
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String)
}) {}

export class SdkCustomer extends Schema.Class<SdkCustomer>('SdkCustomer')({
  customerId: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  appUserId: Schema.String
}) {}

// ========================================================
// User
// ========================================================

export class User extends Schema.Class<User>('User')({
  name: Schema.String,
  id: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  organizations: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      slug: Schema.String,
      logo: Schema.NullOr(Schema.String)
    })
  ),
  projects: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      logo: Schema.NullOr(Schema.String),
      slug: Schema.String,
      organizationId: Schema.String
    })
  )
}) {}
