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

### Errors

Every non-2xx response surfaces as `voidhash::Error::Api { status, tag }`.
`tag` carries the server-side discriminant exactly as sent on the wire (for
example `Api/PersonNotFoundError`); `error.is_not_found()` covers the common
branch.

### Analytics

Capture authenticates with the same secret key as the rest of the client, sent
as `x-secret-key`. No publishable key is required. If one is configured through
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
