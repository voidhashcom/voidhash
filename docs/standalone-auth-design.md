# Standalone auth: self-host without WorkOS

> **Status: implemented, with one part superseded.** The auth provider described
> here is current. The `SELFHOST_MODE` gating and the Docker Compose self-host
> stack it refers to have since been removed along with the Node runtime; the
> only supported composition is the Alchemy/Cloudflare one in
> `docs/cloudflare-deployment.md`. Read those parts as historical context.
>
> Supersedes and replaces `docs/dev-auth-design.md`
> (the "make WorkOS optional" dev-auth design), which is deleted. The port
> structure that work introduced is the foundation here; the local provider it
> added is redesigned from a development-only convenience into the one and only
> self-host auth mode. Where the implementation diverged from this plan it has
> been updated in place; see "Deviations from the plan" at the end.

## Direction change

The dev-auth work made WorkOS *optional for development*: an email-assertion
provider, loopback-only, hard-refused in `SELFHOST_MODE=production`. Real
self-host deployments still required BYO WorkOS ("Community Edition v1
intentionally uses BYO WorkOS").

New direction:

- **Self-host is standalone in every mode, including production.** No WorkOS
  dependency, credential, or code path anywhere in the OSS repo.
- **Self-host is single-player, for now.** Exactly one user — root — whose
  username and password come from environment variables. There is no sign-up,
  no invitation, and no code path that can create a second user.
- **WorkOS moves entirely to voidhash-mono** and serves only the hosted cloud.
  The OSS repo keeps the provider-neutral ports (`IdentityProvider`,
  `AuthTokenVerifier`, the org directory port); mono plugs its WorkOS
  implementations into them from its own tree, exactly as it already does for
  Cloudflare platform adapters.

Non-goals (for now):

- Multi-user self-host. The ports deliberately leave room for a community
  OIDC/generic provider later, but nothing in this design builds toward it.
- Password management UX: no reset flow, no change-password UI. The password
  lives in `.env`; rotating it is an operator action.
- Session revocation lists / refresh tokens. One signed session token with a
  fixed TTL, like the dev design.

## What survives from the implemented dev auth

Most of it. The dev-auth implementation (uncommitted on this branch) already
built the right seams:

| Piece | Fate |
| --- | --- |
| `IdentityProvider` port + consumers (`AuthSessionResolver`, `ApiMiddlewares`, `mcp.ts`, `AgentNodeWebSocket`) | **Keep unchanged** |
| `AuthTokenVerifier` port | **Keep**; `provider` field widens (see §4) |
| HS256 token module (`local-auth-token.ts`) | **Keep**; rename, constant `root` subject |
| `LocalOrgDirectory` (synthesized `local_org_` / `local_mem_` ids, no migration) | **Keep**; rename `StandaloneOrgDirectory` |
| Lazy user creation via `resolveLocalUser` | **Keep** |
| www session seam (`session.ts`, `local-session.ts`, `AccessTokenBridge`) | **Keep shape**; loses the AuthKit fallback branch |
| `/api/auth/dev/*` mint endpoints, email-assertion sign-in | **Replaced** by credential-checked `/api/auth/*` |
| `AuthMode.ts` resolution matrix, `VOIDHASH_AUTH_MODE`, dev-signal allowlist | **Deleted** — OSS has exactly one provider |
| `UnconfiguredWorkosLive` | **Deleted** (dies with `Workos` leaving `InfraServices`) |
| `Workos.ts`, `WorkosIdentityProvider.ts`, webhook route, `McpAuthKit`, JWKS verifier | **Moved to mono** (§5) |

Naming: "local" implied loopback-only development. The mode is now called
**standalone**; the uncommitted `Local*` auth files are renamed `Standalone*`
while the rename is still free.

## 1. The standalone provider

### Environment

```
VOIDHASH_ROOT_USERNAME   root user login name.
                         local-evaluation default: "root"; production: required.
VOIDHASH_ROOT_PASSWORD   root user password.
                         local-evaluation default: a well-known dev constant;
                         production: required, placeholder-rejected.
VOIDHASH_ROOT_EMAIL      optional; default "root@voidhash.local". Display +
                         SMTP identity for the root user row.
VOIDHASH_AUTH_SECRET     HS256 session signing secret (renames
                         VOIDHASH_LOCAL_AUTH_SECRET).
                         local-evaluation default: the well-known dev constant;
                         production: required, placeholder-rejected.
```

This mirrors the existing `MIMIC_ROOT_USERNAME` / `MIMIC_ROOT_PASSWORD`
precedent. The `local-evaluation` defaults preserve the zero-config compose
quick start (sign in as `root` with the documented dev password on loopback —
the same trust model the email-assertion form had). In `production`,
`validateSelfhostSecurityConfig` rejects missing or example values through the
existing `isExampleSecret` machinery, replacing the deleted `WORKOS_*` checks.

### Identity

- The JWT subject is the constant `root` — not derived from the email. It lands
  in `user.workos_user_id` as today (fits `varchar(64)`; column naming debt is
  §6). A stable subject means changing `VOIDHASH_ROOT_EMAIL` or the username
  later updates the *same* user row via `resolveLocalUser`'s
  match-by-provider-id-then-email logic instead of creating a new identity.
- Identity fields: `email` from env, `emailVerified: true`, `firstName` =
  username, `image: null`.
- Single-player is enforced structurally: the standalone provider is the only
  identity source, and it can only ever emit the root identity, so
  `resolveLocalUser`'s insert path can only ever create one row. No membership
  invitation surface exists in OSS (`OrganizationMembershipSyncPort.noop`
  stays; invite/role flows remain `ee/` in mono).
- Organizations are untouched: root creates and owns organizations through the
  normal UI; `StandaloneOrgDirectory` keeps satisfying the `NOT NULL` provider
  columns with synthesized ids. Single-player means one *user*, not one org.

### Sign-in flow

Endpoints move out of the `dev` namespace (they are no longer a development
affordance) and gain credential verification:

- `POST /api/auth/sign-in { username, password, returnPathname? }` — verify
  both against env with a constant-time comparison (SHA-256 both sides, then
  the existing `constantTimeEquals`); on success mint the HS256 JWT (30-day
  TTL) and return `{ accessToken, redirectTo }` plus `Set-Cookie`. On failure:
  401 with no detail about which field was wrong.
- `GET /api/auth/session` — verified claims + raw token from the cookie, or
  `null` (unchanged behavior, renamed).
- `POST /api/auth/sign-out` — clear the cookie.

Brute-force throttling: a small in-process limiter on `sign-in` (e.g. fixed
backoff after 5 consecutive failures per source IP, reset on success). The
selfhost entry is a single Node process, so in-memory state is correct today;
if the cluster composition ever serves www, move the counter to Postgres.

Cookie renames `vh-local-session` → `vh-session`; same attributes (HttpOnly,
SameSite=Lax, Secure when the request is HTTPS, Max-Age 30 days). The token
remains both cookie value and bearer token, so the single-verifier design and
the split-origin dev story are unchanged. www-side minting stays stateless —
the www server process reads the same `VOIDHASH_ROOT_*` env.

### www UI

- `/auth/login` renders a username + password form (replaces the email form in
  `local-sign-in-form.tsx`). In `local-evaluation` with default credentials
  active, the form shows the defaults as a hint — zero-config quick start stays
  one screen.
- `/auth/sign-up`, `/auth/verify-email`, `/auth/forgot-password`,
  `/auth/reset-password` redirect to `/auth/login` (as the local mode does
  today) — later these routes are supplied by the cloud overlay only (§5).
- `AccessTokenBridge` simplifies: read `/api/auth/session`; the AuthKit
  fallback branch moves into the cloud adapter (§5).

## 2. Auth-mode machinery: deleted

With one provider in OSS there is nothing to resolve:

- `VOIDHASH_AUTH_MODE`, `AuthMode.ts` (`resolveAuthMode`, credential sniffing,
  the `SELFHOST_MODE=local-evaluation` / `NODE_ENV` dev-signal allowlist) and
  its tests are deleted. The subtle fail-open/fail-closed analysis that
  motivated the allowlist becomes moot: standalone is *supposed* to run in
  production, and its production gate is "real credentials configured", not
  "mode forbidden".
- `SelfhostAuthConfig` collapses to
  `{ rootUsername, rootPassword: Redacted, rootEmail, secret: Redacted }`.
- www routes lose every `resolveAuthMode()` branch; `authkitMiddleware` leaves
  `start.ts` (cloud installs it via the adapter, §5).
- `validateSelfhostSecurityConfig` production checks: drop the four `WORKOS_*`
  placeholder checks and the `WORKOS_REDIRECT_URI` HTTPS check; add
  `VOIDHASH_ROOT_USERNAME`, `VOIDHASH_ROOT_PASSWORD`, `VOIDHASH_AUTH_SECRET`.
  Drop the "local auth is not allowed in production" refusal entirely.

## 3. Backend: evict WorkOS from the shared graph

The one structural change: **`Workos` leaves `BackendApp.InfraServices`**
(`packages/backend/src/BackendApp.ts:177-178`). The dev-auth work kept it there to
avoid pushing the webhook route's request-time deps onto composition roots;
with the route itself leaving OSS, the reason evaporates. Consequences:

- `UnconfiguredWorkosLive` is deleted (it existed only to satisfy the union).
- The `workosWebhooks: boolean` flag on `BackendRuntimeLayers` generalizes to a
  proper route extension — `routeExtension?: Layer` next to the existing
  `rpcExtension` — and mono mounts its WorkOS webhook receiver (and MCP OAuth
  discovery, below) through it. OSS passes nothing.
- MCP: the standalone composition keeps the already-WorkOS-free project
  secret-key and user API-key paths. `McpAuthKit` + `routes/mcp-authkit.ts`
  (RFC 9728 discovery) move to mono and mount via the route extension; the
  OAuth bearer path simply doesn't exist in OSS (today's "MCP OAuth is not
  configured" 503 becomes the only OSS behavior).
- `AuthTokenVerifier`'s `ValidatedJwtSchema.provider` widens from
  `Schema.Literals(["workos", "local"])` to `Schema.String`. Trust derives from
  which verifier validated the token, not from the tag; OSS stamps
  `"standalone"`, mono stamps `"workos"`, and OSS no longer enumerates
  proprietary providers in a shared schema.

Provider-neutral pieces that only *sound* like WorkOS get renamed, not moved
(zero coupling in their bodies):

- `WorkosOrgPort` → `OrgDirectoryPort` (+ `WorkosPort*` types, error).
- `WorkosLocalSyncService` → `IdentityLinkBackfillService` (or similar) — its
  deps are `LocalUserSessionService`, `OrganizationMembershipSyncPort`,
  `IdentityProvider` only.
- `apps/www/src/features/auth/lib/workos.ts` → `sign-out.ts`.
- Telemetry attributes `voidhash.user.workos_id` /
  `voidhash.organization.workos_id` → `voidhash.user.external_id` /
  `voidhash.organization.external_id`.

## 4. What moves to mono, concretely

Pure adapters, ~940 LOC total, four files importing `@workos-inc/node` in the
whole repo:

| OSS file | Destination |
| --- | --- |
| `packages/core/src/services/auth/Workos.ts` (369) | mono `stacks/backend/infrastructure/` (its `Workos.ts` layer factory already wraps this — the service definition simply relocates next to it) |
| `packages/core/src/services/auth/WorkosIdentityProvider.ts` (48) | mono, same home |
| `apps/backend/src/routes/webhooks/workos.ts` (314) | mono, mounted via `routeExtension`; the `workos_webhook_event` idempotency table stays in the shared schema for now (§6) |
| `apps/backend/src/McpAuthKit.ts` + `routes/mcp-authkit.ts` (179) | mono, mounted via `routeExtension` |
| `selfhost/entry/src/backend/AuthTokenVerifier.ts` (JWKS, 55) | **delete** — mono already has the `JwtAuth` DO + `AuthTokenVerifierLive` adapter |
| `selfhost/entry/src/backend/Workos.ts` (`WorkosOrgPortLive`, 77) | **delete** — mono already has its own `WorkosOrgPortLive` in `BackendWorker.ts` |
| `apps/www/src/features/auth/lib/workos-user-management.server.ts` (355) | mono www overlay, minus the generic HTTP helpers (`jsonResponse`, `getJsonBody`, safe-return-path), which split into an OSS `http.server.ts` module first — the standalone auth routes use them too |
| `apps/www/src/routes/api/auth/{callback,email/*,oauth/*,password/*}.tsx` (~570 across 9 files) | mono www overlay routes |

Dependency deletions in OSS: `@workos-inc/node` from `packages/core` and
`packages/backend`; `@workos-inc/node` + `@workos/authkit-session` +
`@workos/authkit-tanstack-react-start` from `apps/www`; the five WorkOS subpath
exports from `packages/core/package.json`; `WORKOS_AUTHKIT_DOMAIN` from
`turbo.json`; the `WORKOS_*` block from `.env.example` and
`docker-compose.yml`.

## 5. The www auth seam (the delicate part)

Mono's cloud dashboard is the OSS www app plus a thin private overlay:
`voidhash-mono/apps/www/vite.config.ts` merges route trees (OSS routes + mono
routes) and already aliases four OSS "slot" modules to private
implementations. **The cloud login UI currently lives in OSS www** — so
removing WorkOS from OSS requires an explicit seam, and the slot-alias
mechanism is exactly it:

- OSS www gains one module, e.g. `features/auth/auth-adapter.ts`, the fifth
  slot. It exports the small surface the app shell needs:
  `getSessionUser()` (server), `signOutAction`, the login page body component,
  the browser access-token source consumed by `AccessTokenBridge`, an optional
  root `Provider` component (OSS default: passthrough), and the optional
  server middleware list for `start.ts` (OSS default: empty).
- The OSS default adapter implements standalone auth (verify `vh-session`,
  username/password form, `/api/auth/*` endpoints).
- Mono aliases the adapter to its WorkOS/AuthKit implementation. The AuthKit
  packages become dependencies of mono's `apps/www` overlay only. Mono's
  overlay also contributes its own `/api/auth/*` WorkOS routes
  (callback/oauth/password/email) through the existing route-tree merge — no
  path conflicts, because OSS deletes those routes rather than branching them.
- Routes that exist in both worlds but render differently (`/auth/login`,
  `/auth/logout`, and the sign-up/verify/forgot/reset redirects) stay OSS-owned
  and render through the adapter, so the route tree itself never forks.

Verification item for Phase 3: confirm the mono route-tree merge cleanly
handles the overlay *adding* auth API routes and that nothing in the OSS tree
still imports AuthKit at build time (the vite `noExternal` /
`optimizeDeps.exclude` entries move to the mono config).

## 6. Schema: keep the columns, schedule the rename

Standalone mode continues writing synthesized ids into `user.workos_user_id`
(`root`), `organization.workos_organization_id` (`local_org_…`), and
`member.workos_membership_id` (`local_mem_…`). **No migration in this
design** — the dev-auth decision holds.

The rename (`workos_*_id` → `external_*_id`, `workos_webhook_event` →
provider-neutral) is real debt but a separate decision: `workosUserId` is
surfaced in `packages/api-contracts`, `packages/rpc`, the generated OpenAPI
document, and ~45 test fixtures, so renaming is an API-breaking change that
needs its own compatibility window. Do not bundle it into this effort.

## 7. Security model

- Production requires real root credentials and a real signing secret
  (placeholder-rejected), plus the existing HTTPS checks on public URLs.
  There is no mode in which a network-accessible deployment can run with
  assertable identity — the property the dev design's allowlist protected is
  now structural.
- Anyone with the root password is root; the threat model section on the local
  provider is rewritten accordingly (`docs/security/backend-threat-model.md`):
  credential strength is the operator's responsibility, transport security
  comes from the HTTPS requirement, sign-in is throttled, comparisons are
  constant-time.
- `GET /api/auth/session` returning the raw token to same-origin scripts is
  inherited from the dev design (needed for the browser bearer path and
  split-origin dev). Acceptable for v1; narrowing it is an open question.
- The well-known dev defaults for password and signing secret are reachable
  only in `SELFHOST_MODE=local-evaluation`, which the README already restricts
  to loopback — the same containment the dev secret had.

## 8. Testing

- Rework `selfhost/entry/tests/LocalAuth.integration.test.ts` into the
  standalone matrix: correct credentials → cookie + bearer round-trip; wrong
  password/username → 401; throttle kicks in after N failures; production
  boot with placeholder credentials refused; org creation; paywall edit token;
  the existing lazy-user-row assertions with `sub = "root"`.
- `AuthMode.test.ts` is deleted with its subject. `SecurityConfig.test.ts`
  swaps WorkOS placeholder cases for root-credential cases.
- Test-stub convergence stops being optional: `TestWorkosLive`,
  `TestRealWorkosLive`, and the WorkOS half of `TestRpcAuthLive` cannot stub a
  service that no longer exists in OSS. OSS test auth converges on the
  standalone provider (the production code path); the WorkOS webhook smoke in
  `rpc-smoke.integration.test.ts` moves to mono with the route.
- The injected harness contract `coreStackOutput.testConnections.workos`
  becomes mono-optional: the OSS harness drops it; mono keeps supplying WorkOS
  connections to its own `ee/` and webhook suites.
- www: login-form component test; session round-trip; removed WorkOS routes
  are gone from the OSS route tree (typecheck enforces this better than 404
  tests).

## 9. Config and docs cleanup (rides Phase 1)

- `.env.example`: delete the `WORKOS_*` block; add `VOIDHASH_ROOT_USERNAME`,
  `VOIDHASH_ROOT_PASSWORD`, `VOIDHASH_ROOT_EMAIL`, `VOIDHASH_AUTH_SECRET`;
  rewrite the stale trailing note that still claims WorkOS is required to sign
  in.
- `selfhost/README.md`: the "Identity providers" section shrinks to the
  standalone story (production-grade, single-player, env credentials); the
  quick start text changes from "enter any email address" to the root
  credentials; the provider-switching section is deleted.
- Fix two pre-existing self-host bugs found while auditing (they bite the new
  design's production story directly):
  1. The production compose `migrate` service only receives the database env
     anchor, so `SELFHOST_MODE=production` migration runs fail
     `validateSelfhostSecurityConfig` regardless of the operator's `.env`
     (missing S3/model-key/public-URL vars).
  2. `scripts/run-local-integration.mjs` copies `.env.example` (which sets
     `SELFHOST_MODE=production` with placeholder secrets) to `.env` on first
     checkout and boots the stack with it — a fresh-checkout
     `pnpm test:integration` refuses to start. The script should pin
     `SELFHOST_MODE=local-evaluation` for the stack it manages.
- Consolidate the duplicated placeholder-secret predicates
  (`config.ts` `isExampleSecret` vs `AuthMode.ts` `isPlaceholderSecret`) into
  one exported helper as `AuthMode.ts` is deleted.

## 10. Rollout

Phases 1–2 are OSS-only and independently shippable; Phase 3 must land in both
repos together.

1. **Provider conversion (OSS).** Rename `local` → `standalone`; root
   credentials + constant `root` subject; credential check + throttle on the
   renamed `/api/auth/*` endpoints; cookie rename; login form; production
   gates flipped (§2, §7); config/docs cleanup (§9). WorkOS mode still exists
   and still works. Deliverable: a self-host deployment runs standalone auth
   in `SELFHOST_MODE=production`.
2. **Backend eviction (OSS + trivial mono bump).** `Workos` out of
   `InfraServices`; `routeExtension`; move/delete the backend adapters per §4;
   delete `UnconfiguredWorkosLive` and the selfhost workos branch
   (`makeSelfhostAuthLayers` collapses); provider-neutral renames (§3). Mono
   relocates `Workos.ts` + webhook + `McpAuthKit` into its tree and mounts
   them via `routeExtension` — its `BackendWorker` already provides every
   WorkOS layer itself.
3. **www seam (both repos).** Auth adapter slot; OSS deletes the AuthKit
   surface and WorkOS API routes; mono overlay supplies the WorkOS adapter +
   routes. Full cloud login regression (password, OAuth, email verification,
   callback, sign-out, Overwatch admin gate — Overwatch reuses `/auth/login`).
4. **Cleanup.** Threat-model rewrite, telemetry attribute rename, harness
   contract change, delete dead fixtures. The schema column rename stays
   parked (§6).

## 11. Open questions

1. **Signing-secret ergonomics**: require `VOIDHASH_AUTH_SECRET` in production
   (proposed), or auto-generate one at first boot and persist it in Postgres
   for a zero-config production path? Auto-generation is strictly nicer but
   adds a migration and a bootstrap ordering constraint.
2. **Raw-token exposure** via `GET /api/auth/session`: keep (needed for the
   browser bearer path today) or move the browser to cookie-authenticated RPC
   and stop returning the token?
3. **Cloud login UI shape** (mono-side, Phase 3): keep the ported custom
   WorkOS UI (password/oauth/email routes, ~925 LOC) or switch the cloud to
   AuthKit's hosted page and shrink the overlay to middleware + callback +
   session? Strong lean toward hosted AuthKit — it deletes most of what Phase
   3 would otherwise move.
4. **Multi-user self-host later**: when it returns, is it a generic OIDC
   `IdentityProvider` implementation (community-friendly) or a first-party
   username/password user table? The ports support either; nothing in this
   design should prejudge it beyond keeping `resolveLocalUser` intact.
5. **`VOIDHASH_ROOT_USERNAME` vs email-as-login**: username chosen to match
   the `MIMIC_ROOT_*` precedent and to avoid implying the login is a routable
   mailbox. Revisit if it confuses operators.

## Deviations from the plan

1. **The www seam is two slots, not one.** `session-adapter.ts` (server: session
   read, sign-out, request middleware) and `ui-adapter.tsx` (browser: screens,
   auth provider, bearer credential) are aliased separately, so `start.ts` does
   not pull the React screen tree into the server boot path. A third module,
   `adapter/auth-screens.ts`, holds the contract types: an aliased module cannot
   export the types its replacement needs to import without the replacement
   re-entering itself.

2. **Auth screens are a record, not per-route exports.** `authScreens`
   (`login`, `signUp`, `verifyEmail`, `forgotPassword`, `resetPassword`) keeps
   the five route files generic — each renders its screen or redirects to
   `/auth/login` when the slot is `null`. Self-host fills only `login`. The
   screens own their page chrome through the shared `AuthScreenLayout`, so the
   hosted screens ported over from the previous route files almost verbatim.

3. **MCP OAuth became a port instead of being dropped.** Deleting the JWT branch
   would have regressed the hosted cloud, which has working MCP OAuth. Instead
   `McpOAuth` is a provider-neutral port in the open-source backend with an
   `McpOAuthUnconfiguredLive` default (discovery reports 503, JWT bearers are
   refused, key auth still works); the AuthKit implementation moved to mono and
   is supplied through a new `mcpOAuth` layer input. `routes/mcp-authkit.ts`
   stayed in the open-source tree as `routes/mcp-oauth.ts` rather than moving.

4. **`routeExtension` had to admit deferred request requirements.** Raw routes
   registered on `HttpRouter` surface their service needs as
   `HttpRouter.Request<…>` entries that resolve at request time, so the input is
   typed `Layer<never, never, HttpRouter | HttpRouter.Request<string, unknown>>`
   and is merged into the built-in webhook layer, which already gets
   `HttpRouter.provideRequest`.

5. **The enterprise features bundle takes an `identityDirectory` layer.** With
   `Workos` out of `InfraServices`, the membership webhook port in `ee/` no
   longer receives it from the backend's infrastructure graph, so
   `makeEnterpriseBackendFeatures` gained an explicit input that the composition
   root supplies.

6. **WorkOS lives in a new mono package.** `@voidhash-mono/workos` holds the
   service, identity-provider adapter, org directory, webhook route, and AuthKit
   MCP implementation, because both `stacks/` and `ee/org-management` import it
   and a leaf package avoids a cycle. The self-host JWKS verifier and the
   self-host org-directory adapter were deleted rather than moved — mono already
   had its own of each.

7. **`coreTestConnections.workos` was removed outright**, not made optional. The
   contract documents that a composition may inject a structural superset, so
   the hosted harness keeps supplying WorkOS credentials to its own suites
   without the open-source contract naming them.

8. **The evaluation defaults are `root` / `voidhash`.** A password default was
   needed to keep the zero-config quick start one screen; production
   placeholder-rejection is what makes it safe.

## Follow-ups not done here

- The WorkOS webhook smoke (four cases previously in the open-source
  `rpc-smoke.integration.test.ts`) was removed from the open-source suite with
  the route, but has not been rebuilt on the hosted side — it needs a mono
  integration project wired to the shared harness. The route itself moved
  unchanged.
- The `workos_*` column rename remains parked (§6).
