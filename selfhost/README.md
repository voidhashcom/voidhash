# Voidhash self-host

The Compose composition runs the backend API and persistent Mimic RPC/WebSocket
host in one Node process. PostgreSQL backs application data, entity state,
queues, workflows, key-value storage, and cron leases; MinIO provides the two
S3-compatible object stores. A private-network Node sidecar safely contains
component compilation and manifest extraction. The application image includes
headless Chromium, so an edited paywall is rendered to a persistent public PNG
after its Mimic WebSocket session becomes idle. The stack uses the same
application services and platform contracts as the Cloudflare composition.
Community analytics capture and revenue insights are stored in PostgreSQL.

## Local development

The stack doubles as the default development environment. The dev overlay
publishes Postgres and the compiler to the host so tests and tooling reach the
same services the app uses:

```sh
pnpm verify                              # everything CI checks — run before pushing
pnpm verify:quick                        # typecheck + unit tier, for tight loops
```

`pnpm verify` is the whole contract: boundary checks, typecheck, and the three
test tiers. Nothing else needs remembering, and CI runs the same scripts —
Repository CI runs `verify:quick`, and the Self-host Compose workflow runs the
two stack-backed tiers.

| Tier | Command | Selects | Needs the stack |
| --- | --- | --- | --- |
| Unit | `pnpm test` | `*.test.ts` | no |
| Integration | `pnpm test:integration` | `*.integration.test.ts` | yes |
| End-to-end | `pnpm test:e2e` | `selfhost/smoke.mts` | yes |

A test's tier is decided by its filename alone — no environment flag gates a
test, so a test either runs or its tier fails loudly. `pnpm test:integration`
starts the stack if it is down and creates `.env` from `.env.example` on a
first checkout, so there is no separate setup step to forget. It then reads
`.env`, derives host-side connection settings (container hostnames become
`127.0.0.1` plus the published port), and runs the suites one after another —
they share one PostgreSQL database, so parallel runs would race on schema
setup. Pass suite names to narrow the run, for example
`pnpm test:integration platform backend`.

