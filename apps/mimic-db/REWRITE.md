# mimic-db — Durable Objects rewrite

This app was rewritten from an **Effect Cluster** topology (gateway/worker shards,
MySQL persistence, MySQL-backed message/runner storage, Node `vm` migration
sandbox) onto **Cloudflare Durable Objects**, provisioned with **Alchemy**, with
migrations executed in a **Cloudflare Sandbox** container and applied **lazily on
document load** instead of an eager "migration push" over every document.

## What changed

| Before (Effect Cluster)                                | After (Durable Objects)                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `gateway` + `worker` roles, `ShardingConfig`           | one `MimicDocumentObject` DO **per document** (`collectionId:documentId`)                                          |
| MySQL (`@effect/sql-mysql2`) for all state             | control plane in `MimicHostObject` SQLite; **document snapshots + command log back in MySQL** (via Hyperdrive)     |
| `SqlMessageStorage`/`SqlRunnerStorage` cluster tables  | none — the DO is the coordination/realtime primitive, MySQL is the durable system of record                        |
| WebSocket gateway + HTTP fanout (`GatewayFanoutRpc`)   | hibernatable WebSockets **on the document DO**; fanout is local                                                    |
| `node:vm` (`Script`/`createContext`) migration sandbox | in-process `evaluateBundledMigration` (`new Function`, **no `node:vm`/quickjs**) — see "Migration execution" below |
| eager "migration push" iterates every document         | `MimicHostObject` records new schema versions; each document **migrates itself on load**                           |
| standalone/gateway/worker Node entrypoints             | `MimicDbWorker` Cloudflare Worker (one fetch entrypoint)                                                           |
| deployed standalone; backend points at external URL    | **provisioned from `packages/backend`** alchemy stack; service binding + `MIMIC_HOST_URL`                              |

## Preserved contracts (so clients/backend keep working)

- **RPC** — the exact `MimicRpcGroup` from `@voidhash/mimic-server/rpc`,
  served at `/rpc/v1` over NDJSON with HTTP Basic auth. Handlers
  (`src/api/handlers/*`) and the Basic-auth middleware (`src/api/middleware/auth.ts`)
  are unchanged — they depend only on `HostServiceTag`.
- **WebSocket** — same JSON protocol (`src/ws/protocol.ts`): `auth` → `auth_result` +
  `snapshot` + `presence_snapshot`, then `submit`/`ping`/`presence_*` and server
  `transaction`/`pong`/`error`/`presence_*`. Route
  `/ws/v1/databases/:db/collections/:col/documents/:doc`.
- **`HostService`** — same interface (`src/app/hostService.ts`); only the
  implementation backing it changed.

## Architecture

```
                         ┌──────────────────────── MimicDbWorker (fetch) ───────────────────────┐
client ──HTTP /rpc/v1──► │  RpcServer(MimicRpcGroup) ──► HostService (DurableHostServiceLive)    │
client ──WS  /ws/v1───►  │  WebSocket upgrade ─────────────────────────────────────────────┐    │
                         └─────────────┬───────────────────────────────────────────────────┼────┘
                            control ops │ document ops                                       │ ws upgrade
                                        ▼                                                     ▼
                          ┌── MimicHostObject (DO) ──┐                 ┌── MimicDocumentObject (DO, per doc) ──┐
                          │ SQLite control plane:    │  schema/migrate │ SQLite: meta + snapshots + commands   │
                          │ databases, collections,  │ ◄────chain──────┤ • migrate-on-load (Sandbox)           │
                          │ schema_versions(+source), │                 │ • applyBatch transactions             │
                          │ users, grants, tokens,    │                 │ • hibernatable WS fanout (local)      │
                          │ document_index, migrations│                 └───────────────┬───────────────────────┘
                          └───────────────────────────┘                                  │ runMigration(source,value)
                                                                                         ▼
                                                                          ┌── MimicMigrationSandbox (Container) ──┐
                                                                          │ isolated exec of bundled migration JS │
                                                                          └───────────────────────────────────────┘
```

## Testable core

The hard logic lives in `src/core/` behind small `Effect` service seams so it runs
both inside DOs (`SqlControlStoreLive` / `SqlDocumentStoreLive` over `SqlStorage`,
`SandboxMigrationExecutorLive`) and in-process for `pnpm dev` + tests
(`MemoryControlStoreLive` / `MemoryDocumentStoreLive`, `LocalMigrationExecutorLive`).

- `core/store.ts` — `ControlStore` + `DocumentStore` service contracts.
- `core/memory-store.ts` / `core/sql-store.ts` — the two backends.
- `core/migration-executor.ts` — `MigrationExecutor` (Sandbox vs local `new Function`
  eval; **no `node:vm`**).
- `core/control-engine.ts` — control-plane logic over `ControlStore`.
- `core/document-engine.ts` — load / **migrate-on-load** / submit / snapshot over
  `DocumentStore` + `MigrationExecutor`.
