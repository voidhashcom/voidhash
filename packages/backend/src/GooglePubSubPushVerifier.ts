import { unsafeDefined } from "./runtime-boundary.ts";
import { constant } from "@voidhash/lib/lang";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const GooglePubSubClaims = Schema.Struct({
  email: Schema.String,
  isEmailVerified: Schema.Boolean,
}).pipe(Schema.encodeKeys({ isEmailVerified: "email_verified" }));

const GOOGLE_OIDC_ISSUERS = constant(["accounts.google.com", "https://accounts.google.com"]);
const GOOGLE_OIDC_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

export class GooglePubSubPushVerificationError extends Schema.TaggedErrorClass<GooglePubSubPushVerificationError>(
  "GooglePubSubPushVerificationError",
)("GooglePubSubPushVerificationError", {
  kind: Schema.Literals(["misconfigured", "unauthorized"]),
  message: Schema.String,
}) {}

export interface GooglePubSubPushVerifierShape {
  /** Verifies the authenticated Pub/Sub push bearer token and its bound identity. */
  readonly verify: (
    authorizationHeader: string | typeof Schema.Undefined.Type,
  ) => Effect.Effect<void, GooglePubSubPushVerificationError>;
}

/** Authenticates Google Pub/Sub push requests before their payload is processed. */
export class GooglePubSubPushVerifier extends Context.Service<
  GooglePubSubPushVerifier,
  GooglePubSubPushVerifierShape
>()("@voidhash/backend/GooglePubSubPushVerifier") {}

export interface GooglePubSubPushVerifierOptions {
  readonly audience: string;
  readonly serviceAccountEmail: string;
  readonly jwks: JWTVerifyGetKey;
}

/** Builds a verifier around an explicit JWK source for production and deterministic tests. */
export const makeGooglePubSubPushVerifier = (
  options: GooglePubSubPushVerifierOptions,
): GooglePubSubPushVerifierShape => ({
  verify: (authorizationHeader) =>
    Effect.gen(function* () {
      const audience = options.audience.trim();
      const serviceAccountEmail = options.serviceAccountEmail.trim();
      if (!audience || !serviceAccountEmail) {
        return yield* new GooglePubSubPushVerificationError({
          kind: "misconfigured",
          message:
            "Google Pub/Sub push authentication requires an audience and service-account email",
        });
      }

      const bearerMatch = authorizationHeader?.match(/^Bearer\s+(\S+)$/i);
      if (!bearerMatch) {
        return yield* new GooglePubSubPushVerificationError({
          kind: "unauthorized",
          message: "Missing or malformed Pub/Sub bearer token",
        });
      }

      const verification = yield* Effect.tryPromise({
        try: () =>
          jwtVerify(unsafeDefined(bearerMatch[1]), options.jwks, {
            algorithms: ["RS256"],
            audience,
            issuer: [...GOOGLE_OIDC_ISSUERS],
          }),
        catch: () =>
          new GooglePubSubPushVerificationError({
            kind: "unauthorized",
            message: "Invalid Pub/Sub identity token",
          }),
      });

      const claims = yield* Schema.decodeUnknownEffect(GooglePubSubClaims)(
        verification.payload,
      ).pipe(
        Effect.mapError(
          () =>
            new GooglePubSubPushVerificationError({
              kind: "unauthorized",
              message: "Pub/Sub identity token is missing required claims",
            }),
        ),
      );

      if (!claims.isEmailVerified || claims.email !== serviceAccountEmail) {
        return yield* new GooglePubSubPushVerificationError({
          kind: "unauthorized",
          message: "Pub/Sub identity token does not match the configured service account",
        });
      }
    }),
});

const googleOidcJwks = createRemoteJWKSet(GOOGLE_OIDC_JWKS_URL);

/** Production verifier configured by the authenticated push subscription settings. */
const envString = (name: string) => Config.string(name).pipe(Config.withDefault(""), Effect.orDie);

export const GooglePubSubPushVerifierLive = Layer.effect(
  GooglePubSubPushVerifier,
  Effect.gen(function* () {
    const audience = yield* envString("GOOGLE_PUBSUB_PUSH_AUDIENCE");
    const serviceAccountEmail = yield* envString("GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL");
    return makeGooglePubSubPushVerifier({
      audience,
      jwks: googleOidcJwks,
      serviceAccountEmail,
    });
  }),
);
