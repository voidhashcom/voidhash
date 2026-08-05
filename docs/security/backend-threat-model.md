# Backend Threat Model

Status: alpha review draft  
Last updated: 2026-07-12<br>
Scope: `packages/backend`, `apps/mimic-db`, `apps/www`, `packages/core`, and
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

Protected assets include dashboard sessions, user and project API keys, payment
provider credentials, webhook signing secrets, tenant database rows,
ClickHouse events, Mimic documents and document tokens, unpublished paywall
artifacts, object-store credentials, and compiler/container integrity.

Relevant actors are anonymous internet clients, SDK clients holding a
publishable key, users holding a dashboard session or user API key, server
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
- Session cookies are authenticated by the active `IdentityProvider` adapter,
  which also owns the cookie name the method selector matches on; local access
  is loaded from server-side membership state.
- Project secret keys establish a session containing only their project.
  Publishable keys establish an SDK identity with no management permissions.
- MCP accepts a Bearer project secret key or user API key and constructs the
  corresponding project-scoped session used by the HTTP API. User-key project
  selection is restricted to the key owner's current memberships.
- Authentication failures collapse to non-authenticated or generic internal
  errors rather than returning stored credential details.

Evidence includes API-key integration tests for disabled/expired keys and
forbidden mutation, RPC smoke coverage, MCP protocol/dispatch tests, and
standalone sign-in tests.

Residual work:

- Beta must add explicit cookie fixation, malformed-cookie, revoked-membership,
  and authentication-method-confusion tests.
- The session-cookie name is read from `IdentityProvider.cookieName` by both the
  method selector and the session resolver, so a provider that issues a
  differently named cookie needs no change at either site.

### Standalone identity provider

Self-host authenticates a **single root account** whose username and password
come from `VOIDHASH_ROOT_USERNAME` and `VOIDHASH_ROOT_PASSWORD`. There is no
sign-up and no code path that can mint a second identity: the provider only
ever emits the root subject, so single-user is a structural property rather
than a policy. Sessions are HS256 tokens signed with `VOIDHASH_AUTH_SECRET`,
used as both the `vh-session` cookie and the API bearer token.

Trust rests on the root password and on transport security, so the controls are:

- Credentials are compared in constant time, after hashing both sides so the
  comparison cannot leak the configured password's length.
- Sign-in is throttled per source address: five consecutive failures trigger a
  fixed lockout, and a failed attempt never reveals which field was wrong.
- `validateSelfhostSecurityConfig` refuses to start a production deployment
  whose root password or signing secret is missing or still an evaluation
  default, before migrations or the application run.
- Production mode requires HTTPS public, file, and Mimic URLs, so the bearer
  token and cookie are not exposed in transit.
- The session endpoint returns the raw token to same-origin scripts so the
  browser can seed its bearer credential from an `HttpOnly` cookie. This
  deliberately trades XSS-hardening for a single token pipeline; a successful
  XSS on the dashboard origin already implies session compromise.

The documented evaluation defaults (`root` / `voidhash` and the shared signing
secret) are public knowledge and reachable only under
`SELFHOST_MODE=local-evaluation`, which the self-hosting guide restricts to
loopback.

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

The machine-checked `endpoint-authorization-matrix.md` inventories every HTTP
and RPC contract operation plus raw routes and maps each group to its principal,
stored-resource authorization boundary, and evidence. Contract drift fails a
backend test. Database-backed suites now exercise every experiment and push-
notification configuration/history operation, including nested foreign IDs and
no-mutation assertions. Remaining publication work is explicit in the matrix:
add database-backed cross-tenant negatives for the rows still marked Unit.

## Webhooks and payment verification

Threats include forged provider messages, replay, timestamp bypass, wrong-app
or wrong-project events, duplicate financial transitions, and retry behavior
that loses or amplifies events.

Current controls:

- Stripe verifies the signature over the exact raw body and enforces its
  timestamp tolerance. Tests reject wrong signatures, stale timestamps, and
  malformed signature headers.
- A composition that mounts an identity-directory webhook through the backend's
  route extension is responsible for its own signature verification; the shared
  event table records the external event ID under a uniqueness constraint so
  processed redelivery is a no-op.
- Apple verifies signed JWS data and application identity through the App Store
  SDK. Google Play RTDN verifies the Pub/Sub OIDC signature, issuer, lifetime,
  configured audience, verified email claim, and configured push service
  account before parsing the envelope, then re-fetches authoritative purchase
  state before applying a notification.
- Purchase-ledger and notification tables use idempotency/uniqueness keys, and
  provider engines test duplicate delivery behavior.
