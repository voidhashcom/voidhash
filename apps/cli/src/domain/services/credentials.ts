import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { HttpClient } from "effect/http";

import { FailedToStoreCredentialError } from "../errors/auth";
import { CliConfig, legacyApiKeys } from "./cli-config";
import { CredentialStore, type StoredCredentialSource } from "./credential-store";
import { isSessionToken, Revocation, revokeToken } from "./device-login";

/** Where the credential a command uses came from. */
export type CredentialSource = StoredCredentialSource | "environment";

/** The token the CLI sends to one API origin, and where it came from. */
export interface Credential<Source extends CredentialSource = CredentialSource> {
  readonly token: string;
  readonly source: Source;
  readonly origin: string;
}

/**
 * The origin credentials are stored under for `apiUrl`, such as
 * `https://api.voidhash.com`: its scheme, host and port, so a token is never
 * sent to another port, or over plain HTTP to the host it was issued on.
 */
export const apiOrigin = (apiUrl: string): Option.Option<string> =>
  Option.liftThrowable(() => new URL(apiUrl))().pipe(
    Option.filter(({ protocol }) => protocol === "https:" || protocol === "http:"),
    Option.map(({ origin }) => origin),
  );

/** How a credential's source reads after "from": "the macOS keychain". */
export const describeCredentialSource = (source: CredentialSource, filePath: string) =>
  Match.value(source).pipe(
    Match.when("environment", () => "the VOIDHASH_API_KEY environment variable"),
    Match.when("keychain", () => "the macOS keychain"),
    Match.when("secret-service", () => "the Secret Service keyring"),
    Match.when("file", () => filePath),
    Match.exhaustive,
  );

/** A token shown without its secret part: `vh_oat_…3f9a`. */
export const maskToken = (token: string) => {
  const prefix = /^[a-z]+_[a-z]+_/.exec(token)?.[0] ?? "";
  return token.length - prefix.length > 8 ? `${prefix}…${token.slice(-4)}` : `${prefix}…`;
};

