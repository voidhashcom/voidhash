# Cloudflare deployment

The Community composition in `apps/backend/stack.ts` uses Alchemy to deploy the
backend and web application to Cloudflare Workers. Hyperdrive fronts
PostgreSQL, R2 stores public files and paywall artifacts, and Cloudflare
Workflows run the application workflow registry. Cloudflare-specific adapters
live in `packages/platform/cloudflare`.

## Local development

Run Alchemy:

```sh
cp .env.example .env
pnpm dev
```

### Development database

With `DATABASE_MODE` omitted or set to `pglite`, the development stack
provisions [PGlite](https://pglite.dev) as an Alchemy resource. It uses PGlite's
[Node filesystem](https://pglite.dev/docs/filesystems), persists its data in
`.pglite/`, serves the real PostgreSQL wire protocol on port `5432`, and applies
pending Community migrations before the Workers start. The resource output
feeds the local Hyperdrive binding directly, so this mode needs no database
credentials in `.env`.

Set `DATABASE_MODE=pg` to use the `DATABASE_*` PostgreSQL origin instead.
That server must already be reachable. Alchemy applies pending migrations
before the Workers start and feeds the connection to the local Hyperdrive
binding. `DATABASE_DIRECT_*` can select a separate directly reachable migration
socket. `DATABASE_SSL=true` enables TLS. The mode setting affects only
`pnpm dev`; live deployments always use the configured PostgreSQL origin.

Three differences from a standalone PostgreSQL server matter:

- It exposes exactly one database and ignores the database name, username, and
  password a client connects with. The Alchemy resource therefore consistently
  binds the built-in `postgres` database and credentials.
- It does not speak TLS. The Hyperdrive development origin already sets
  `sslmode=disable`.
- It is a single PostgreSQL backend behind a multiplexer, so concurrent clients
  share one session and transactions serialise globally. The managed socket
  server accepts up to 100 clients; session-scoped advisory locks provide no
  mutual exclusion between them, and `SET` leaks across them.

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
  `DATABASE_PASSWORD` for the live PostgreSQL origin. `pnpm dev` reads these
  only when `DATABASE_MODE=pg`.
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
