# @voidhash Go SDK

Official Go SDK for the Voidhash API. The typed request/response surface in
`api/` is code-generated from the committed OpenAPI document
(`packages/generated-clients/openapi/core.json`) with
[oapi-codegen](https://github.com/oapi-codegen/oapi-codegen); the hand-written
layer on top provides a Resend-style resource client.

## Install

```
go get github.com/voidhashcom/voidhash-go
```

## Usage

```go
package main

import (
	"context"

	"github.com/voidhashcom/voidhash-go"
)

func main() {
	client, err := voidhash.New("vh_sk_...")
	if err != nil {
		panic(err)
	}

	person, err := client.Persons.GetByDistinctID(context.Background(), "user-123")
	if err != nil {
		panic(err)
	}

	grants, err := client.Persons.Entitlements.GrantsByDistinctID(context.Background(), "user-123")
	_ = person
	_ = grants
}
```

Resources: `client.Auth`, `client.APIKeys`, `client.Persons`, `client.Perks`,
`client.Organizations`, `client.Projects`, `client.Products`,
`client.Paywalls`, `client.Schema`, `client.Notifications`, `client.Users`,
`client.Webhooks` and `client.EventCapture`.

### Analytics

`client.EventCapture` posts events to the ingestion API with the same secret
key — there is no publishable key involved.

```go
result, err := client.EventCapture.Capture(context.Background(), voidhash.Event{
	Event:      "paywall_viewed",
	DistinctID: "user-123",
	Timestamp:  time.Now(),
	Properties: map[string]any{"paywall_id": "pw_1"},
})

result, err = client.EventCapture.CaptureBatch(context.Background(), []voidhash.Event{
	{Event: "paywall_viewed", DistinctID: "user-123", Timestamp: time.Now()},
	{Event: "purchase_completed", DistinctID: "user-123", Timestamp: time.Now()},
})
```

Both return a `*CaptureResult` reporting how many events ingestion accepted and
how many it rejected — a project's admission policy can discard events without
failing the request.

Each event gets a generated `UUID` when you leave it empty; set it yourself to
make retries of the same event idempotent. `WithIngestURL` points capture at a
different ingestion host. `WithPublishableKey` is optional and only adds the
key as the body `token`, matching what the browser and mobile SDKs send.

### Errors

Every non-2xx response surfaces as `*voidhash.APIError`. `Tag` carries the
server-side discriminant exactly as sent on the wire (for example
`Api/PersonNotFoundError`); helpers like `voidhash.IsNotFound(err)` and
`voidhash.StatusCode(err)` cover the common branches.

### Webhooks

Verify inbound deliveries with `voidhash.ConstructWebhookEvent(payload,
headers, secret)` — pass the raw body bytes exactly as received.

## Regenerating the API surface

Run `pnpm openapi:generate:dev <host>` from `voidhash/` (see
`scripts/generate-openapi-clients.mjs`).

## Development

```
go test ./...
```
