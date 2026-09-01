/**
 * Root credentials for the standalone identity provider.
 *
 * Read identically by the self-host runtime and the TanStack Start server
 * routes so both sides mint and verify the same session tokens without passing
 * the decision between processes.
 *
 * Self-host is single-player: there is exactly one user, whose credentials come
 * from the environment. Nothing here can create a second identity.
 */
import {
  STANDALONE_AUTH_DEFAULT_SECRET,
  normalizeEmail,
} from "../../utils/crypto/standalone-auth-token.ts";
import { processEnvironment as rawProcessEnvironment } from "../../effect-boundary.ts";
import * as Option from "effect/Option";
import * as Str from "effect/String";

/** Environment bag accepted by the resolvers — `process.env` in every runtime. */
export interface StandaloneAuthEnv {
  readonly VOIDHASH_AUTH_SECRET: Option.Option<string>;
  readonly VOIDHASH_ROOT_EMAIL: Option.Option<string>;
  readonly VOIDHASH_ROOT_PASSWORD: Option.Option<string>;
  readonly VOIDHASH_ROOT_USERNAME: Option.Option<string>;
}

/** Root login name used when `VOIDHASH_ROOT_USERNAME` is unset. */
export const DEFAULT_ROOT_USERNAME = "root";

/**
 * Root password used when `VOIDHASH_ROOT_PASSWORD` is unset. This default is
 * public knowledge and appropriate only for loopback development; every live
 * deployment must set a real value.
 */
export const DEFAULT_ROOT_PASSWORD = "voidhash";

/** Root email used when `VOIDHASH_ROOT_EMAIL` is unset. */
export const DEFAULT_ROOT_EMAIL = "root@voidhash.local";

/**
 * Values `.env.example` ships as placeholders. Shared with the self-host
 * security validator so both agree on what "not really configured" means.
 */
export const isPlaceholderSecret = (value: Option.Option<string>): boolean =>
  Option.match(value, {
    onNone: () => true,
    onSome: (secret) => {
      const normalized = secret.trim().toLowerCase();
      return (
        !Str.isNonEmpty(normalized) ||
        normalized === "password" ||
        normalized.includes("not_configured") ||
        normalized.includes("change-me") ||
        normalized.includes("replace-me") ||
        normalized.startsWith("replace-with-")
      );
    },
  });

const valueOrElse = (value: Option.Option<string>, fallback: string): string =>
  value.pipe(
    Option.map((entry) => entry.trim()),
    Option.filter(Str.isNonEmpty),
    Option.getOrElse(() => fallback),
  );

/** Resolved root identity and session signing key. */
export interface StandaloneAuthConfig {
  readonly rootUsername: string;
  readonly rootPassword: string;
  readonly rootEmail: string;
  readonly secret: string;
}

/**
 * Reads the standalone auth configuration, falling back to the documented
 * evaluation defaults. Callers that must not accept the defaults check
 * {@link standaloneAuthConfigIssues} first.
 */
export const resolveStandaloneAuthConfig = (
  env: StandaloneAuthEnv = currentProcessEnvironment(),
): StandaloneAuthConfig => ({
  rootEmail: normalizeEmail(valueOrElse(env.VOIDHASH_ROOT_EMAIL, DEFAULT_ROOT_EMAIL)),
  rootPassword: valueOrElse(env.VOIDHASH_ROOT_PASSWORD, DEFAULT_ROOT_PASSWORD),
  rootUsername: valueOrElse(env.VOIDHASH_ROOT_USERNAME, DEFAULT_ROOT_USERNAME),
  secret: valueOrElse(env.VOIDHASH_AUTH_SECRET, STANDALONE_AUTH_DEFAULT_SECRET),
});

/**
 * Names the standalone settings that are missing or still carry an evaluation
 * default. Empty when the deployment is safe to expose beyond loopback.
 */
export const standaloneAuthConfigIssues = (
  env: StandaloneAuthEnv = currentProcessEnvironment(),
): ReadonlyArray<string> => {
  const issues: Array<string> = [];
  if (
    Option.isNone(
      env.VOIDHASH_ROOT_USERNAME.pipe(
        Option.map((value) => value.trim()),
        Option.filter(Str.isNonEmpty),
      ),
    )
  )
    issues.push("VOIDHASH_ROOT_USERNAME");
  if (isPlaceholderSecret(env.VOIDHASH_ROOT_PASSWORD)) issues.push("VOIDHASH_ROOT_PASSWORD");
  if (isPlaceholderSecret(env.VOIDHASH_AUTH_SECRET)) issues.push("VOIDHASH_AUTH_SECRET");
  return issues;
};

const currentProcessEnvironment = (): StandaloneAuthEnv => ({
  VOIDHASH_AUTH_SECRET: Option.fromNullishOr(rawProcessEnvironment.VOIDHASH_AUTH_SECRET),
  VOIDHASH_ROOT_EMAIL: Option.fromNullishOr(rawProcessEnvironment.VOIDHASH_ROOT_EMAIL),
  VOIDHASH_ROOT_PASSWORD: Option.fromNullishOr(rawProcessEnvironment.VOIDHASH_ROOT_PASSWORD),
  VOIDHASH_ROOT_USERNAME: Option.fromNullishOr(rawProcessEnvironment.VOIDHASH_ROOT_USERNAME),
});