- `core/local-host-service.ts` — `LocalHostServiceLive`: composes the engines with an
  in-process per-document registry; satisfies `HostServiceTag` for dev + tests.

`LocalHostServiceLive` faithfully simulates per-document isolation in one process,
which is exactly what the integration tests exercise (`tests/integration/*`).

## Document persistence: MySQL (not Workers SQLite)

Durable document state — **snapshots** and the command log — lives in **MySQL**
(the shared PlanetScale DB, reached via the same Cloudflare **Hyperdrive** binding
the backend uses), not the Durable Object's SQLite. The DO is purely the
per-document concurrency + realtime + migrate-on-load primitive; MySQL is the
system of record.

- `core/mysql-store.ts` — `makeMysqlDocumentStore(config, documentId)` implements the
  same `DocumentStoreApi` the in-memory backend does (tables `mimic_documents`,
  `mimic_document_snapshots`, `mimic_document_commands`, keyed by `document_id`, no
  FKs to the control plane). `ensureDocumentTables` creates them idempotently on DO
  boot (`IF NOT EXISTS`; on Vitess/PlanetScale prefer pre-creating via the migration
  pipeline).
- Hyperdrive host/password are **per Worker invocation**, so `resolveMysqlConfig`
  reads fresh credentials and `MimicDocumentObject` builds a fresh store+engine **per
  operation** — never caching a connection for the DO's lifetime (mirrors
  `@voidhash/core`'s `makeScopedDbLayer`).
- The DO binds the shared `Hyperdrive` resource from `@voidhash/core/infrastructure`
  (`Cloudflare.Hyperdrive.bind` + `Cloudflare.HyperdriveBindingLive`).
- The control plane (databases/collections/schema-versions/users/grants/tokens/
  document-index) still lives in `MimicHostObject`'s DO SQLite — only document
  snapshots/commands moved to MySQL.

## Migration execution

Bundled data-migrations run **in-process** in the document DO via
`evaluateBundledMigration` (`new Function`, not `node:vm`/quickjs). The original
plan was a `MimicMigrationSandbox` Cloudflare Container for isolation, but
**Hyperdrive cannot bind to a Worker that also has a Container** (alchemy
propagates the Worker's Hyperdrive binding to the Container runtime, which
`HyperdriveBindingPolicy` rejects), so a Container and the MySQL Hyperdrive
binding cannot coexist in this Worker. `MimicMigrationSandbox.ts` is kept
unwired as a reference. Follow-up: host the sandbox in a **dedicated container
Worker** and call it from the document DO via a service binding so migration
code runs isolated (Workers also restrict `new Function` at request time).

## Local dev (`pnpm dev` / `alchemy dev`)

`pnpm dev` boots the whole Alchemy stack (backend, www, analyticsPipeline, and
**MimicDbWorker**) through the local Cloudflare dev sidecar. Two things this
worker required to boot:

- **`.ts` import specifiers.** Alchemy's dev loader resolves `.ts` source with
  native Node (no `.js`→`.ts` remap), like `@voidhash/core`. `mimic-core`,
  `mimic-server`, and mimic-db's reused files used `.js` specifiers (legacy
  published-package convention) and were converted to `.ts` (their build
  tsconfigs gained `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`).
- **Lazy Durable Object stubs.** `namespace.getByName(...)` reads a runtime env
  binding that only exists per-request — calling it at Worker init crashes the
  plan. The control-store stub is resolved lazily (a forwarding proxy) and the
  document stub only inside request handlers.

Verified: `Done: 8 succeeded`, `MimicDbWorker Started`, and `GET
http://localhost:1340/health` → `200`.

## Verification status

- ✅ `pnpm typecheck` — whole package (core + Durable Objects + worker + Alchemy).
- ✅ `pnpm test` — 10 tests: control CRUD, document create/submit/version-conflict,
  **lazy migrate-on-load** via both schema reconcile and a bundled data migration
  (through the Sandbox-shaped `MigrationExecutor`), single-use document tokens, and
  the `node:vm`/QuickJS-replacement executor itself.
- ⚠️ A live Cloudflare deploy (real DOs + the `MimicMigrationSandbox` container) is
  **not** runtime-verified here — it needs `CLOUDFLARE_API_TOKEN` and a container
  image build. The cloud shell reuses the same engine code the tests cover and
  follows the repo's proven patterns (`AnalyticsIngestShardDO`, the alchemy-effect
  DO/Container/WebSocket fixtures). Deploy with `pnpm alchemy deploy`; the worker URL
  is exposed as the `mimicDbUrl` stack output and bound to the backend as `MIMIC_HOST`.

## Provisioning from the backend

`alchemy.run.ts` (the backend's stack) deploys `MimicDbWorker`, binds it to
`BackendService` as the `MIMIC_HOST` service binding, and exposes its URL as the
`mimicDbUrl` output. Point the backend's `MIMIC_HOST_URL` (consumed by
`internal/packages/core/.../mimic-host`) at that URL.
