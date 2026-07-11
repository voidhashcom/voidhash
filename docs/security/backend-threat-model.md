# Backend Threat Model

Status: alpha review draft  
Last updated: 2026-07-11  
Scope: `apps/backend`, `apps/mimic-db`, `apps/www`, `packages/core`, and
`selfhost`

This document records the security analysis required before the repository can
be made public. It describes current controls and known gaps; it is not a claim
that the system is vulnerability-free. The beta traffic review and independent
review required by the publication plan have not happened yet.

## Security objectives

- A caller can act only as the user, project, organization, or SDK identity
  established by an authenticated session or key.
- One tenant cannot read or mutate another tenant's product or analytics data.
- Provider and identity webhooks are accepted only after authenticity checks,
  and duplicate delivery cannot duplicate financial state transitions.
- Secrets, unpublished paywalls, private objects, and operator data do not cross
  public boundaries.
- Tenant-authored code and HTML cannot gain API-origin authority or escape the
  compiler isolation boundary.
- Malformed or excessive input fails within bounded memory, time, and retry
  budgets.

Availability of the managed service against volumetric denial of service is an
operational objective, but not a guarantee made by the Community Edition.

## Assets and actors

Protected assets include WorkOS sessions, user and project API keys, payment
provider credentials, webhook signing secrets, tenant database rows,
ClickHouse events, Mimic documents and document tokens, unpublished paywall
artifacts, object-store credentials, and compiler/container integrity.

Relevant actors are anonymous internet clients, SDK clients holding a
publishable key, users holding a WorkOS session or user API key, server
integrations holding a project secret key, tenant administrators, payment and
identity providers, self-host operators, and a malicious authenticated tenant
submitting component source.

## Trust boundaries

1. Internet to WWW/backend HTTP and WebSocket surfaces.
2. Authentication middleware to request-scoped `AuthSession`.
3. Tenant-scoped services to PostgreSQL and ClickHouse adapters.
4. Provider webhook ingress to provider verification and idempotent ledgers.
5. Backend to queues, workflows, object stores, SMTP, and screenshot services.
6. Backend to the component compiler container/sidecar.
7. Public, content-addressed artifact serving to browsers and SDKs.
8. Self-host operator configuration to the Compose network and persistent
   stores.

The cloud and self-host compositions use the same application services. Their
infrastructure boundaries differ: Cloudflare Workers, Durable Objects, Queues,
Workflows, R2, Hyperdrive, and an isolated compiler container in cloud; a Node
process, PostgreSQL-backed primitives, S3-compatible storage, and a separate
compiler sidecar in self-host.

## Authentication and sessions

Threats include session forgery or fixation, credential confusion between
supported authentication methods, stale membership, secret leakage through
logs, and an unauthenticated request reaching a privileged handler.

Current controls:

- `ApiMiddlewares.ts` selects exactly one authentication method and resolves it
  to a typed user, secret-key, or publishable-key session before API handlers
  run.
- WorkOS session cookies are authenticated by the WorkOS adapter; local access
  is loaded from server-side membership state.
- Project secret keys establish a session containing only their project.
  Publishable keys establish an SDK identity with no management permissions.
- MCP accepts only a Bearer project secret key and constructs the same
  project-scoped session used by the HTTP API.
- Authentication failures collapse to non-authenticated or generic internal
  errors rather than returning stored credential details.

Evidence includes API-key integration tests for disabled/expired keys and
forbidden mutation, RPC smoke coverage, MCP protocol/dispatch tests, and WorkOS
signature tests.

Residual work:

- Beta must add explicit cookie fixation, malformed-cookie, revoked-membership,
  and authentication-method-confusion tests.
- Deployments that change `WORKOS_COOKIE_NAME` must verify that middleware
  method selection and the WorkOS adapter use the same configured name.

## API keys and credential storage

Threats include database disclosure of reusable secrets, guessing, use after
revocation/expiry, cross-project key management, and accidental telemetry
capture.

Current controls:

- User and project secret keys are generated with cryptographic randomness and
  stored as hashes. The raw value is returned only at creation/rotation.
