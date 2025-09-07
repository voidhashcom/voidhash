import { Schema } from 'effect';

const SdkHeaders = Schema.Struct({
  'x-app-user-id': Schema.String,
  'x-publishable-key': Schema.String,
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

export const parseSdkHeaders = (headers: Headers) =>
  Schema.decodeUnknownSync(SdkHeaders)(Object.fromEntries(headers));
