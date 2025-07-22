import { Schema } from 'effect';

const SdkHeaders = Schema.Struct({
  'Content-Type': Schema.Literal('application/json'),
  'X-App-User-Id': Schema.String,
  'X-Publishable-Key': Schema.String,
  'X-Platform': Schema.String,
  'X-SDK': Schema.Literal('react-native'),
  'X-SDK-Version': Schema.String,
  'X-Platform-Flavor': Schema.Literal('native'),
  'X-Platform-Flavor-Version': Schema.optional(Schema.String),
  'X-Platform-Version': Schema.optional(Schema.String),
  'X-Platform-Device': Schema.optional(Schema.String),
  'X-Platform-Brand': Schema.optional(Schema.String),
  'X-Preferred-Locales': Schema.optional(Schema.String),
  'X-Client-Locale': Schema.optional(Schema.String),
  'X-Client-Version': Schema.optional(Schema.String),
  'X-Client-Bundle-ID': Schema.String,
  'X-Observer-Mode-Enabled': Schema.Literal('false'),
  'X-Nonce': Schema.optional(Schema.String),
  'X-Storefront': Schema.optional(Schema.String),
  'X-Is-Debug-Build': Schema.Literal('true', 'false'),
  'X-Is-Backgrounded': Schema.Literal('false')
});

export const parseSdkHeaders = (headers: Headers) => {
  return Schema.decodeUnknownSync(SdkHeaders)(headers);
};
