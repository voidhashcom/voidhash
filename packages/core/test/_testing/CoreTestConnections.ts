/**
 * The complete environment contract for the core integration suite.
 *
 * This is the seam between the open-core tests and whatever composition runs
 * them: the Community repo's `globalSetup` derives these values from the local
 * self-host stack's environment, while downstream compositions (the managed
 * cloud) provision their own infrastructure and inject the same shape. Tests
 * never know which composition produced it.
 */
export interface CoreTestConnections {
  readonly db: {
    readonly host: string;
    readonly port: number;
    readonly username: string;
    readonly password: string;
    readonly databaseName: string;
  };
  readonly clickhouse: {
    readonly url: string;
    readonly username: string;
    readonly password: string;
    readonly database: string;
  };
  /** Credential strings only — no core test dials the WorkOS API. */
  readonly workos: {
    readonly apiKey: string;
    readonly clientId: string;
    readonly cookieName: string;
    readonly cookiePassword: string;
    readonly webhookSecret: string;
  };
}

/**
 * The once-per-run output a composition's `globalSetup` shares with every test
 * file. Compositions may inject a structural superset (the managed cloud adds
 * deploy artifacts such as URLs); the suite only relies on this shape.
 */
export interface CoreStackOutput {
  readonly testConnections: CoreTestConnections | null;
}

/**
 * Builds the contract from environment variables, matching the names the
 * self-host stack (`selfhost/.env`) and `scripts/run-local-integration.mjs`
 * already use. Defaults target the local docker-compose dev stack.
 */
export const coreTestConnectionsFromEnv = (
  env: Record<string, string | undefined> = process.env,
): CoreTestConnections => ({
  db: {
    host: env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(env.DATABASE_PORT ?? "5432"),
    username: env.DATABASE_USERNAME ?? "voidhash",
    password: env.DATABASE_PASSWORD ?? "password",
    databaseName: env.DATABASE_NAME ?? "voidhash",
  },
  clickhouse: {
    url: env.CLICKHOUSE_URL ?? "http://127.0.0.1:8123",
    username: env.CLICKHOUSE_USERNAME ?? "voidhash_app",
    password: env.CLICKHOUSE_PASSWORD ?? "password",
    database: env.CLICKHOUSE_DATABASE ?? "voidhash",
  },
  workos: {
    apiKey: env.WORKOS_API_KEY ?? "sk_test_selfhost_not_configured",
    clientId: env.WORKOS_CLIENT_ID ?? "client_selfhost_not_configured",
    cookieName: env.WORKOS_COOKIE_NAME ?? "wos-session",
    cookiePassword:
      env.WORKOS_COOKIE_PASSWORD ?? "selfhost-development-cookie-password-change-me",
    webhookSecret: env.WORKOS_WEBHOOK_SECRET ?? "whsec_selfhost_not_configured",
  },
});
