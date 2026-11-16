# voidhash (Rust)

Official Rust SDK for the Voidhash API. The typed request/response surface in
the `generated` module is code-generated at build time from the committed
OpenAPI document (`packages/generated-clients/openapi/core.json`) with
[progenitor](https://github.com/oxidecomputer/progenitor); the hand-written
layer on top provides a Resend-style resource client.

## Install

```toml
[dependencies]
voidhash = "0.1"
```

## Usage

```rust
use voidhash::VoidhashClient;

#[tokio::main]
async fn main() -> Result<(), voidhash::Error> {
    let client = VoidhashClient::new("vh_sk_...")?;

    let person = client.persons().get_by_distinct_id("user-123").await?;
    let active = client
        .persons()
        .has_active_perk("user-123", None, Some("pro"))
        .await?;
    Ok(())
}
```

Resources: `client.auth()`, `api_keys()`, `persons()`, `perks()`,
`organizations()`, `projects()`, `products()`, `paywalls()`, `schema()`,
`notifications()`, `users()`, `webhooks()` and `event_capture()`.

The client sends the secret key as an `Authorization: Bearer` header.

A secret key is created as production (`vh_sk_…`) or test (`vh_sk_test_…`) and
keeps that [environment](https://voidhash.com/docs/concepts/api-keys)
for life. Use a test key in staging and tests, and a production key in
production.

### Projects

Project resources act on one project. A project secret key belongs to exactly
one, so by default the client reads it from the session on the first call that
needs it and keeps it; building the client makes no network calls. To skip
that lookup, or for a credential that can use several projects, set the
project explicitly:

```rust
let client = voidhash::VoidhashClient::builder()
    .secret_key("vh_sk_...")
    .project_id("proj_...")
    .build()?;
```

Without `project_id`, a credential that can use no project or several fails
the call with `voidhash::Error::Request` asking you to set one.

### Errors

Every non-2xx response surfaces as `voidhash::Error::Api`:

```rust
match client.persons().get("person_123").await {
    Ok(person) => println!("{}", person.distinct_id),
    Err(voidhash::Error::Api { type_, code, request_id, .. }) if type_ == "not_found" => {
        eprintln!("no such person ({code}, request {request_id:?})");
    }
    Err(error) => return Err(error),
}
```

Branch on `type_` (`invalid_request`, `unauthenticated`, `permission_denied`,
`not_found`, `conflict`, `rate_limited`, `unavailable` or `internal`) and the
specific `code`, never on `message`, which is written for people. `param` names
the request field an error concerns, and `request_id` is the response's
`Request-Id`, the id to quote to support. `status` is the HTTP status, and
`error.is_not_found()` covers the common branch.

### Analytics

Capture authenticates with the client's secret key, sent to the ingestion
origin as `x-secret-key`. No publishable key is required. If one is configured through
`ClientBuilder::publishable_key` it is forwarded as the body `token` so that
server-side captures match what the browser and mobile SDKs send.

```rust
use voidhash::{Event, VoidhashClient};

#[tokio::main]
async fn main() -> Result<(), voidhash::Error> {
    let client = VoidhashClient::new("vh_sk_...")?;

    client
        .event_capture()
        .capture(
            &Event::new("paywall_viewed", "user-123", chrono::Utc::now())
                .property("paywall_id", "pw_1")
                .context_property("platform", "ios"),
        )
        .await?;

    client
        .event_capture()
        .capture_batch(&[
            Event::new("paywall_viewed", "user-123", chrono::Utc::now()),
            Event::new("purchase_completed", "user-123", chrono::Utc::now()),
        ])
        .await?;
    Ok(())
}
```

Both calls return a `CaptureResult` reporting how many events ingestion
accepted and how many it discarded at admission.

Each event carries a `uuid` deduplication key. Leave it unset to have one
generated per send, or set it with `Event::uuid` so retries of the same event
are deduplicated server-side.

`Event::group(group_type, group_key)` names the event's groups, such as the user's company, sent
as its `$groups` property. `group_identify` sets a group's properties with a `$groupidentify` event
that belongs to no person; a later change of a property wins, and `set_once_property` fills only
missing ones:

```rust
client
    .event_capture()
    .group_identify(
        &voidhash::GroupIdentify::new("company", "acme")
            .property("name", "Acme")
            .property("plan", "pro"),
    )
    .await?;
```

### Payment sources

Report payments from a provider Voidhash does not integrate natively (Paddle,
Lemon Squeezy, bank transfers) as a payment source. `client.payment_source`
takes the source's payment provider id. Each record is keyed by the source's
own id, so sending it again is safe. Amounts are integers in minor units. When
your server creates a checkout at the provider, store the buyer's distinct id
on it (in its metadata, for example), so the payment you report names them.

```rust
use voidhash::payment_sources::{Charge, Refund, SubscriptionState, SubscriptionStatus};
use voidhash::VoidhashClient;

async fn record(client: &VoidhashClient) -> Result<(), voidhash::Error> {
    let paddle = client.payment_source("pp_conf_...");
    let (start, end) = (chrono::Utc::now(), chrono::Utc::now() + chrono::Duration::days(30));

    // A charge for a subscription period. Without `subscription_id` it is a
    // one-time purchase.
    paddle
        .charge(
            "txn_123",
            Charge::new("user-123", "pri_monthly", 4900, "EUR", start)
                .subscription_id("sub_9")
                .period(start, end),
        )
        .await?;

    // The subscription's latest state; it carries no money.
    paddle
        .subscription(
            "sub_9",
            SubscriptionState::new(
                "user-123",
                "pri_monthly",
                SubscriptionStatus::Active,
                start,
                end,
                true,
                chrono::Utc::now(),
            ),
        )
        .await?;

    // A refund of an earlier charge.
    paddle
        .refund("re_1", Refund::new("txn_123", 4900, "EUR", chrono::Utc::now()))
        .await?;
    Ok(())
}
```

When the source serves a [provider endpoint](#provider-endpoint) that
implements them, Voidhash can also act at the source: `cancel_subscription`
and `refund_transaction` ask the source to cancel or refund, and record what
its endpoint answers. When the endpoint could not do it they fail with
`conflict` (codes `payment_source_endpoint_not_configured`,
`payment_source_endpoint_unsupported`, `payment_source_endpoint_rejected`) or
`unavailable` (`payment_source_endpoint_unavailable`,
`payment_source_endpoint_invalid_response`), with a message that says why.

```rust
use voidhash::payment_sources::{CancelAt, RefundTransaction};

paddle.cancel_subscription("sub_9", CancelAt::PeriodEnd).await?;
paddle
    .refund_transaction("txn_123", RefundTransaction::partial(500).reason("Duplicate order"))
    .await?;
// RefundTransaction::full() refunds everything left of the charge.
```

#### Provider endpoint

Voidhash can also call an HTTPS endpoint you serve: to read a source's
catalog, history and subscriptions, so it can import products and past
payments and refresh a subscription it is unsure about, and to cancel
subscriptions and refund charges at the source. Implement the operations your
source supports and register them on a `ProviderHandler` with the source's slug
and signing secret (`vhps_...`). The handler verifies each request's signature, answers
`describe`, and checks what you return before replying.

```rust
use voidhash::provider::{
    CatalogPage, CatalogProduct, CatalogRequest, CatalogSource, ProductKind, ProviderError,
    ProviderHandler, ProviderRequest,
};

struct Paddle;

impl CatalogSource for Paddle {
    async fn list_catalog(&self, request: CatalogRequest) -> Result<CatalogPage, ProviderError> {
        // Read one page from the provider, starting at `request.cursor`.
        Ok(CatalogPage::new(
            vec![CatalogProduct::new("pri_monthly", "Pro monthly", ProductKind::Subscription)],
            None,
        ))
    }
}

let handler = ProviderHandler::new("paddle", std::env::var("PADDLE_SIGNING_SECRET")?)
    .catalog(Paddle);

// In any framework: pass the headers and the raw body exactly as received.
let response = handler.handle(ProviderRequest { headers, body }).await;
// Reply with response.status, response.headers and response.body.
```

The other operations register the same way:

| Trait                | Operation             | Builder method        |
| -------------------- | --------------------- | --------------------- |
| `CatalogSource`      | `catalog.list`        | `.catalog(...)`       |
| `HistorySource`      | `history.list`        | `.history(...)`       |
| `SubscriptionSource` | `subscription.get`    | `.subscription(...)`  |
| `CancellationSource` | `subscription.cancel` | `.cancellations(...)` |
| `RefundSource`       | `transaction.refund`  | `.refunds(...)`       |

`cancel_subscription` returns the subscription's state afterwards and
`refund_transaction` the refund (`Transaction::refund`); Voidhash records both
as if the source had pushed them.

Return `ProviderError::NotFound`, `InvalidRequest` or `Unavailable` to answer
with that error; any other failure (`ProviderError::Other`) is reported as a provider
error whose message is shown only for test requests. Each request carries
its `environment`.

With the `axum` feature, mount the handler as a route:

```rust
let app = axum::Router::new().route("/voidhash/provider", handler.into_axum());
```

In unit tests, `handler.test("catalog.list", serde_json::json!({ "cursor": null })).await`
sends a correctly signed test request through the handler and returns its
response.

The [Rust example backend](../../examples/backend-rust) serves every operation
against an in-memory provider and pushes a provider's payment webhook.

### Webhooks

Verify inbound deliveries with
`voidhash::webhooks::construct_event(payload, event_header, signature,
timestamp, secret)` — pass the raw body bytes exactly as received.

## Regenerating the API surface

Codegen runs in `build.rs` on every build against the committed
`packages/generated-clients/openapi/*.rust.json` documents. Refresh them with
`pnpm openapi:generate:dev <host>` from `voidhash/` (see
`scripts/generate-openapi-clients.mjs`).

## Development

```
cargo test
```
