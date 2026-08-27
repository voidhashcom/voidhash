# mimic-db Cloudflare deployment

`@voidhash/mimic-db` owns both the portable document engine and its production
Cloudflare adapter. The adapter is provisioned with Alchemy and is shared by any
deployment that supplies a Hyperdrive connection and a migration registry.

## Topology

```text
                          MimicDbWorker
             /rpc/v1                           /ws/v1
                │                                 │
                ▼                                 ▼
      MimicHostObject (singleton)       MimicDocumentObject (per document)
      Durable Object SQLite             hibernatable WebSockets
      databases / collections           serialized transactions
      users / grants / tokens            presence and idle alarms
                │                                 │
                └──────────────┬──────────────────┘
                               ▼
                    Hyperdrive → PostgreSQL
                    snapshots + command log
```

- `/rpc/v1` serves `MimicRpcGroup` over NDJSON with HTTP Basic authentication.
- `/ws/v1/databases/:db/collections/:collection/documents/:document` forwards
  WebSocket upgrades to the document Durable Object.
- `MimicHostObject` stores control-plane state in Durable Object SQLite and
  bootstraps registry-owned databases, collections, schemas, and the root user.
- Each `MimicDocumentObject` serializes one document's updates, owns its live
  sessions, and persists snapshots and commands through Hyperdrive.

The public protocol and `HostService` remain platform-neutral. Cloudflare code
lives under `src/cloudflare`, while the core, HTTP, and WebSocket modules remain
testable without workerd.

## Alchemy composition

`makeMimicDbWorker` accepts deployment-specific resources:

- a Cloudflare Hyperdrive connection;
- the migration registry imported into the Worker bundle;
- an optional idle-notification queue; and
- optional Worker environment and telemetry hooks.

The Community stack in `apps/backend/stack.ts` deploys the Worker, binds it to
the backend as `MIMIC_HOST`, configures `MIMIC_DB_URL` and the shared root
password, binds the public mimic URL for WebSocket tokens, and restricts CORS to
the web application origin. The backend uses the live `MimicSDK` adapter from
`@voidhash/backend/MimicHostLive`; its stub remains only for in-process tests.

## Configuration

The deployment requires `MIMIC_ROOT_PASSWORD` for `production` and `preview`
stages. Ephemeral and local stages default to `password`. Runtime bindings are:

- `ROOT_PASSWORD` and optional `ROOT_USERNAME` for bootstrap authentication;
- `CORS_ORIGINS` for RPC and WebSocket origin checks;
- `MIMIC_PUBLIC_BASE_URL` for absolute `ws://` or `wss://` token URLs; and
- `MIMIC_DOCUMENT_*` tuning values documented in `src/config.ts`.

Local Alchemy development serves mimic-db on port `5001`; the backend connects
directly to that loopback URL. Deployed stages use the Cloudflare service
binding, avoiding a public-network hop between Workers.

## Verification

- `pnpm --filter @voidhash/mimic-db typecheck`
- `pnpm --filter @voidhash/mimic-db test`
- `pnpm --filter @voidhash/backend typecheck`
- `pnpm --filter @voidhash/backend-app typecheck`

A live deployment additionally requires Cloudflare credentials and the database
origin variables used by the Community Hyperdrive resource.