- Publishable keys are intentionally public and confer no management
  permissions.
- Validation rejects disabled and expired records. Mutations check project or
  user ownership and emit audit events through the audit port.
- Telemetry annotates key identifiers, public status, prefix, and suffix—not the
  raw key.

Residual work: independently review key entropy, hash construction,
constant-time comparison, rotation races, log redaction, and every endpoint
that accepts a publishable key before beta publication.

## Tenant isolation

Threats include insecure direct object references, accepting a caller-supplied
project ID without checking the session, cross-tenant joins, and analytics
queries without a mandatory tenant predicate.

Current controls:

- Core service methods call project/organization permission checks before
  tenant reads and writes; key-derived sessions contain only the resolved
  project.
- Foreign keys and unique constraints preserve project ownership and
  idempotency invariants.
- Cloud analytics queries use dedicated least-privilege users and compiler-
  injected project predicates. Self-host creates separate read-write,
  read-only, and analytics-query users when ClickHouse is enabled.
- The private operations plane and staff authorization are absent from this
  repository and from the product backend.
- Integration suites exercise forbidden access across API keys, paywalls,
  locations, perks, persons, feature flags, analytics, and AI workspace tools.

Residual work: produce an endpoint-to-authorization matrix and run a beta
cross-tenant test for every management RPC and HTTP route, including nested
resource IDs whose project is loaded only after the first lookup.

## Webhooks and payment verification

Threats include forged provider messages, replay, timestamp bypass, wrong-app
or wrong-project events, duplicate financial transitions, and retry behavior
that loses or amplifies events.

Current controls:

- Stripe verifies the signature over the exact raw body and enforces its
  timestamp tolerance. Tests reject wrong signatures, stale timestamps, and
  malformed signature headers.
- WorkOS verifies its signed raw body and timestamp, records the external event
  ID under a uniqueness constraint, and treats processed redelivery as a no-op.
- Apple verifies signed JWS data and application identity through the App Store
  SDK. Google Play re-fetches authoritative purchase state before applying an
  RTDN.
- Purchase-ledger and notification tables use idempotency/uniqueness keys, and
  provider engines test duplicate delivery behavior.
- Terminal verification/business failures are acknowledged while transient
  infrastructure failures return retryable status codes.

Open publication blocker:

- The Google Play RTDN route currently validates the payload and authoritative
  Play state but does not authenticate the Pub/Sub push caller. Before public
  beta, require and verify Pub/Sub OIDC identity (or an equivalently strong
  per-subscription secret) and add missing, malformed, wrong-audience, and
  replay tests.

Beta must also close the deferred Apple signed-JWS negative and replay cases
that currently require provider fixtures or a verification seam.

## Object storage and public artifacts

Threats include object-key traversal, overwrite of another tenant's object,
active content under the authenticated API origin, content-type confusion, and
leaking private object-store credentials.

Current controls:

- Released paywall/component artifacts are immutable and addressed by a
  validated SHA-256 content hash. Serving rejects empty and traversal-like key
  segments.
- Tenant-authored paywall HTML is returned with CSP
  `sandbox allow-scripts allow-forms`, `nosniff`, and `no-referrer`, giving it
  an opaque origin without API cookies.
- Public image files are content-addressed; avatar inputs validate supported
  image type, magic bytes, non-empty content, and size before storage.
- Artifact and public buckets are separate platform services. Credentials are
  supplied only to the backend runtime, not the compiler.

Residual work: verify bucket IAM, overwrite policy, maximum object sizes, SVG
handling, cache poisoning resistance, and browser behavior for every served
content type in both cloud and self-host deployments.

## Analytics ingest

Threats include forged project tokens, oversized batches, reserved financial
events from untrusted clients, quota bypass, duplicate/replayed events,
cross-tenant query access, and poison messages causing unbounded retries.

Current controls:

- Capture validates publishable token format and project resolution before
  queue publication, applies per-project request/event policy, and returns
  bounded retry guidance.
