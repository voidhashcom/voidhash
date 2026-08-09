# Voidhash architecture

Voidhash has one canonical Community codebase and two runtime compositions.
This repository contains every MIT and AGPL Community component. The private
cloud repository pins it as a submodule and adds Cloudflare infrastructure,
closed Enterprise packages, the Overwatch operations plane, and cloud-only
integration tests. Community source is never mirrored back into the private
repository.

```mermaid
flowchart TD
  Community["voidhash Community codebase<br/>MIT SDKs + AGPL services"]
  Platform["@voidhash/platform<br/>provider-neutral contracts"]
  Node["Community self-host<br/>Node + PostgreSQL + MinIO + optional ClickHouse"]
  Cloud["Managed Cloud<br/>Cloudflare + PlanetScale adapters"]
  Private["Private composition<br/>Enterprise + Overwatch + deployment graph"]

  Community --> Platform
  Platform --> Node
  Platform --> Cloud
  Community --> Private
  Cloud --> Private
```

## Community packages

- `libraries/` contains MIT SDKs embedded in customer applications.
- `apps/backend`, `apps/www`, and `apps/mimic-db` are the AGPL service entry
  points. `packages/backend` is the backend library, while
  `@voidhash/web-app` is the shared web source package they compose.
- `@voidhash/web-app` owns shared web features and separate shared and
  Community route sets. `apps/www` is the thin Community entrypoint that selects
  those routes and supplies standalone auth and edition behavior. Another
  edition can add its own pages and composition modules without mirroring or
  patching Community source.
- `@voidhash/platform` defines provider-neutral Effect services and application
  primitives for durable entities, queues, workflows, scheduled jobs, key-value
  storage, object storage, screenshots, and mail.
- `packages/core`, `packages/db`, `packages/rpc`, and the remaining service
  packages own portable application and domain behavior.
- `@voidhash/platform-selfhost` implements those contracts for a single Node
  deployment on PostgreSQL. Durable execution — queues, workflows, cron, and
  durable entities — runs on Effect Cluster and Effect Workflow over that same
  Postgres; the plain infrastructure adapters (object storage, mail,
  screenshots) are direct clients. Entity WebSocket sessions are process-local
  and therefore require the runner that owns the entity's shard, which the
  single-runner topology guarantees. `apps/backend` composes the Community
  application.

Runtime backends are selected per primitive, not per provider, so a deployment
can move one primitive to a managed service without touching the others. Every
adapter is validated against the shared conformance suite in
`@voidhash/platform/conformance`.

The publication-boundary check rejects private package scopes, infrastructure
directories, Enterprise code, operations-plane code, and incomplete package
license metadata from this repository.

## Self-host composition

The self-host runtime is a modular monolith. One Node process serves the API
and dashboard and runs Mimic entities, queue consumers, workflows, and cron
fibers. PostgreSQL provides transactional state and durable scheduling; MinIO
provides S3-compatible objects; the compiler is isolated in a private-network
sidecar; Chromium renders paywall artifacts. ClickHouse is an optional
analytics profile. Community authenticates a single root account from the
environment and needs no external identity service.

See [the self-hosting guide](../selfhost/README.md) for the supported Compose
path and operational requirements.

## Managed cloud composition

The private repository can deploy the same application primitives to
Cloudflare through Alchemy, and owns deployment state, environments,
secrets, and cloud-only integration tests. Product services continue to import
provider-neutral interfaces; a zero-baseline seam check rejects new Cloudflare
or Alchemy imports from application code.

## Enterprise and operations boundaries

Enterprise packages and Overwatch are private. Enterprise features mount
through explicit Community extension points; the Community application boots
and passes its tests with the private packages absent. Staff authentication,
admin RPC groups, impersonation, support tooling, and license issuance exist
only in the private operations plane.

## Security boundaries

The [backend threat model](security/backend-threat-model.md) covers tenant
isolation, credentials, provider webhooks, storage, analytics, rendering, and
compiler sandboxing. The
[endpoint authorization matrix](security/endpoint-authorization-matrix.md)
records authentication and ownership evidence for the HTTP and RPC surfaces.
