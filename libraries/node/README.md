# @voidhash/node

Server-side Voidhash SDK for Node.js. Wraps the Voidhash REST API with a typed
client and ships a webhook signature-verification helper.

This package is for **backends only** — it authenticates with a secret key.
Client apps use `@voidhash/react-native` instead.

```sh
npm install @voidhash/node
```

Requires Node 18+ (a global `fetch` must be available).

`require()` additionally needs **Node 20.19+ or 22.12+**. The CommonJS build
calls `require("effect")`, and `effect` v4 is ESM-only, so older runtimes throw
`ERR_REQUIRE_ESM` and a TypeScript project compiling to CommonJS reports
`TS1479` against the declarations. `import` has neither constraint.

## Secret key

Create a secret key in Studio under **Project settings → API keys**. Its value
is shown once, when you create it. A key belongs to one project, and can be
limited to some of that project's permissions.

Keep the key in an environment variable or your secret manager. Never ship it
to a browser, a mobile app, or a public repo.

A secret key is created as production (`vh_sk_…`) or test (`vh_sk_test_…`) and
keeps that [environment](https://voidhash.com/docs/concepts/api-keys)
for life. Use a test key in staging and tests, and a production key in
production.

## Client

```ts
import { createVoidhashSdk } from "@voidhash/node";

const voidhash = createVoidhashSdk({
  secretKey: process.env.VOIDHASH_SECRET_KEY!,
});
```

| Option           | Type                     | Default                       | Notes                                                                                              |
| ---------------- | ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `secretKey`      | `string`                 | —                             | Required. Sent as `Authorization: Bearer <secretKey>`.                                             |
| `projectId`      | `string`                 | the key's project             | Optional. The project every project-scoped call acts on; see [Project](#project).                  |
| `baseUrl`        | `string`                 | `https://api.voidhash.com`    | Must be `http:` or `https:`.                                                                       |
| `ingestUrl`      | `string`                 | `https://ingest.voidhash.com` | Analytics ingestion base URL. Must be `http:` or `https:`.                                         |
| `publishableKey` | `string`                 | —                             | Optional. Sent as the body `token` on capture, matching the client SDKs. Capture works without it. |
| `headers`        | `Record<string, string>` | `{}`                          | Extra headers on every request.                                                                    |

`createVoidhashSdk` validates eagerly and throws
`VoidhashNodeConfigurationError` on a blank `secretKey` or `projectId`, an
invalid `baseUrl` or `ingestUrl`, or a missing global `fetch`. The SDK sets the
credential headers for you: passing `Authorization` or `x-secret-key` in
`headers` (in any casing) also throws. Creating a client makes no request.

Namespaces follow the API's groups: `adAccounts`, `ads`, `analytics`,
`analyticsAlerts`, `analyticsAnnotations`, `apiKeys`, `auditLog`, `componentDevSessions`,
`componentRegistry`, `components`,
`connectedApps`, `events`, `experiments`, `featureFlags`, `feedback`,
`ingestPolicy`, `me`, `notices`, `organizationMembers`, `organizations`,
`paymentProviderHistoryImports`, `paymentProviderProducts`, `paymentProviders`,
`paymentSources`, `paywallLocations`, `paywalls`, `perks`, `persons`, `products`,
`projects`, `pushNotificationConfigurations`, `pushNotifications`, `sandbox`,
`schema`, `session`, `trackingDomains`, `webhooks`. Methods are named after the
API's operations, such as `products.list`, `products.get` and `webhooks.rotate`.
On top of them: `entitlements`, a convenience layer over `persons` and `perks`,
`paymentSource`, a handle for one payment source, and `eventCapture`, which
talks to the analytics ingestion API instead of the REST API.

Methods take one argument: `params` for path, query and header parameters, and
`payload` for the JSON body. A method with nothing required takes no argument:

```ts
const products = await voidhash.products.list();
const product = await voidhash.products.get({ params: { productId: "prod_123" } });
const updated = await voidhash.products.update({
  params: { productId: "prod_123" },
  payload: { name: "Pro monthly" },
});
```

### Project

Project-scoped calls (nearly all of them) act on one project, so you never pass
its id. A secret key belongs to exactly one project: without `projectId`, the
SDK reads it from `GET /api/v1/session` on the first project-scoped call and
keeps it for the client's lifetime. Calls made at the same time share that one
lookup, and a failed lookup is tried again on the next call.

Set `projectId` to skip the lookup, or when the credential can use several
projects. When the SDK cannot choose a project, project-scoped calls reject
with `VoidhashNodeConfigurationError` asking you to set it.

```ts
const voidhash = createVoidhashSdk({
  secretKey: process.env.VOIDHASH_SECRET_KEY!,
  projectId: process.env.VOIDHASH_PROJECT_ID,
});
```

### Pagination

Every list method resolves with a `{ data, pageInfo }` envelope rather than a
bare array, and accepts `limit` and `cursor` params:

```ts
const firstPage = await voidhash.perks.list({ params: { limit: "50" } });

for (const perk of firstPage.data) {
  console.log(perk.slug);
}

if (firstPage.pageInfo.hasNextPage) {
  const nextPage = await voidhash.perks.list({
    params: { limit: "50", cursor: firstPage.pageInfo.endCursor },
  });
}
```

`pageInfo` is `{ endCursor: string | null; hasNextPage: boolean }`. Pass
`endCursor` back as `cursor` to walk the collection; stop when `hasNextPage` is
`false`.

## Looking up a person

Use the same distinct id your mobile app passed to `identify()` as a filter on
the person list:

```ts
const { data } = await voidhash.persons.list({
  params: { distinctId: "user_123" },
});

const person = data[0];

// { id, projectId, distinctId, email, name, isIdentified, createdAt }
// email and name may be null. An unknown distinct id is an empty page, not a 404.
```

Write to a person with `persons.update({ params: { personId }, payload })`,
which sets `email`, `name`, `traits` and `setOnce`.

`Person` is intentionally thin: it identifies the user, it does not describe
what they have paid for.

## Check entitlements from your backend

_What the user paid for_ lives on `entitlements`. The usual question — may this
user have the thing they bought? — is one call:

```ts
import { createVoidhashSdk } from "@voidhash/node";

const voidhash = createVoidhashSdk({
  secretKey: process.env.VOIDHASH_SECRET_KEY!,
});

app.get("/reports/export", async (req, res) => {
  const hasPremium = await voidhash.entitlements.hasActivePerk({
    distinctId: req.user.id,
    perkSlug: "premium",
  });

  if (!hasPremium) {
    return res.status(402).json({ error: "premium_required" });
  }

  return res.json(await buildExport(req.user.id));
});
```

Pass **exactly one** of `perkId` or `perkSlug`. Both or neither rejects with
`VoidhashNodeConfigurationError` before any HTTP request is made. `perkSlug`
costs one extra `perks.list` round trip to look the slug up, so prefer
`perkId` on a hot path — or resolve the slug once at boot and keep the id.

`hasActivePerk` returns `false` for a `distinctId` Voidhash has never seen (and
for a `perkSlug` that matches no perk in the project): an unknown user has no
access. It does **not** absorb `unauthenticated` or `permission_denied` errors,
other `not_found` errors such as an unknown project, 5xx or transport failures —
those reject, so a mistyped secret key is never mistaken for "nobody has
premium".

### Reading the grants yourself

`getGrantsByDistinctId` returns the person's grants — every perk they can use
now, across all pages — so you can render an account page, check expiry, or
branch on where the entitlement came from:

```ts
const grants = await voidhash.entitlements.getGrantsByDistinctId({
  distinctId: "user_123",
});
```

| Field            | Type                                       | Notes                                       |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| `perkId`         | `string`                                   | Match this against the perk you care about. |
| `perkSlug`       | `string \| null`                           | The perk's slug.                            |
| `expiresAt`      | `string \| null`                           | ISO timestamp; `null` never expires.        |
| `source`         | `"subscription" \| "purchase" \| "manual"` | How the grant was obtained.                 |
| `sourceId`       | `string \| null`                           | The subscription or purchase behind it.     |
| `sourcePersonId` | `string`                                   | Differs from the person on shared plans.    |

Unlike `hasActivePerk`, an unknown `distinctId` is an error here — the caller
gets to decide whether "never seen" and "seen, nothing bought" mean the same
thing:

```ts
try {
  const grants = await voidhash.entitlements.getGrantsByDistinctId({
    distinctId: "user_123",
  });

  const premium = grants.find((grant) => grant.perkId === "perk_abc");

  return { hasPremium: premium !== undefined, until: premium?.expiresAt ?? null };
} catch (error) {
  // `getVoidhashApiError` reads the API's error — see Errors below.
  const apiError = getVoidhashApiError(error);

  if (apiError?.code === "person_not_found") {
    // Never identified from a client: nothing was ever bought.
    return { hasPremium: false, until: null };
  }

  if (apiError?.type === "unauthenticated" || apiError?.type === "permission_denied") {
    // Our secret key is wrong. Our bug, not the user's — do not lock them out.
    throw new Error("Voidhash secret key is invalid or lacks access.");
  }

  throw error;
}
```

### Production and test data

The secret key decides which grants you get:

| Secret key             | Grants returned                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Production (`vh_sk_…`) | Production purchases, plus store sandbox purchases while they unlock production apps |
| Test (`vh_sk_test_…`)  | Store sandbox and test purchases (such as Stripe test mode), never production ones   |

Store sandbox purchases (TestFlight, Google Play testers, App Review) unlock
production apps by default. A project can turn that off in Studio's project
settings; then a production key returns no sandbox grants.

No request header changes what a key reads; an `x-environment` header is
ignored. To read test grants, including the simulated purchases of mobile debug
builds in development mode, use a test secret key.

## Capture analytics events

`eventCapture` posts events to the ingestion API (`ingestUrl`, not `baseUrl`).
It authenticates with the same secret key — sent as `x-secret-key` — so a
backend needs no publishable key. Set `publishableKey` on the client and it is
sent as the body `token` as well, the way the browser and mobile SDKs authorize:

```ts
await voidhash.eventCapture.capture({
  distinctId: "user_123",
  event: "paywall_viewed",
  timestamp: new Date().toISOString(),
  properties: { paywallId: "pw_abc", placement: "onboarding" },
  context: { appVersion: "1.4.2", platform: "server" },
});
```

Use the same distinct id your app passed to `identify()`, so server-side events
land on the same person as client-side ones.

| Field        | Type                      | Notes                                                                 |
| ------------ | ------------------------- | --------------------------------------------------------------------- |
| `event`      | `string`                  | Required. Event name, e.g. `paywall_viewed`.                          |
| `distinctId` | `string`                  | Required. The person the event belongs to.                            |
| `properties` | `Record<string, unknown>` | The event's own attributes. Defaults to `{}`.                         |
| `context`    | `Record<string, unknown>` | Ambient attributes (app version, platform). Defaults to `{}`.         |
| `uuid`       | `string`                  | Deduplication key. Generated per call when omitted.                   |
| `sessionId`  | `string`                  | Groups events into a session.                                         |
| `groups`     | `Record<string, string>`  | The event's groups by type, sent as `$groups`. See [Groups](#groups). |
| `timestamp`  | `string`                  | Required. ISO 8601 time when the event occurred.                      |

Retries are deduplicated on `uuid`: pass your own — a stable id derived from
whatever you are recording — when the same event may be sent twice.

Send several events in one request with `batch`. They share a single request
timestamp, and each still carries its own `uuid` and occurrence `timestamp`:

```ts
const { accepted, rejected } = await voidhash.eventCapture.batch([
  { distinctId: "user_123", event: "trial_started", timestamp: new Date().toISOString() },
  { distinctId: "user_456", event: "trial_started", timestamp: new Date().toISOString() },
]);
```

An empty array is a no-op: it resolves with zero counts without a request,
because the API rejects a batch with no events.

Both calls resolve with `{ accepted, rejected }` and reject with the same error
objects as the rest of the SDK (see [Errors](#errors)). The ingestion API's
decoded bodies carry a `code`: `invalid_request`, `unauthorized`,
`payload_too_large`, `rate_limited`, `dependency_unavailable` or
`internal_error`.

### Groups

Name an event's groups (such as the user's company) with `groups`; they are sent as its `$groups`
property. `groupIdentify` sets a group's properties with a `$groupidentify` event that belongs to
no person; a later change of a property wins, and `setOnce` fills only missing ones:

```ts
await voidhash.eventCapture.capture({
  distinctId: "user_123",
  event: "report_exported",
  timestamp: new Date().toISOString(),
  groups: { company: "acme" },
});

await voidhash.eventCapture.groupIdentify({
  groupType: "company",
  groupKey: "acme",
  properties: { name: "Acme", plan: "pro", seats: 40 },
});
```

## Payment sources

Payments you take outside the app stores and Stripe — Paddle, Lemon Squeezy,
a bank transfer — can still grant access and count as revenue. Create a
**payment source** for each in Studio, give it a slug such as `paddle`, and
map the keys you use for what you sell to your products. Then report what
happens under your provider's own ids, naming the source by its payment
provider id (Studio shows it on the source's page; `paymentProviders.list({
params: { type: "payment_source" } })` lists them):

```ts
const paddle = voidhash.paymentSource(process.env.VOIDHASH_PADDLE_PROVIDER_ID!); // "pp_conf_..."

// A one-time purchase, or a subscription period when it names the subscription.
const transaction = await paddle.charge("txn_123", {
  distinctId: "user_123", // or `customer: { externalId: "ctm_42" }`
  productKey: "pri_monthly",
  amount: 4900, // minor units: €49.00
  currency: "EUR",
  fee: 300, // what the provider kept, if anything
  tax: 780, // tax included in `amount`, if any
  occurredAt: new Date(),
  subscriptionId: "sub_9",
  periodStart: new Date("2026-10-01T00:00:00Z"),
  periodEnd: new Date("2026-11-01T00:00:00Z"),
});
// { id, paymentProviderId, type, status: "applied" | "pending", pendingReason, purchaseId, bookedAmount }

await paddle.refund("re_1", {
  refundsTransactionId: "txn_123",
  amount: 4900,
  currency: "EUR",
  occurredAt: new Date(),
});

// A subscription's latest state: renewal, cancellation, billing retry.
await paddle.subscription("sub_9", {
  distinctId: "user_123",
  productKey: "pri_monthly",
  status: "active", // trialing | active | past_due | canceled | expired
  currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
  isAutoRenewing: false,
  updatedAt: new Date(),
});
// { id, paymentProviderId, status: "applied" | "pending" | "superseded", pendingReason, subscriptionId }
```

- Revenue only comes from transactions and subscription state only from
  subscriptions, so report every charge, including renewals, and every state
  change. A charge without `subscriptionId` completes a one-time purchase; one
  with it starts or renews the subscription for its period.
- Name the buyer with `distinctId`, or with `customer.externalId` when you
  don't know their distinct id yet; sending both later links the two. When
  your server creates a checkout at the provider, store the buyer's distinct id
  on it (in its metadata, for example), so the payment you report carries it.
- Sending the same transaction again is safe and returns what was recorded.
  Sending a different request under the same id fails with a `conflict`
  error whose code is `transaction_conflict`: correct a payment with a
  refund, not an edit. Subscription updates are ordered by `updatedAt`; an
  older one is answered `superseded` and changes nothing.
- A refund names the charge in `refundsTransactionId` and takes its buyer and
  product from it. A refund for less than what is left of the charge is
  partial and keeps access; refunding the rest ends it. `bookedAmount` is what
  a refund recorded, which is less than its amount when other refunds left
  less of the charge.
- A payment for a product key you haven't mapped yet, or a refund that arrives
  before its charge, is `pending` and applies on its own once it can.
- A test secret key (`vh_sk_test_…`) records its reports as test payments,
  apart from production. `environment`, when you send it, must match the
  key's environment.

The key needs the `project:purchases:write` permission. Revenue and webhooks
for these purchases carry `verified: false` and the source's slug, so you can
tell reported revenue from store-verified revenue. The same calls are on the
Effect client, returning Effects.

With a [provider endpoint](#provider-endpoint) that implements them, you can
also have Voidhash cancel and refund at the source:

```ts
// Ends renewal; access lasts to the period's end. `isImmediate: true` ends it now.
await paddle.cancelSubscription("sub_9");

// Refunds €15.00 of the charge; leave `amount` out to refund everything left.
await paddle.refundTransaction("txn_123", { amount: 1500, reason: "requested_by_customer" });
```

Voidhash calls your endpoint's `subscription.cancel` or `transaction.refund`
and records what it answers, so reporting the same cancellation or refund
again later changes nothing. When the endpoint cannot act, these reject with a
`conflict` (`payment_source_endpoint_not_configured`,
`payment_source_endpoint_unsupported`, `payment_source_endpoint_rejected`) or
`unavailable` (`payment_source_endpoint_unavailable`,
`payment_source_endpoint_invalid_response`) error, and nothing is recorded.
`refund` reports a refund that already happened; `refundTransaction` asks the
provider to make one.

### Provider endpoint

Give the source an endpoint in Studio and Voidhash can import your provider's
products and past payments, check a subscription it has not heard about in a
while, and cancel subscriptions and refund charges from Studio or the API.
Implement the operations you can answer; `describe`, which Studio's **Test
connection** calls, is answered for you:

```ts
import { defineProvider, ProviderError } from "@voidhash/node/providers";

export const paddle = defineProvider({
  source: "paddle",
  signingSecret: process.env.VOIDHASH_PROVIDER_SECRET!, // vhps_…, shown once in Studio
  catalog: {
    async list({ cursor }) {
      const page = await listPrices(cursor);
      return {
        items: page.prices.map((price) => ({
          key: price.id,
          name: price.name,
          kind: "subscription",
        })),
        nextCursor: page.next, // null on the last page
      };
    },
  },
  history: {
    // `kind` is "subscriptions" or "transactions"; return those created before `before`.
    async list({ kind, cursor, before }, { environment }) {
      return { items: [], nextCursor: null };
    },
  },
  subscriptions: {
    async get({ id }) {
      const subscription = await findSubscription(id);
      if (subscription === "rate-limited") {
        throw new ProviderError("unavailable", "Paddle is rate limiting us");
      }
      return { subscription: subscription ? toVoidhash(subscription) : null };
    },
    // Return the subscription's state after the cancellation.
    async cancel({ id, atPeriodEnd }) {
      const subscription = await cancelSubscription(id, { atPeriodEnd });
      return { subscription: toVoidhash(subscription) };
    },
  },
  transactions: {
    // `amount` is null to refund everything left; return the refund (`type: "refund"`).
    async refund({ transactionId, amount, reason }) {
      const refund = await refundTransaction(transactionId, { amount, reason });
      return { refund: { ...toVoidhashTransaction(refund), type: "refund" } };
    },
  },
});

// Next.js, Bun, Deno, Cloudflare Workers, Hono: a Request in, a Response out.
export const POST = paddle.handler;

// Express and node:http: mount it behind a raw body parser, never express.json().
import { toNodeHandler } from "@voidhash/node/providers";
app.post("/voidhash/provider", express.raw({ type: "application/json" }), toNodeHandler(paddle));
```

Items have the same shape as what you push, plus their `id`, with `Date`s for
dates. The handler checks each request's signature, refuses a request older or
newer than five minutes, and checks what your operations return before
replying; a result that breaks the protocol is answered with an error that
names the field. Throw `ProviderError` with `not_found`, `unavailable` (Voidhash
retries later) or `invalid_request` to answer deliberately. Anything else your
operation throws is a `provider_error`, whose message Voidhash shows for
test requests only.

Test your operations with a signed round trip:

```ts
const { status, body } = await paddle.test({
  operation: "history.list",
  input: { kind: "transactions", cursor: null, before: new Date() },
});
```

`test` sends a request for the test environment unless you pass
`environment: "production"`.
A complete endpoint against an in-memory provider is in the
[Node backend example](https://github.com/voidhashcom/voidhash/tree/main/examples/backend-node#payment-source).

## Errors

The Promise client rejects; the Effect client fails. Both surface the same
error object.

`getVoidhashApiError(error)` reads the error the API answered with:
`{ type, code, message, param, status, requestId }`, or `undefined` when the
failure is not an API error. Branch on `type` and `code`, never on `message`,
which is written for people. `param` names the request field at fault, or is
`null`; `requestId` is the response's `request-id` header, which identifies the
request when you contact support. The raw exchange stays available on
`error.request` and `error.response`.

```ts
import { getVoidhashApiError } from "@voidhash/node";

try {
  return await voidhash.products.get({ params: { productId: "prod_123" } });
} catch (error) {
  switch (getVoidhashApiError(error)?.type) {
    case "not_found":
      return null;
    case "unauthenticated":
    case "permission_denied":
      throw new Error("Voidhash secret key is invalid or lacks access.");
    default:
      throw error;
  }
}
```

| `type`              | Status | When                                                               |
| ------------------- | ------ | ------------------------------------------------------------------ |
| `invalid_request`   | 400    | The request is malformed or breaks a rule; `param` names the field |
| `unauthenticated`   | 401    | No credential, or it is invalid or expired                         |
| `permission_denied` | 403    | The key cannot do this here                                        |
| `not_found`         | 404    | The resource does not exist in this project                        |
| `conflict`          | 409    | The state forbids it now, or it already exists                     |
| `rate_limited`      | 429    | Too many requests                                                  |
| `unavailable`       | 503    | This deployment or a dependency cannot do it                       |
| `internal`          | 500    | Voidhash's fault; worth a retry                                    |

A status an operation does not document, and transport failures (DNS, TLS,
timeouts), reject with an Effect `HttpClientError` instead, for which
`getVoidhashApiError` returns `undefined`. Treat those as _unknown_, not as a
definitive answer — see [Caching and failure handling](#caching-and-failure-handling).
`VoidhashNodeConfigurationError` means the client is misconfigured, for
example when it cannot choose a [project](#project).

## Webhooks

Create a webhook in Studio (or with `webhooks.create`) and copy its signing
secret — it looks like `whsec_<64 hex>`. Store it next to your secret key.

Voidhash POSTs the event payload as the raw request body with three headers:

| Header                | Value                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `X-Webhook-Event`     | Event name, e.g. `purchase.completed`                                 |
| `X-Webhook-Timestamp` | Unix seconds when the request was signed                              |
| `X-Webhook-Signature` | `v1=` followed by the hex HMAC-SHA256 of `timestamp` + `.` + raw body |

`constructWebhookEvent` verifies all of it for you:

```ts
import express from "express";
import { VoidhashWebhookVerificationError, constructWebhookEvent } from "@voidhash/node";

const app = express();

// express.raw() is required: the signature covers the exact bytes Voidhash
// sent. express.json() re-serializes the body and verification will fail.
app.post("/webhooks/voidhash", express.raw({ type: "application/json" }), (req, res) => {
  let event;

  try {
    event = constructWebhookEvent({
      headers: req.headers,
      payload: req.body.toString("utf8"),
      secret: process.env.VOIDHASH_WEBHOOK_SECRET!,
    });
  } catch (error) {
    if (error instanceof VoidhashWebhookVerificationError) {
      // error.reason: "missing_header" | "invalid_signature"
      //             | "timestamp_out_of_tolerance" | "invalid_payload"
      return res.sendStatus(400);
    }
    throw error;
  }

  // Acknowledge fast, then do the work out of band.
  void handleEvent(event);
  res.sendStatus(200);
});
```

`verifyWebhookSignature({ payload, signature, timestamp, secret })` is also
exported if you only want the boolean (for example behind a framework that
already parsed the headers).

Both helpers accept `toleranceSeconds` (default `300`, applied to clock skew in
either direction) and `now` (for tests).

### Event types

`person.created`, `person.updated`, `person.deleted`, `subscription.created`,
`subscription.renewed`, `subscription.product_changed`, `subscription.cancelled`,
`subscription.uncancelled`, `subscription.expired`, `subscription.billing_issue`,
`subscription.billing_recovered`, `subscription.paused`, `subscription.resumed`,
`subscription.transferred`, `purchase.completed`, `purchase.refunded`,
`purchase.revoked`, `purchase.transferred`, `perk_access.granted`,
`perk_access.revoked` — exported as `WEBHOOK_EVENT_TYPES`.

Testing a webhook from Studio (or `webhooks.test`) sends
`test.ping`. Unknown event names pass through as plain strings so a newer server
never breaks an older SDK — always `default:` your switch.

### Retries and idempotency

Anything outside `2xx` (or a response slower than 30s) is retried after **5m,
30m, 2h, 24h** (five attempts in total), then the delivery is marked exhausted.
A slow handler can
therefore be delivered twice: **dedupe on your side** — key on a stable id from
the payload and make the handler idempotent. Return `200` as soon as the
signature checks out and process asynchronously.

The signing secret is returned only when a webhook is created or rotated —
`webhooks.get` and `webhooks.list` never include it, so store it when you
receive it.

Rotate a leaked secret with:

```ts
const webhook = await voidhash.webhooks.rotate({
  params: { webhookId: "wh_..." },
});

console.log(webhook.secret); // new whsec_...; the previous one stops working at once
```

Deliveries are inspectable via `webhooks.listDeliveries`,
`webhooks.getDelivery` and `webhooks.retryDelivery`.

## Effect entrypoint

Every method also exists as an `Effect`:

```ts
import { createVoidhashSdk } from "@voidhash/node/effect";

const voidhash = createVoidhashSdk({ secretKey: process.env.VOIDHASH_SECRET_KEY! });

const program = voidhash.persons.list({
  params: { distinctId: "user_123" },
});
```

`entitlements` is built at this layer — the Promise client is derived from it —
so it is Effect-returning here with the same typed error channel:

```ts
const hasPremium: Effect.Effect<boolean, VoidhashNodeConfigurationError | ...> =
  voidhash.entitlements.hasActivePerk({ distinctId: "user_123", perkSlug: "premium" });
```

Caveat: `@voidhash/node/effect` exposes Effect types across the package
boundary, so your app must resolve to the **same `effect` instance and version**
this SDK depends on. The SDK accepts any Effect 4 release from 4.0.7 on
(`effect@^4.0.7`), so your package manager can install one copy for both; if
two copies end up installed, expect type errors. The
default `.` entrypoint has no such constraint at runtime: it returns plain
Promises.

The webhook helpers are Effect-free and are exported identically from both
entrypoints.

## Caching and failure handling

The SDK does not cache, retry, or de-duplicate requests. Every call is a live
HTTP round trip.

For anything on a hot path (an access check on each request, say), cache the
result yourself for a short window — 60 seconds is a reasonable start — and
refresh in the background.

When a call fails with a transport error or a 5xx, treat the answer as
**unknown**, not as _no access_. Serve the last known good value, or fail the
request; revoking a paying user's access because of a network blip is worse
than a slightly stale cache.