- Terminal verification/business failures are acknowledged while transient
  infrastructure failures return retryable status codes.

The Google RTDN route fails closed with a retryable response when authenticated
push settings are absent. Verifier tests cover missing/malformed authorization,
tampered signatures, wrong issuer/audience/service account, unverified email,
and expired tokens. Route tests prove rejected requests cannot reach payload
processing. Existing Google payment-provider integration tests exercise
message-level duplicate delivery against the notification/ledger uniqueness
gates; OIDC tokens themselves are intentionally reusable during their short
lifetime.

Apple's cryptographic negative coverage runs signed fixtures through the real
certificate-chain and WebCrypto verification path, then rejects tampered
signatures/payloads, wrong bundle IDs, wrong environments, malformed JWS data,
and invalid chains (`verification.test.ts`, `jws-signature-tamper.test.ts`).
Database integration tests prove duplicate notification UUIDs are insert-once
and duplicate logical purchase events are ledger-idempotent. Beta still must
observe and review real Apple sandbox delivery/retry behavior as part of the
general real-traffic gate; it is no longer an untested automated-code gap.

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
- Self-host Chromium disables JavaScript, blocks service workers, switches each
  fresh context offline, and aborts every document/resource request before
  setting inline HTML. The Cloudflare Browser Run request rejects every external
  request pattern. Because no outbound navigation is permitted, redirects and
  DNS rebinding cannot reach private or link-local services.
- Both screenshot adapters cap HTML at 4 MiB, viewport edges at 4,096 pixels,
  scale at 4, and the rendered output at 16,777,216 pixels. Browser operations
  have a 15-second timeout and self-host thumbnail consumption is serialized
  with a bounded retry count.

Budget unit tests cover normal and oversized inputs. The real-Chromium test
attempts resource loads and a meta-refresh through a local redirect to the cloud
metadata address and verifies that the test server receives no request.
Chromium currently runs with its sandbox disabled inside the container, so
container isolation and image patching remain part of the security boundary and
require independent review.

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
  not receive database, object-store, identity, or payment credentials.
- Cloud invokes a dedicated container through a Durable Object boundary and
  bounds the caller's compile round trip.

Residual work: independently test container escape resistance, host-object VM
escape attempts, memory bombs, asynchronous work, file reads, internal-service
SSRF, crash/restart behavior, and concurrent denial of service. Apply explicit
memory/CPU quotas in each production deployment and keep the compiler image and
Node runtime patched.

## Self-host operator boundary

The sample Compose defaults are for loopback evaluation only. They include
known passwords and the documented default root credentials. Compose explicitly
marks the no-env quick start as `local-evaluation`; exposing that composition
unchanged would compromise all stored data.

Before any non-local deployment, the operator must replace every example
password, set real root credentials and a real session signing secret,
configure HTTPS at the reverse proxy, restrict MinIO/Mailpit/ClickHouse host
ports, configure CORS and public URLs, use real SMTP credentials, back up
persistent volumes, and apply host/container updates.

Production mode validates configuration before migrations or the application
start. It refuses missing and known example root credentials, session signing
secret, database, object-store, Mimic, and enabled ClickHouse credentials, and
requires HTTPS for every public, file, and Mimic URL. Tests cover explicit mode
selection, every credential class, optional ClickHouse, and every URL
boundary. Independent
review must still confirm the list remains complete as new infrastructure is
added.

## Publication risk register

| ID | Severity | Status | Required evidence |
| --- | --- | --- | --- |
| VH-TM-001 | High | Mitigated, review pending | Pub/Sub OIDC negative tests and payment-ledger duplicate-delivery tests pass; deployment settings and implementation require independent review. |
| VH-TM-002 | High | Mitigated, review pending | Production startup refuses known example credentials and insecure public URLs; configuration coverage requires independent review. |
| VH-TM-003 | High | Mitigated, review pending | Compiler VM budget and container/network hardening pass adversarial and independent review. |
| VH-TM-004 | High | Mitigated, review pending | Cloud and self-host browsers deny outbound requests and enforce time/input/output budgets; real-browser redirect/private-network coverage requires independent review. |
| VH-TM-005 | High | Mitigated, review pending | Machine-checked endpoint matrix is complete; database-backed negatives cover every tenant-selectable service group, including persisted chat-ID collisions and raw paywall IDs. |
| VH-TM-006 | Process gate | Open | Real beta traffic and security-log/incident review completed. |
| VH-TM-007 | Process gate | Open | Independent reviewer signs off and residual risks have owners/deadlines. |

Repository visibility must not change while a High item is open. Accepted
residual risk must be recorded with an owner, deadline, and rationale in this
table; changing a severity or closing an item requires review evidence.
