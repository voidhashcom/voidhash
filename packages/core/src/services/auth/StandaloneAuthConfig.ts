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

/** Environment bag accepted by the resolvers — `process.env` in every runtime. */
export type StandaloneAuthEnv = Record<string, string | undefined>;

/** Root login name used when `VOIDHASH_ROOT_USERNAME` is unset. */
export const DEFAULT_ROOT_USERNAME = "root";

/**
 * Root password used when `VOIDHASH_ROOT_PASSWORD` is unset. Reachable only in
 * `SELFHOST_MODE=local-evaluation`, which the README restricts to loopback;
 * production refuses to start without a real value.
 */
export const DEFAULT_ROOT_PASSWORD = "voidhash";

/** Root email used when `VOIDHASH_ROOT_EMAIL` is unset. */
export const DEFAULT_ROOT_EMAIL = "root@voidhash.local";

/**
 * Values `.env.example` ships as placeholders. Shared with the self-host
 * security validator so both agree on what "not really configured" means.
 */
export const isPlaceholderSecret = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "password" ||
    normalized.includes("not_configured") ||
    normalized.includes("change-me") ||
    normalized.includes("replace-me") ||
    normalized.startsWith("replace-with-")
  );
};

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
  env: StandaloneAuthEnv = process.env,
): StandaloneAuthConfig => ({
  rootEmail: normalizeEmail(env.VOIDHASH_ROOT_EMAIL?.trim() || DEFAULT_ROOT_EMAIL),
  rootPassword: env.VOIDHASH_ROOT_PASSWORD?.trim() || DEFAULT_ROOT_PASSWORD,
  rootUsername: env.VOIDHASH_ROOT_USERNAME?.trim() || DEFAULT_ROOT_USERNAME,
  secret: env.VOIDHASH_AUTH_SECRET?.trim() || STANDALONE_AUTH_DEFAULT_SECRET,
});

/**
 * Names the standalone settings that are missing or still carry an evaluation
 * default. Empty when the deployment is safe to expose beyond loopback.
 */
export const standaloneAuthConfigIssues = (
  env: StandaloneAuthEnv = process.env,
): ReadonlyArray<string> => {
  const issues: Array<string> = [];
  if (!env.VOIDHASH_ROOT_USERNAME?.trim()) issues.push("VOIDHASH_ROOT_USERNAME");
  if (isPlaceholderSecret(env.VOIDHASH_ROOT_PASSWORD)) issues.push("VOIDHASH_ROOT_PASSWORD");
  if (isPlaceholderSecret(env.VOIDHASH_AUTH_SECRET)) issues.push("VOIDHASH_AUTH_SECRET");
  return issues;
};