- Public-key capture rejects reserved revenue event names. Processing validates
  route/lane, target project, schema, and policy; rejected events go to a DLQ.
- Writer and read paths deduplicate event IDs, while queue consumers have batch,
  retry, and dead-letter limits.
- Tests cover malformed tokens, disabled ingest, request limits, reserved
  events, project mismatch, invalid lanes/schema, DLQ replay, and duplicate
  event IDs.

Residual work: fuzz batch/body limits and timestamps, verify client-IP trust at
every reverse proxy, load-test quota atomicity, and independently review the
compiled analytics-query tenant predicate.

## SSR, rendering, and browser automation

Threats include server-side request forgery, XSS under a privileged origin,
cookie leakage, unbounded rendering work, and Chromium compromise.

Current controls:

- Public paywall HTML uses an opaque CSP sandbox and immutable content hashes.
- Rendering and screenshot capabilities are platform ports, keeping privileged
  infrastructure adapters outside tenant application code.
- Paywall manifests and preview trees are schema-validated before release.
- The runtime runs as an unprivileged user in the self-host image.

Residual work: enumerate every URL Chromium may navigate to, deny private and
link-local address ranges, apply navigation/time/resource budgets, and test
redirect/DNS-rebinding cases. Chromium currently runs with its sandbox disabled
inside the container, so container isolation and image patching are part of the
security boundary and require independent review.

## Component compiler sandbox

Tenant component modules execute during manifest extraction, so the compiler
container—not Node's VM API—is the confidentiality and host-integrity boundary.

Current controls:

- Only modules in the explicit paywall sandbox registry can be imported.
- Module evaluation runs in a VM context with string/Wasm code generation
  disabled and a 500 ms synchronous execution budget.
- Request bodies are capped at 1 MiB and compiler concurrency is limited.
- Self-host runs the compiler as an unprivileged user with a read-only root
  filesystem, dropped Linux capabilities, `no-new-privileges`, a PID limit, and
  a private internal Docker network shared only with the application. It does
  not receive database, object-store, WorkOS, or payment credentials.
- Cloud invokes a dedicated container through a Durable Object boundary and
  bounds the caller's compile round trip.

Residual work: independently test container escape resistance, host-object VM
escape attempts, memory bombs, asynchronous work, file reads, internal-service
SSRF, crash/restart behavior, and concurrent denial of service. Apply explicit
memory/CPU quotas in each production deployment and keep the compiler image and
Node runtime patched.

## Self-host operator boundary

The sample Compose defaults are for loopback evaluation only. They include
known passwords and placeholder WorkOS credentials. Exposing that composition
unchanged would compromise all stored data.

Before any non-local deployment, the operator must replace every example
password, configure HTTPS at the reverse proxy, restrict MinIO/Mailpit/
ClickHouse host ports, configure CORS and public URLs, use real WorkOS and SMTP
credentials, back up persistent volumes, and apply host/container updates.

Open publication blocker: add a production mode that refuses known example
credentials and insecure public URLs, while retaining an explicit opt-in local
evaluation mode for the documented quick start.

## Publication risk register

| ID | Severity | Status | Required evidence |
| --- | --- | --- | --- |
| VH-TM-001 | High | Open | Authenticate Google Pub/Sub push and pass negative/replay tests. |
| VH-TM-002 | High | Open | Refuse self-host example credentials outside explicit local evaluation mode. |
| VH-TM-003 | High | Mitigated, review pending | Compiler VM budget and container/network hardening pass adversarial and independent review. |
| VH-TM-004 | High | Open | Chromium navigation/SSRF policy and resource budgets pass redirect and private-network tests. |
| VH-TM-005 | High | Open | Endpoint authorization matrix has complete cross-tenant negative coverage. |
| VH-TM-006 | Process gate | Open | Real beta traffic and security-log/incident review completed. |
| VH-TM-007 | Process gate | Open | Independent reviewer signs off and residual risks have owners/deadlines. |

Repository visibility must not change while a High item is open. Accepted
residual risk must be recorded with an owner, deadline, and rationale in this
table; changing a severity or closing an item requires review evidence.
