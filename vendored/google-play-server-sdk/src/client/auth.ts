import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/unstable/http";
import { SignJWT, importPKCS8 } from "jose";

import { GooglePlayUnauthorizedError } from "../errors/api-errors.ts";
import { GooglePlayGeneralError } from "../errors/client-errors.ts";

const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const JWT_BEARER_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";

export interface GooglePlayAuthConfig {
  /**
   * Service account credentials JSON string
   */
  readonly serviceAccountKey: string;
}

/**
 * An authenticated Google Play client handle. Holds a freshly minted OAuth2
 * access token for the Android Publisher scope; the client closes over it for
 * the lifetime of a single request/workflow task (token validity is one hour).
 */
export interface GooglePlayAuthClient {
  readonly accessToken: string;
}

const serviceAccountCodec = Schema.Struct({
  client_email: Schema.String.check(Schema.isMinLength(1)),
  private_key: Schema.String.check(Schema.isMinLength(1)),
  token_uri: Schema.optional(Schema.String),
});

const serviceAccountFromJson = Schema.fromJsonString(serviceAccountCodec);

const tokenResponse = Schema.Struct({
  access_token: Schema.String.check(Schema.isMinLength(1)),
  expires_in: Schema.optional(Schema.Number),
  token_type: Schema.optional(Schema.String),
});

const tokenResponseFromJson = Schema.fromJsonString(tokenResponse);

const parseServiceAccount = (serviceAccountKey: string) =>
  Schema.decodeUnknownEffect(serviceAccountFromJson)(serviceAccountKey).pipe(
    Effect.mapError(
      (error) =>
        new GooglePlayUnauthorizedError({
          message: `Invalid service account credentials: ${error.message}`,
        }),
    ),
  );

/**
 * Mints a Google OAuth2 access token for the Android Publisher scope using the
 * service-account JWT-bearer grant. The assertion is signed with WebCrypto via
 * `jose`, so this runs unchanged on Cloudflare Workers — there is no dependency
 * on `google-auth-library` or `node:crypto`. The token request deliberately
 * uses the global `fetch` rather than `HttpClient` so the SDK carries no
 * service requirement and stays usable from any Workers entrypoint.
 */
const requestAccessToken = (serviceAccount: typeof serviceAccountCodec.Type) =>
  Effect.gen(function* () {
    const tokenUri = serviceAccount.token_uri ?? DEFAULT_TOKEN_URI;

    const privateKey = yield* Effect.tryPromise({
      try: () => importPKCS8(serviceAccount.private_key, "RS256"),
      catch: (cause) =>
        new GooglePlayUnauthorizedError({
          message: `Failed to import service account private key: ${String(cause)}`,
        }),
    });

    const assertion = yield* Effect.tryPromise({
      try: () =>
        new SignJWT({ scope: ANDROID_PUBLISHER_SCOPE })
          .setProtectedHeader({ alg: "RS256", typ: "JWT" })
          .setIssuer(serviceAccount.client_email)
          .setSubject(serviceAccount.client_email)
          .setAudience(tokenUri)
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(privateKey),
      catch: (cause) =>
        new GooglePlayUnauthorizedError({
          message: `Failed to sign service account JWT: ${String(cause)}`,
        }),
    });

    const transportFailure = (cause: unknown) =>
      new GooglePlayGeneralError({
        message: "Failed to obtain Google Play access token",
        cause,
      });

    const client = yield* HttpClient.HttpClient;
    const response = yield* client
      .post(tokenUri, {
        body: HttpBody.text(
          new URLSearchParams({
            assertion,
            grant_type: JWT_BEARER_GRANT_TYPE,
          }).toString(),
          "application/x-www-form-urlencoded",
        ),
      })
      .pipe(Effect.mapError(transportFailure));

    const responseBody = yield* response.text.pipe(Effect.mapError(transportFailure));

    if (response.status < 200 || response.status >= 300) {
      return yield* new GooglePlayUnauthorizedError({
        message: `Google token endpoint returned ${response.status}: ${responseBody}`,
      });
    }

    const parsed = yield* Schema.decodeUnknownEffect(tokenResponseFromJson)(responseBody).pipe(
      Effect.mapError(
        (error) =>
          new GooglePlayGeneralError({
            message: `Unexpected Google token response: ${error.message}`,
            cause: responseBody,
          }),
      ),
    );

    return parsed.access_token;
  }).pipe(Effect.provide(FetchHttpClient.layer));

/**
 * Creates an authenticated Google Play client by minting an OAuth2 access token
 * from the supplied service-account credentials JSON.
 */
export const createAuthClient = (config: GooglePlayAuthConfig) =>
  Effect.gen(function* () {
    const serviceAccount = yield* parseServiceAccount(config.serviceAccountKey);
    const accessToken = yield* requestAccessToken(serviceAccount);
    return { accessToken } satisfies GooglePlayAuthClient;
  });

/**
 * Returns the access token from an authenticated client handle.
 */
export const getAccessToken = (client: GooglePlayAuthClient) => Effect.succeed(client.accessToken);

/**
 * Helper to create auth headers for API requests
 */
export const createAuthHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});