Several suites build a durable cluster of their own to exercise it — the
platform adapters, the backend workflow and queue compositions, and the agent
session host. A single-node cluster claims *every* shard in the database it is
built over, so a suite sharing the running app's database would steal the
messages addressed to it and vice versa. `pnpm test:integration` therefore
recreates a `<database>_platform_test` database before the suites start and
points `DATABASE_PLATFORM_NAME` and the `PLATFORM_SELFHOST_PG_*` test
connection at it. Application tables are untouched: a suite that asserts on
app-visible state still reads and writes the deployment's database, over a
second connection. Recreating rather than reusing the database also guarantees
no run inherits the undeliverable messages described under
[renaming or removing a cron job](#renaming-or-removing-a-cron-job).

`pnpm stack:up` and `pnpm stack:down` manage the stack directly when you want
it running outside a test run. `pnpm test:e2e:release` is the heavier
release-grade smoke described below; it is gated on releases rather than
included in `verify`.

In the production compose file PostgreSQL stays unpublished and the compiler
is reachable only on its internal network; only the dev overlay
(`docker-compose.dev.yml`) exposes them.

## Start

The whole stack, including the dashboard and its sign-in flow, runs with no
configuration at all:

```sh
docker compose -f selfhost/docker-compose.yml up --build --wait
```

Open `http://localhost:5001` and sign in as `root` with the password
`voidhash`.

## Authentication

Voidhash self-host is **single-player**: it has exactly one account, the root
user, whose credentials come from the environment. There is no sign-up, no
invitation, and no way to create a second user.

| Variable | Purpose |
| --- | --- |
| `VOIDHASH_ROOT_USERNAME` | Root login name. Evaluation default `root`. |
| `VOIDHASH_ROOT_PASSWORD` | Root password. Evaluation default `voidhash`. |
| `VOIDHASH_ROOT_EMAIL` | Root address. Defaults to `root@voidhash.local`. |
| `VOIDHASH_AUTH_SECRET` | Signs session tokens. |

Sign-in verifies the credentials in constant time and mints a signed token,
carried in a `vh-session` cookie and accepted as an `Authorization: Bearer`
token by the API. The user row is created on first use. Organizations,
projects, paywalls, the designer, API keys, and the agent all work; single-user
means one operator, not one organization. There is no SSO, no self-service
password reset, and no external identity service to configure — rotating the
password is an edit to your environment and a restart.

Unlike the earlier development-only provider, this one is meant for real
deployments. What production mode refuses is running it on the *documented
evaluation defaults*: the no-env quick start selects
`SELFHOST_MODE=local-evaluation` inside Compose and is safe only on loopback,
because its root password and signing secret are public knowledge.
`.env.example` selects `SELFHOST_MODE=production`; in that mode the migration
and application refuse to start unless the root credentials, signing secret,
database, object-store, and Mimic credentials are all real,
and they require HTTPS public, file, and Mimic URLs. Keep production mode
enabled for every network-accessible deployment.

The dashboard and API share `http://localhost:5001`; both `GET /health` and
`GET /api/health` report readiness, and the OpenAPI document is available at
`/api/docs/openapi.json`. MinIO exposes its S3 API at `http://localhost:9000`
and its console at `http://localhost:9001`. Local email is captured by Mailpit,
whose inbox is at `http://localhost:8025`; configure the SMTP variables in
`.env` to use an external delivery service. The Node runtime verifies
the configured SMTP transport at startup in Compose. PostgreSQL stays on the
private Compose network and is not published to the host.
When running the Node entry outside its image, set `CHROMIUM_EXECUTABLE_PATH` to
a compatible Chromium executable to enable paywall thumbnails; the remaining
runtime stays available when it is unset.

### Agent models

Durable designer-agent sessions use your own OpenAI or Anthropic credentials.
Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`; OpenAI is selected
when both are present. The default models are `gpt-5.4` and
`claude-sonnet-4-6`, respectively. Override text and vision routing with
`VOIDHASH_AGENT_MODEL_PROVIDER`, `VOIDHASH_AGENT_MODEL_ID`,
`VOIDHASH_AGENT_VISION_MODEL_PROVIDER`, and
`VOIDHASH_AGENT_VISION_MODEL_ID`. An OpenAI-compatible deployment can also set
`OPENAI_BASE_URL` while keeping the provider id `openai`.

### Platform composition

`@voidhash/platform-selfhost` backs every platform primitive, and there is
nothing to select: a self-host deployment has exactly one composition.

Durable execution runs on Effect Cluster over Postgres, as a single-node
cluster: queues become persisted queues, workflows become cluster workflow
entities, cron slots become persisted cluster singletons, and durable entities
run on the cluster entity host. Those tables are created on first boot and need
no extra service.

Platform state lives beside application data by default, which is the shape a
deployment wants. `DATABASE_PLATFORM_HOST`, `DATABASE_PLATFORM_PORT`,
`DATABASE_PLATFORM_NAME`, `DATABASE_PLATFORM_USERNAME`,
`DATABASE_PLATFORM_PASSWORD`, and `DATABASE_PLATFORM_SSL` move it elsewhere;
each falls back to its `DATABASE_*` counterpart, so setting only the name is
enough to put it in another database on the same server. The reason it is
separable at all is shard ownership: a single-node cluster claims every shard in
its database, so two processes over one database steal each other's messages.
Nothing about a deployment needs that, but a test process running beside a live
deployment does — see the integration tier above.

The remaining primitives are plain clients against the services the stack
already runs: the typed key-value store, the mailer, the object store, and the
screenshot renderer.

#### Durable entity sessions

Collaborative documents and agent sessions attach live WebSockets to a durable
entity. A socket is held open by one process and cannot be serialized into a
cluster message, so entity sessions are only reachable on the runner that owns
the entity's shard. The single-runner topology this deployment ships owns every
shard, which makes that condition true by construction; attaching a session to a
shard this runner does not own fails loudly rather than silently dropping the
socket from later broadcasts. Running several runners would need a socket
gateway that fans broadcasts out to the process holding each connection — that
is deliberately not built.

Entity alarms live in `platform_entity_alarms`, indexed by scheduled time, and
the entry process polls it to fire due alarms.

**Upgrading from an earlier self-host build:** durable entity values moved off
the `platform_entity_kv` table onto the shared Effect persistence key-value
store. Existing rows in `platform_entity_kv` are *not* migrated and are no
longer read; alarms in `platform_entity_alarms` carry over unchanged. In
practice the affected state is per-document idle-notification bookkeeping and
agent session transcripts written by the old Postgres entity host. Drop
`platform_entity_kv` once you no longer need it for reference.

#### Renaming or removing a cron job

Every scheduled job is a cluster singleton addressed by its job name, and its
due slots are durable messages in the `cluster_messages` table. A
message addressed to a job name that no process registers has nowhere to go, and
it is never discarded: the storage read loop retries it forever, logging

```
Could not find entity manager for address, retrying
```

in a tight loop. That loop does not just spin — it starves the rest of the
cluster runner, so unrelated workflows and queue consumers stall until they time
out. It is a stale-address problem, not a load problem: the symptom appears
after a process exits with pending slots and the next process no longer
registers those exact names.

Renaming or deleting a scheduled job therefore needs a deliberate cleanup step.
There is no automatic reconciliation — expiring messages by address would mean
deleting rows the cluster runtime owns from outside it. Drain the undeliverable
messages instead:

```sql
DELETE FROM cluster_messages WHERE entity_type = 'ClusterCron/<retired-job-name>';
```

Each job is its own entity type, so `entity_type LIKE 'ClusterCron/%'` clears
every schedule at once when you do not know which name went stale. Do it while
no runner is live. Slots are re-armed from the persisted cron state on the next
boot, so nothing is lost beyond the missed occurrences.

### Google Play RTDN

Google Play Real-time developer notifications must use an authenticated Pub/Sub
push subscription. Configure its push authentication service account and token
audience, then set `GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL` and
`GOOGLE_PUBSUB_PUSH_AUDIENCE` to those exact values in `.env`. The push
endpoint is
`/api/v1/webhook-endpoints/google-play-rtdn/{paymentProviderConfigurationId}`.
The backend verifies Google's signature, issuer, expiration, audience, verified
email claim, and service-account identity before reading the Pub/Sub envelope;
missing authentication is rejected and missing server configuration fails
closed with a retryable response.

## Smoke test

From a workspace checkout with dependencies installed:

```sh
pnpm test:e2e
```

The smoke test creates a database, collection, and document through the public
SDK, mints a document token, authenticates over WebSocket, verifies the initial
snapshot, submits a transaction, and removes its fixtures. It also verifies the
shared dashboard, the Community capability response, and app health, proving that
the backend route graph, PostgreSQL analytics capture, and durable workflow runner boot.

To include an authenticated model-backed agent round-trip, set
`SELFHOST_AGENT_SMOKE_BEARER_TOKEN`, `SELFHOST_AGENT_SMOKE_ORGANIZATION_ID`, and
`SELFHOST_AGENT_SMOKE_PROJECT_ID` before running the smoke test. Optionally set
`SELFHOST_AGENT_SMOKE_PAYWALL_ID` to exercise a designer-scoped session. The
credentials must identify a user with access to that project, and the runtime
must have one of the agent provider keys configured.

The release-grade smoke additionally requires Docker access from the checkout:

```sh
docker compose -f selfhost/docker-compose.yml up --build --wait
pnpm test:e2e:release
```

It creates an isolated project and paywall in PostgreSQL, provisions and edits
the paywall document through the public Mimic SDK and WebSocket surface, waits
for Chromium to publish its PNG through the public file route, creates and
publishes an immutable visual release, resolves that release through the SDK
endpoint, and fetches the rendered HTML. It then submits an event through the
capture API and verifies that event in PostgreSQL. The release CI runs both
smoke levels from a clean Compose stack.

## Stop

```sh
docker compose -f selfhost/docker-compose.yml down
```

Add `-v` only when you also intend to delete the Postgres volume.
