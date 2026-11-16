const DEFAULT_PORT = 8080;
const DEFAULT_INGEST_URL = "https://ingest.voidhash.com";
const DEFAULT_PAYMENT_SOURCE = "nimbus-pay";

/** Everything the service reads from the environment, already validated. */
export type AppConfig = {
  readonly secretKey: string;
  readonly webhookSecret: string | undefined;
  /** Slug of the payment source the fake billing provider reports to. */
  readonly paymentSource: string;
  /** Signing secret (`vhps_…`) of that source's endpoint. */
  readonly providerSecret: string | undefined;
  /** Where this service is reachable; the fake checkout page lives under it. */
  readonly publicUrl: string;
  readonly baseUrl: string | undefined;
  readonly ingestUrl: string;
  readonly port: number;
};

/** A boot-time environment problem. The message is meant to be printed as-is. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const optional = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const readPort = (value: string | undefined): number => {
  const raw = optional(value);

  if (raw === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ConfigError(`PORT must be an integer between 1 and 65535, got "${raw}".`);
  }

  return port;
};

const MISSING_SECRET_KEY = [
  "VOIDHASH_SECRET_KEY is not set.",
  "",
  "Create one in Studio under Project settings → API keys, then either export it:",
  "",
  "  export VOIDHASH_SECRET_KEY=vh_sk_...",
  "",
  "or copy .env.example to .env and run `pnpm dev`.",
].join("\n");

/**
 * Reads and validates the service configuration.
 *
 * Throws {@link ConfigError} rather than returning a half-built config: a
 * backend that boots without a secret key only fails later, on the first
 * request, in a much less obvious place.
 */
export const readConfig = (env: NodeJS.ProcessEnv): AppConfig => {
  const secretKey = optional(env.VOIDHASH_SECRET_KEY);

  if (secretKey === undefined) {
    throw new ConfigError(MISSING_SECRET_KEY);
  }

  const port = readPort(env.PORT);

  return {
    baseUrl: optional(env.VOIDHASH_BASE_URL),
    ingestUrl: (optional(env.VOIDHASH_INGEST_URL) ?? DEFAULT_INGEST_URL).replace(/\/+$/, ""),
    paymentSource: optional(env.VOIDHASH_PAYMENT_SOURCE) ?? DEFAULT_PAYMENT_SOURCE,
    port,
    providerSecret: optional(env.VOIDHASH_PROVIDER_SECRET),
    publicUrl: (optional(env.PUBLIC_URL) ?? `http://localhost:${port}`).replace(/\/+$/, ""),
    secretKey,
    webhookSecret: optional(env.VOIDHASH_WEBHOOK_SECRET),
  };
};
