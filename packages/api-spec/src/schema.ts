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

export const GetSessionHeaders = Schema.Union(
  ApiKeyAuthHeaders,
  SecretKeyAuthHeaders
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
// Customers
// ========================================================

export const Customer = Schema.Struct({
  customerId: Schema.String,
  name: Schema.NullOr(Schema.String),
  email: Schema.NullOr(Schema.String),
  appUserId: Schema.String
});

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
export const SdkIdentifyBody = Schema.Struct({
  appUserId: Schema.String,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String)
});

// SDK Sync Customer Attributes
export const SdkSyncCustomerAttributesBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String)
});

// ========================================================
// Projects
// ========================================================

export const CreateProjectBody = Schema.Struct({
  name: Schema.String,
  organizationId: Schema.String
});

export const Project = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String
});

// ========================================================
// Organizations
// ========================================================

export const CreateOrganizationBody = Schema.Struct({
  name: Schema.String
});

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String
});
