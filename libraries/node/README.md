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

Create a secret key in Studio under **Project settings → API keys**, or through
an existing key:

```ts
const apiKey = await voidhash.apiKeys.createSecretKey({
  payload: { name: "production-backend", projectId: "proj_..." },
});

console.log(apiKey.rawKey); // shown once — store it now
```

Keep the key in an environment variable or your secret manager. It grants full
project access: never ship it to a browser, a mobile app, or a public repo.

## Client

```ts
import { createVoidhashSdk } from "@voidhash/node";

const voidhash = createVoidhashSdk({
  secretKey: process.env.VOIDHASH_SECRET_KEY!,
});
```

| Option      | Type                                 | Default                    | Notes                                        |
| ----------- | ------------------------------------ | -------------------------- | -------------------------------------------- |
| `secretKey` | `string`                             | —                          | Required. Sent as the `x-secret-key` header. |
| `baseUrl`   | `string`                             | `https://api.voidhash.com` | Must be `http:` or `https:`.                 |
| `headers`   | `Record<string, string \| undefined>` | `{}`                       | Extra headers on every request.              |

`createVoidhashSdk` validates eagerly and throws
`VoidhashNodeConfigurationError` on a blank `secretKey`, an invalid `baseUrl`,
or a missing global `fetch`. The SDK sets `x-secret-key` for you — passing it in
`headers` (in any casing) also throws.

Namespaces: `apiKeys`, `auth`, `notifications`, `organizations`,
`paymentProviderConfigurations`, `paymentProviderProducts`, `paywallDeploys`,
`paywallLocations`, `perks`, `persons`, `productPerks`, `products`, `projects`,
`schema`, `users`, `webhooks` — plus `entitlements`, a convenience layer over
`persons` and `perks` rather than a REST group of its own.

## Looking up a person

Use the same distinct id your mobile app passed to `identify()`:

```ts
const person = await voidhash.persons.getPersonByDistinctId({
  params: { distinctId: "user_123" },
});

// { personId, distinctId, email, name } — email and name may be null.
```

`Person` is intentionally thin: it identifies the user, it does not describe
what they have paid for.

## Check entitlements from your backend

*What the user paid for* lives on `entitlements`. The usual question — may this
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
costs one extra `perks.listPerks` round trip to resolve the slug, so prefer
`perkId` on a hot path — or resolve the slug once at boot and keep the id.

`hasActivePerk` returns `false` for a `distinctId` Voidhash has never seen (and
for a `perkSlug` that matches no perk in the project): an unknown user has no
access. It does **not** absorb `Api/NotAuthenticatedError`,
`Api/ActionForbiddenError`, 5xx or transport failures — those reject, so a
mistyped secret key is never mistaken for "nobody has premium".

### Reading the grants yourself

`getGrantsByDistinctId` returns the raw grants so you can render an account page,
check expiry, or branch on where the entitlement came from:

```ts
const grants = await voidhash.entitlements.getGrantsByDistinctId({
  distinctId: "user_123",
});
```

| Field            | Type                                        | Notes                                       |
| ---------------- | ------------------------------------------- | ------------------------------------------- |
| `perkId`         | `string`                                    | Match this against the perk you care about. |
| `status`         | `"active" \| "expired"`                     | Only `"active"` grants confer access.       |
| `expiresAt`      | `string \| null`                            | ISO timestamp; `null` never expires.        |
| `source`         | `"subscription" \| "purchase" \| "manual"`  | How the grant was obtained.                 |
| `sourceId`       | `string \| null`                            | The subscription or purchase behind it.     |
| `sourcePersonId` | `string`                                    | Differs from the person on shared plans.    |

Unlike `hasActivePerk`, an unknown `distinctId` is an error here — the caller
gets to decide whether "never seen" and "seen, nothing bought" mean the same
thing:

```ts
try {
  const grants = await voidhash.entitlements.getGrantsByDistinctId({
    distinctId: "user_123",
  });

  const premium = grants.find(
    (grant) => grant.perkId === "perk_abc" && grant.status === "active",
  );

  return { hasPremium: premium !== undefined, until: premium?.expiresAt ?? null };
} catch (error) {
  // The decoded server error hangs off `error.data` — see Errors below.
  const tag = (error as { data?: { _tag?: string } } | null)?.data?._tag;

  if (tag === "Api/PersonNotFoundError") {
    // Never identified from a client: nothing was ever bought.
    return { hasPremium: false, until: null };
  }

  if (tag === "Api/NotAuthenticatedError" || tag === "Api/ActionForbiddenError") {
    // Our secret key is wrong. Our bug, not the user's — do not lock them out.
    throw new Error("Voidhash secret key is invalid or lacks access.");
  }

  throw error;
}
```