const make = Effect.fn("make")(function* effect() {
  const store = yield* CredentialStore;
  const cliConfig = yield* CliConfig;
  const httpClient = yield* HttpClient.HttpClient;

  const environmentKey = (yield* Config.option(Config.String("VOIDHASH_API_KEY")).pipe(
    Effect.orElseSucceed(() => Option.none<string>()),
  )).pipe(Option.filter((key) => key.trim() !== ""));

  // Keys the config file still holds from before the credential store move into
  // it, each under the origin it was sent to. Profiles on one origin share its
  // token, so a key whose origin already has another token (stored before, or
  // another profile's moved first) is dropped and reported: its profile now
  // acts as whoever that token belongs to. A dropped sign-in is revoked unless
  // another profile kept it for its own origin; a project key is left working.
  const raw = yield* cliConfig.readRawConfig().pipe(Effect.option);
  const legacy = Option.match(raw, { onNone: () => [], onSome: legacyApiKeys });
  if (Arr.isReadonlyArrayNonEmpty(legacy)) {
    yield* Effect.gen(function* () {
      const dropped = yield* Effect.filter(
        legacy,
        ({ apiKey, apiUrl }) =>
          Option.match(apiOrigin(apiUrl), {
            onNone: () => Effect.succeed(false),
            onSome: (origin) =>
              store.get(origin).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => store.set(origin, apiKey).pipe(Effect.as(false)),
                    onSome: ({ token }) => Effect.succeed(token !== apiKey),
                  }),
                ),
              ),
          }),
        { concurrency: 1 },
      );
      yield* cliConfig.removeLegacyApiKeys();
      yield* Effect.logDebug("Moved the CLI key from the config into the credential store");
      const kept = Arr.filter(
        legacy,
        (entry) => Option.isSome(apiOrigin(entry.apiUrl)) && !dropped.includes(entry),
      );
      yield* Effect.forEach(
        dropped,
        ({ apiKey, apiUrl, profile }) =>
          Effect.gen(function* () {
            const owner = Option.match(profile, {
              onNone: () => "The key",
              onSome: (name) => `The key of the "${name}" profile`,
            });
            const login = Option.match(profile, {
              onNone: () => "voidhash-cli login",
              onSome: (name) => `voidhash-cli login --profile ${name}`,
            });
            const reason = `profiles on the same server share one sign-in, and ${Option.getOrElse(apiOrigin(apiUrl), () => apiUrl)} already has another, which may be a different account.`;
            if (!isSessionToken(apiKey)) {
              return yield* Console.error(
                `! ${owner} in ${cliConfig.filePath} was removed from the config but not revoked: ${reason} To keep using the project key, pass a copy of it in VOIDHASH_API_KEY, or create a new key in the dashboard if you kept none; to sign in as yourself, run '${login}'.`,
              );
            }
            const isKeptElsewhere = Arr.some(kept, (entry) => entry.apiKey === apiKey);
            const isRevoked = isKeptElsewhere
              ? false
              : Revocation.$is("Revoked")(yield* revokeToken(apiUrl, apiKey));
            yield* Console.error(
              `! ${owner} in ${cliConfig.filePath} was removed${isRevoked ? " and revoked" : ""}: ${reason} Run '${login}' to sign in as the account the key used.`,
            );
          }),
        { concurrency: 1, discard: true },
      );
    }).pipe(
      Effect.provideService(HttpClient.HttpClient, httpClient),
      Effect.catch((error) =>
        Effect.logWarning(
          `Could not move the key in ${cliConfig.filePath} to the credential store: ${error.message}`,
        ),
      ),
    );
  }

  // Looking a token up may run a keychain tool; once per origin per run is enough.
  const cache = yield* Ref.make(
    HashMap.empty<string, Option.Option<Credential<StoredCredentialSource>>>(),
  );

  /**
   * The token stored for `apiUrl`'s origin, ignoring `VOIDHASH_API_KEY`. A
   * credential is only ever looked up for the origin it will be sent to.
   */
  const stored = Effect.fn("Credentials.stored")(function* (apiUrl: string) {
    const origin = yield* Effect.fromOption(apiOrigin(apiUrl)).pipe(
      Effect.mapError(
        () =>
          new FailedToStoreCredentialError({ message: `The API URL ${apiUrl} is not a valid URL` }),
      ),
    );
    const cached = HashMap.get(yield* Ref.get(cache), origin);
    if (Option.isSome(cached)) return cached.value;
    const found = Option.map(
      yield* store.get(origin),
      ({ token, source }): Credential<StoredCredentialSource> => ({ token, source, origin }),
    );
    yield* Ref.update(cache, HashMap.set(origin, found));
    return found;
  });

  /** The credential a request to `apiUrl` carries: `VOIDHASH_API_KEY`, then the stored token. */
  const resolve = Effect.fn("Credentials.resolve")(function* (apiUrl: string) {
    if (Option.isSome(environmentKey)) {
      return Option.some<Credential>({
        token: environmentKey.value,
        source: "environment",
        origin: Option.getOrElse(apiOrigin(apiUrl), () => apiUrl),
      });
    }
    return yield* stored(apiUrl);
  });

  /**
   * {@link resolve}, reading the stored token again instead of the one this
   * run looked up before: another run may have signed in since, as while
   * `types generate --watch` runs, which ended the earlier token's session.
   */
  const reload = Effect.fn("Credentials.reload")(function* (apiUrl: string) {
    const origin = apiOrigin(apiUrl);
    if (Option.isSome(origin)) yield* Ref.update(cache, HashMap.remove(origin.value));
    return yield* resolve(apiUrl);
  });

  /** Stores `token` for `apiUrl`'s origin, replacing the one stored before. */
  const save = Effect.fn("Credentials.save")(function* (apiUrl: string, token: string) {
    const origin = yield* Effect.fromOption(apiOrigin(apiUrl)).pipe(
      Effect.mapError(
        () =>
          new FailedToStoreCredentialError({ message: `The API URL ${apiUrl} is not a valid URL` }),
      ),
    );
    const source = yield* store.set(origin, token);
    const credential: Credential<StoredCredentialSource> = { token, source, origin };
    yield* Ref.update(cache, HashMap.set(origin, Option.some(credential)));
    return credential;
  });

  /**
   * Deletes `credential`, a token {@link stored} returned. Fails when it could
   * not be deleted from where it was found.
   */
  const forget = Effect.fn("Credentials.forget")(function* (
    credential: Credential<StoredCredentialSource>,
  ) {
    yield* store.remove(credential.origin, credential.source);
    yield* Ref.update(cache, HashMap.set(credential.origin, Option.none()));
  });

  return {
    environmentKey,
    filePath: store.filePath,
    forget,
    /** The operating system's store tokens are kept in, when this computer has one. */
    osStore: store.osStore,
    reload,
    resolve,
    save,
    stored,
  };
})();

export class Credentials extends Context.Service<Credentials, Effect.Success<typeof make>>()(
  "voidhash-cli/Credentials",
) {
  /** Needs a {@link CredentialStore}, the {@link CliConfig} and an `HttpClient`. */
  static layer = Layer.effect(Credentials, make);
}
