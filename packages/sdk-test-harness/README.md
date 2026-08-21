# @voidhash/sdk-test-harness

Spec-compatible conformance test harness for Voidhash SDKs. A single
TypeScript source of truth defines ordered request/response scenarios; every
SDK (Node, React Native today, iOS/Android native runners, future PHP/Java/Go/
Rust) replays the same wire contract against a local Effect-on-Node server,
which verifies everything shared — auth headers, required client headers,
paths, bodies, ordering, and error mapping.

## How it works

1. Suites (`src/suites/`) declare steps: an expected request (method, path,
   exact headers, require-only headers, exact body) and one or more scripted
   responses. Multiple responses are consumed in order, which models retries.
2. `startHarness()` boots the server on `127.0.0.1` with two surfaces:
   - Playback routes for every endpoint any suite targets.
   - A `/__harness` control plane:
     - `POST /__harness/sessions {"suite": "mobile/core"}` → `{sessionId,
       steps}` where `steps` are full descriptors so generic runners can
       replay without local fixtures.
     - `POST /__harness/sessions/:id/complete` → the session report
       `{pass, violations[]}`.
3. Runners execute the suite in order and then assert `report.pass`. One
   active session is allowed at a time; playback requests must carry the
   `x-harness-session` header.

Verification is strict-order and exact-match after normalization
(transport-controlled headers like `host`/`user-agent` are ignored, header
names compare case-insensitively, floats tolerate 1e-9 drift). Violations
include precise JSON pointers, so failures pinpoint the wire difference.

## Runners

| SDK | Command | Mechanism |
| --- | --- | --- |
| Harness self-tests | `pnpm test` | raw fetch replay + verifier unit tests |
| Node SDK | `pnpm --filter @voidhash/node test` | real SDK client in `libraries/node/tests/conformance.test.ts` |
| React Native SDK | `pnpm --filter @voidhash/react-native test` | real networking layer in `libraries/react-native/tests/conformance.test.ts` |
| iOS | `pnpm test:ios` | SwiftPM/XCTest runner in `runners/ios`, URLSession over live HTTP |
| Android (JVM) | `pnpm test:android` | Gradle Kotlin runner in `runners/android`, JDK HttpClient |

The iOS and Android runners are fully generic: they read step descriptors from
the control plane and never encode fixture data locally, so suites evolve
without touching them.

## Suites

| Suite | Scope |
| --- | --- |
| `api/core` | Schema + version, products, person create/fetch/list, entitlements, not-found mapping, 401 mapping |
| `api/auth` | Secret-key session introspection, invalid-key 401, forbidden-action 403 |
| `api/projects-orgs` | Organization & project create/list |
| `api/api-keys` | Secret key lifecycle (create/list/get/rotate/delete) + not-found mapping |
| `api/webhooks` | Endpoint CRUD, rotate-secret, test, delete; delivery list/get/retry; validation + not-found mapping |
| `api/catalog` | Perks, paywall locations, product perks, payment provider configurations/products |
| `api/notifications` | Server-to-server push send + not-enabled conflict |
| `api/paywall-deploys` | Deploy create (201), blob upload (binary PUT), finalize; hash-mismatch + incomplete-deploy errors |
| `mobile/core` | Publishable-key SDK flows: schema, identify, traits, flags, paywalls, transaction sync, 404 mapping |

A completeness guard (`tests/completeness.test.ts`) derives every
management-API endpoint from the committed OpenAPI document
(`packages/generated-clients/openapi/core.json`, everything outside `/sdk/*`)
and fails when an endpoint has no `api/*` suite step — or when a suite targets
a path the contract does not define. Adding a server endpoint without conformance
coverage breaks CI.

## Adding a suite

Export a new `ConformanceSuite` from `src/suites/`, register it in
`src/suites/index.ts`, and add its endpoints to playback by declaring them in
the suite's step paths (playback routes are derived automatically). Then map
the step ids to real SDK calls in each language-specific runner that drives an
actual SDK (TS runners); generic runners pick suites up automatically. The
completeness guard keeps the suite set honest against the contract.
