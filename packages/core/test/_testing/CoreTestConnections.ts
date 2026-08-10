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
 * self-host stack (repo-root `.env`) and `scripts/run-local-integration.mjs`
 * already use. Defaults target the local docker-compose dev stack.
 */
export const coreTestConnectionsFromEnv = (
  // oxlint-disable-next-line effect/noGlobals -- synchronous config adapter: the default argument is evaluated at call sites that run before any Effect runtime exists (vitest globalSetup and the local integration runner).
  env: Record<string, string | undefined> = process.env,
): CoreTestConnections => ({
  db: {
    host: env.DATABASE_HOST ?? "127.0.0.1",
    port: Number(env.DATABASE_PORT ?? "5432"),
    username: env.DATABASE_USERNAME ?? "voidhash",
    password: env.DATABASE_PASSWORD ?? "password",
    databaseName: env.DATABASE_NAME ?? "voidhash",
  },
});
