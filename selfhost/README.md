# Voidhash self-host

The Compose composition runs the backend API and persistent Mimic RPC/WebSocket
host in one Node process. PostgreSQL backs application data, entity state,
queues, workflows, key-value storage, and cron leases; MinIO provides the two
S3-compatible object stores. A private-network Node sidecar safely contains
component compilation and manifest extraction. The application image includes
headless Chromium, so an edited paywall is rendered to a persistent public PNG
after its Mimic WebSocket session becomes idle. The stack uses the same
application services and platform contracts as the Cloudflare composition.
ClickHouse OSS is an optional `analytics` profile; without it, capture still
processes identity state in PostgreSQL and analytics reads return empty results.

## Start

For an infrastructure and Mimic evaluation with local defaults:

```sh
docker compose -f selfhost/docker-compose.yml up --build --wait
```

For the complete dashboard and backend auth flow, create a WorkOS staging
environment, copy `selfhost/.env.example` to `selfhost/.env`, fill in its WorkOS
credentials, replace every example password, and run the same command with
`--env-file selfhost/.env`. Community Edition v1 intentionally uses BYO WorkOS;
the placeholder defaults only keep the unauthenticated API, health checks, and
Mimic operator path available for evaluation.

The no-env quick start explicitly selects `SELFHOST_MODE=local-evaluation`
inside Compose and is safe only on loopback. `selfhost/.env.example` selects
`SELFHOST_MODE=production`; in that mode the migration and application refuse
to start if database, object-store, Mimic, WorkOS, or enabled ClickHouse
credentials are missing or still use known examples. Production mode also
requires HTTPS public, file, Mimic, and WorkOS redirect URLs. Keep production
mode enabled for every network-accessible deployment.

To enable durable analytics, start the optional profile and tell the application
to use its private-network HTTP endpoint:

```sh
CLICKHOUSE_URL=http://clickhouse:8123 docker compose -f selfhost/docker-compose.yml \
  --profile analytics up --build --wait
```

When using `selfhost/.env`, keep the same `CLICKHOUSE_URL` shell override and add
`--env-file selfhost/.env`. The migration entrypoint creates the analytics schema,
a read-write ingest user, a tenant-filtered readonly user, and a hardened query
user. Replace all ClickHouse example passwords before exposing the deployment.

The dashboard and API share `http://localhost:5001`; both `GET /health` and
`GET /api/health` report readiness, and the OpenAPI document is available at
`/api/docs/openapi.json`. Set the same origin plus `/api/auth/callback` as the
WorkOS redirect URI. MinIO exposes its S3 API at `http://localhost:9000`
and its console at `http://localhost:9001`. Local email is captured by Mailpit,
whose inbox is at `http://localhost:8025`; configure the SMTP variables in
`selfhost/.env` to use an external delivery service. The Node runtime verifies
the configured SMTP transport at startup in Compose. PostgreSQL stays on the
private Compose network and is not published to the host. With the analytics
profile enabled, ClickHouse HTTP is available at `http://localhost:8123`.
When running the Node entry outside its image, set `CHROMIUM_EXECUTABLE_PATH` to
a compatible Chromium executable to enable paywall thumbnails; the remaining
runtime stays available when it is unset.

### Agent models

Durable designer-agent sessions use your own OpenAI or Anthropic credentials.
Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `selfhost/.env`; OpenAI is selected
when both are present. The default models are `gpt-5.4` and
`claude-sonnet-4-6`, respectively. Override text and vision routing with
`VOIDHASH_AGENT_MODEL_PROVIDER`, `VOIDHASH_AGENT_MODEL_ID`,
`VOIDHASH_AGENT_VISION_MODEL_PROVIDER`, and
`VOIDHASH_AGENT_VISION_MODEL_ID`. An OpenAI-compatible deployment can also set
`OPENAI_BASE_URL` while keeping the provider id `openai`.

### Google Play RTDN

Google Play Real-time developer notifications must use an authenticated Pub/Sub
push subscription. Configure its push authentication service account and token
audience, then set `GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL` and
`GOOGLE_PUBSUB_PUSH_AUDIENCE` to those exact values in `selfhost/.env`. The push
endpoint is
`/api/v1/webhook-endpoints/google-play-rtdn/{paymentProviderConfigurationId}`.
The backend verifies Google's signature, issuer, expiration, audience, verified
email claim, and service-account identity before reading the Pub/Sub envelope;
missing authentication is rejected and missing server configuration fails
closed with a retryable response.

### Measurement configuration signing

SDK collector configuration is signed with the Ed25519 PKCS#8 key configured by
`MEASUREMENT_CONFIG_PRIVATE_KEY_PKCS8`. Set a stable public identifier in
`MEASUREMENT_CONFIG_KEY_ID` and a positive monotonic
`MEASUREMENT_CONFIG_VERSION`. To rotate keys, deploy clients trusting both the
old and new public keys, switch the server key and key ID, increment the version,
then remove the old client trust only after the supported client window has
elapsed. Never reuse or decrease a version, including after a rollback.

## Smoke test

From a workspace checkout with dependencies installed:

```sh
./node_modules/.bin/tsx selfhost/smoke.mts
```

The smoke test creates a database, collection, and document through the public
SDK, mints a document token, authenticates over WebSocket, verifies the initial
snapshot, submits a transaction, and removes its fixtures. It also verifies the
shared dashboard, the Community capability response, and app health, proving that
the backend route graph and durable workflow runner boot without ClickHouse, which
remains an optional profile.

To include an authenticated model-backed agent round-trip, set
`SELFHOST_AGENT_SMOKE_BEARER_TOKEN`, `SELFHOST_AGENT_SMOKE_ORGANIZATION_ID`, and
`SELFHOST_AGENT_SMOKE_PROJECT_ID` before running the smoke test. Optionally set
`SELFHOST_AGENT_SMOKE_PAYWALL_ID` to exercise a designer-scoped session. The
credentials must identify a user with access to that project, and the runtime
must have one of the agent provider keys configured.

The release-grade smoke additionally requires the analytics profile and Docker
access from the checkout:

```sh
docker compose -f selfhost/docker-compose.yml --profile analytics \
  up -d clickhouse --wait
CLICKHOUSE_URL=http://clickhouse:8123 docker compose -f selfhost/docker-compose.yml \
  --profile analytics up --build --wait
./node_modules/.bin/tsx selfhost/release-smoke.mts
```

It creates an isolated project and paywall in PostgreSQL, provisions and edits
the paywall document through the public Mimic SDK and WebSocket surface, waits
for Chromium to publish its PNG through the public file route, creates and
publishes an immutable visual release, resolves that release through the SDK
endpoint, and fetches the rendered HTML. It then submits an event through the
capture API and verifies that event in ClickHouse. The release CI runs both
smoke levels from a clean Compose stack.

## Stop

```sh
docker compose -f selfhost/docker-compose.yml down
```

Add `-v` only when you also intend to delete the Postgres volume.
