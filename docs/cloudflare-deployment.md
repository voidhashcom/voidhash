# Cloudflare deployment

The Community composition in `apps/backend/stack.ts` uses Alchemy to deploy the
backend and web application to Cloudflare Workers. Hyperdrive fronts
PostgreSQL, R2 stores public files and paywall artifacts, and Cloudflare
Workflows run the application workflow registry. Cloudflare-specific adapters
live in `packages/platform/cloudflare`.

## Local development

Start PostgreSQL, apply the Community migrations, and run Alchemy:

```sh
cp .env.example .env
pnpm db:pglite &          # or: docker compose up -d standalone_postgres
pnpm db:migrate
pnpm dev
```

### PGlite or PostgreSQL

`pnpm db:pglite` serves [PGlite](https://pglite.dev) — PostgreSQL compiled to
WebAssembly — over the real PostgreSQL wire protocol, so Hyperdrive, the
migration CLI, and every driver in the tree talk to it exactly as they would to
a server. It needs no Docker and stores its data in `.pglite/`.

Three differences matter when using it:

- It exposes exactly one database and ignores the database name, username, and
  password a client connects with, so the stock `DATABASE_*` values work
  unchanged. Setting `DATABASE_NAME=postgres` additionally skips the migration
  CLI's `CREATE DATABASE` step, which PGlite accepts but cannot honour.
- It does not speak TLS. The Hyperdrive development origin already sets
  `sslmode=disable`, and `DATABASE_SSL=false` covers the migration CLI.
- It is a single PostgreSQL backend behind a multiplexer, so concurrent clients
  share one session and transactions serialise globally. The `db:pglite` script
  therefore passes `--max-connections=100`; never run it on the default of `1`,
  which refuses the second connection. Session-scoped advisory locks provide no
  mutual exclusion between clients, and `SET` leaks across them.

Use `docker compose up -d standalone_postgres` when you want the PostgreSQL
major version, session isolation, and locking semantics of a live deployment.

### Tests

`pnpm test:integration` runs the database-backed suites. It reuses whatever
server is already listening and otherwise starts `standalone_postgres`.

It deliberately does not default to PGlite. Because every pooled connection is
multiplexed onto one backend, a statement error there can roll back work another
connection already committed — two `core` suites fail on exactly that, and other
cases would be silently wrong rather than red. `VOIDHASH_TEST_PGLITE=1` selects
it anyway for a fast local loop, but a change should be gated on PostgreSQL.

The backend listens on `http://localhost:8787` and the web application on
`http://localhost:3000`. Alchemy watches the stack and updates both local
Workers as their source changes.

## Deployment

A live deployment needs Cloudflare credentials plus a PostgreSQL origin that
Cloudflare Hyperdrive can reach. Copy `.env.example` to `.env`, then configure:

- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` for the target account.
- `VOIDHASH_BACKEND_DOMAIN` and `VOIDHASH_WWW_DOMAIN` with hostnames whose
  Cloudflare zones already exist in that account.
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, and
  `DATABASE_PASSWORD` for the PostgreSQL origin.
- Production values for the root account and session-signing settings.

Run migrations against the configured origin, then deploy:

```sh
pnpm db:migrate
pnpm alchemy deploy --stage production
```

`PAYWALL_PUBLIC_BASE_URL` defaults to `https://<VOIDHASH_BACKEND_DOMAIN>`. Set
it explicitly only when the backend is deployed without a custom domain.
`VOIDHASH_WORKERS_DEV_ENABLED` controls whether both Workers also retain their
`workers.dev` URLs.

The Community composition uses the fixed `VoidhashCommunity` Alchemy stack
name. Alchemy includes the stack and stage in deployment state and generated
resource names, so it can coexist with other stacks in the same Cloudflare
account. Do not reuse that stack name for an unrelated installation in the same
account.

Alchemy owns the Workers, custom-domain attachments, Hyperdrive configuration,
R2 buckets, workflow registrations, and deployment state; it does not own the
Cloudflare zones or PostgreSQL origin.
