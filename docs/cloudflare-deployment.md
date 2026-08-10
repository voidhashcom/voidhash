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
docker compose up -d standalone_postgres
pnpm db:migrate
pnpm dev
```

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