### Live and development data

Grants are scoped to an environment, and the server picks the scope from the
`x-environment` request header:

| `x-environment`            | Grants returned                                          |
| -------------------------- | -------------------------------------------------------- |
| absent or `production`     | Real purchases — store production **and** store sandbox  |
| `development`              | Only simulated purchases made by an SDK in a debug build |
| `all`                      | Both of the above                                        |

Any other value falls back to `production` rather than erroring, so do not wire
the header straight to something like `NODE_ENV` — `"test"` would silently read
production grants.

Secret keys are **not** environment-scoped: there is a single `vh_sk_` key kind,
and which key you use does not change the answer. So a plain `createVoidhashSdk`
client always reads **production + sandbox** grants, and simulated development
purchases are invisible to it.

The SDK never sends `x-environment` for you. To read development grants, set it
on a separate client:

```ts
const voidhashDevelopment = createVoidhashSdk({
  secretKey: process.env.VOIDHASH_SECRET_KEY!,
  headers: { "x-environment": "development" },
});
```

The header applies to every call that client makes, so keep it to a dedicated
instance and leave your production access checks on the default one.

## Errors

The Promise client rejects; the Effect client fails. Both surface the same
error object:

A rejected API call carries the decoded error body on `error.data`, whose
`_tag` is the stable server-side tag. (`error._tag` names the response shape,
and `error.request` / `error.response` expose the raw exchange.)

```ts
const serverTag = (error: unknown): string | undefined =>
  (error as { data?: { _tag?: string } } | null)?.data?._tag;

try {
  const person = await voidhash.persons.getPersonByDistinctId({
    params: { distinctId: "user_123" },
  });
} catch (error) {
  switch (serverTag(error)) {
    case "Api/PersonNotFoundError":
      return null;
    case "Api/NotAuthenticatedError":
    case "Api/ActionForbiddenError":
      throw new Error("Voidhash secret key is invalid or lacks access.");
    default:
      throw error;
  }
}
```

Transport failures (DNS, TLS, timeouts) reject with an Effect
`HttpClientError` instead, which has no `data`. Treat those as *unknown*, not
as a definitive answer — see [Caching and failure handling](#caching-and-failure-handling).

Common tags: `Api/NotAuthenticatedError` (401), `Api/ActionForbiddenError`
(403), `Api/PersonNotFoundError` (404), `Api/WebhookEndpointNotFoundError`
(404), `Api/WebhookValidationError` (400).

## Webhooks

Create an endpoint in Studio (or with `webhooks.createWebhookEndpoint`) and copy
its signing secret — it looks like `whsec_<64 hex>`. Store it next to your
secret key.

Voidhash POSTs the event payload as the raw request body with three headers:

| Header                | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `X-Webhook-Event`     | Event name, e.g. `purchase.completed`                                |
| `X-Webhook-Timestamp` | Unix seconds when the request was signed                             |
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
`subscription.renewed`, `subscription.cancelled`, `subscription.expired`,
`purchase.completed`, `purchase.refunded` — exported as `WEBHOOK_EVENT_TYPES`.

Testing an endpoint from Studio (or `webhooks.testWebhookEndpoint`) sends
`test.ping`. Unknown event names pass through as plain strings so a newer server
never breaks an older SDK — always `default:` your switch.

### Retries and idempotency

Anything outside `2xx` (or a response slower than 30s) is retried after **5m,
30m, 2h, 24h** (five attempts in total), then the delivery is marked exhausted.
A slow handler can
therefore be delivered twice: **dedupe on your side** — key on a stable id from
the payload and make the handler idempotent. Return `200` as soon as the
signature checks out and process asynchronously.

Rotate a leaked secret with:

```ts
const endpoint = await voidhash.webhooks.rotateWebhookSecret({
  params: { endpointId: "wh_ep_..." },
});

console.log(endpoint.secret); // new whsec_...
```

Deliveries are inspectable via `webhooks.listWebhookDeliveries`,
`webhooks.getWebhookDelivery` and `webhooks.retryWebhookDelivery`.

## Effect entrypoint

Every method also exists as an `Effect`:

```ts
import { createVoidhashSdk } from "@voidhash/node/effect";

const voidhash = createVoidhashSdk({ secretKey: process.env.VOIDHASH_SECRET_KEY! });

const program = voidhash.persons.getPersonByDistinctId({
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
this SDK depends on. Effect v4 is still in beta and its types are not stable
across releases — if your `effect` version drifts, expect type errors. The
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
**unknown**, not as *no access*. Serve the last known good value, or fail the
request; revoking a paying user's access because of a network blip is worse
than a slightly stale cache.
