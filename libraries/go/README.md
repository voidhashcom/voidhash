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

A secret key is created as production (`vh_sk_…`) or test (`vh_sk_test_…`) and
keeps that [environment](https://voidhash.com/docs/concepts/api-keys)
for life. Use a test key in staging and tests, and a production key in
production.

Resources: `client.Auth`, `client.APIKeys`, `client.Persons`, `client.Perks`,
`client.Organizations`, `client.Projects`, `client.Products`,
`client.Paywalls`, `client.Schema`, `client.Notifications`, `client.Users`,
`client.Webhooks`, `client.EventCapture` and `client.PaymentSources`.

### Projects

Persons, products, webhooks and the other project resources live in a
project. A secret key belongs to exactly one, so the client finds it by itself:
on its first project call it reads the key's session (`client.Auth.Session`)
once and keeps the project for its lifetime. Creating the client makes no
request.

A credential that can use several projects, such as a CLI key, has to name
one; without it, project calls fail with an error saying so:

```go
client, err := voidhash.New(os.Getenv("VOIDHASH_KEY"), voidhash.WithProjectID("proj_..."))
```

### Analytics

`client.EventCapture` posts events to the ingestion API with the same secret
key — there is no publishable key involved. The management API receives the
key as an `Authorization: Bearer` token and the ingestion API as the
`x-secret-key` header; the client sends both itself, and `WithHeader` cannot
override them.

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

`Event.Groups` names the event's groups, such as the user's company, sent as its `$groups`
property. `GroupIdentify` sets a group's properties with a `$groupidentify` event that belongs to
no person; a later change of a property wins, and `SetOnce` fills only missing ones:

```go
result, err = client.EventCapture.GroupIdentify(context.Background(), voidhash.GroupIdentify{
	GroupType:  "company",
	GroupKey:   "acme",
	Properties: map[string]any{"name": "Acme", "plan": "pro", "seats": 40},
})
```

### Acting for a person

A tool that people sign in to, such as a command line, uses the device
authorization grant: it shows a code, the person approves it in the dashboard,
and the tool receives a token (`vh_oat_…`) that acts as them.

```go
auth := &voidhash.DeviceAuth{ClientID: "my-tool"}
authorization, err := auth.Start(ctx, voidhash.DeviceAuthorizationParams{DeviceName: hostname})
fmt.Printf("Open %s and enter %s\n", authorization.VerificationURI, authorization.UserCode)
token, err := auth.Wait(ctx, authorization) // polls until approved, denied or expired
```

The management API takes the token like a secret key. A person can use
several projects, so name one, and build the client with
`NewWithTokenSource` when the token is stored elsewhere or can be replaced
while the client lives; it is asked for before every request:

```go
client, err := voidhash.NewWithTokenSource(
	func(ctx context.Context) (string, error) { return keychain.Read(ctx) },
	voidhash.WithProjectID("proj_..."),
)
```

`auth.Revoke` ends the token's session when the person signs out.

### Every operation

The services cover the common calls. `client.API()` is the generated client
for the whole management API, one method per operation, sending the same
credential; `voidhash.ReadResponse` turns its raw response into the body or an
`*APIError`:

```go
resp, err := client.API().ProjectsGet(ctx, "proj_...")
if err != nil {
	return err
}
body, err := voidhash.ReadResponse(resp)
```

### Errors

Every non-2xx response surfaces as `*voidhash.APIError`. Branch on `Type`
(`not_found`, `permission_denied`, `conflict`, ...) and `Code` (for example
`person_not_found`), never on `Message`, which is written for people. `Param`
names the request field an error is about, and `RequestID` carries the
response's `Request-Id` header to quote to support. Helpers like
`voidhash.IsNotFound(err)` and `voidhash.StatusCode(err)` cover the common
branches.

```go
person, err := client.Persons.GetByDistinctID(ctx, "user-123")
var apiErr *voidhash.APIError
if errors.As(err, &apiErr) && apiErr.Code == "person_not_found" {
	// Voidhash has never seen this distinct id.
}
```

### Webhooks

Verify inbound deliveries with `voidhash.ConstructWebhookEvent(payload,
headers, secret)` — pass the raw body bytes exactly as received.

### Payment sources

Report payments from a provider Voidhash does not integrate natively, such as
Paddle or bank transfers. Each record is addressed by the provider's own id, so
sending it again is safe. A charge for a subscription period names the
subscription and the period it pays for; subscription states carry no money.
When your server creates a checkout at the provider, store the buyer's distinct
id on it (in its metadata, for example), so the payment you report names them.

Name the payment source by its id (`pp_conf_...`), the last part of the address of
its page in Studio. Its slug only names it to its provider endpoint (below).

```go
paddle := client.PaymentSources.Source("pp_conf_...")
userID, subscriptionID := "user-123", "sub_9"

_, err := paddle.Charge(ctx, "txn_123", voidhash.ChargeParams{
	DistinctID:     &userID,
	ProductKey:     "pri_monthly",
	Amount:         999, // minor units
	Currency:       "EUR",
	OccurredAt:     time.Now(),
	SubscriptionID: &subscriptionID,
	PeriodStart:    &periodStart,
	PeriodEnd:      &periodEnd,
})

_, err = paddle.Subscription(ctx, "sub_9", voidhash.SubscriptionParams{
	DistinctID:         &userID,
	ProductKey:         "pri_monthly",
	Status:             voidhash.PaymentSourceSubscriptionActive,
	CurrentPeriodStart: periodStart,
	CurrentPeriodEnd:   periodEnd,
	IsAutoRenewing:     true,
	UpdatedAt:          time.Now(),
})

_, err = paddle.Refund(ctx, "re_1", voidhash.RefundParams{
	RefundsTransactionID: "txn_123",
	Amount:               999,
	Currency:             "EUR",
	OccurredAt:           time.Now(),
})
```

`Refund` reports a refund the provider already made. To have Voidhash ask the
provider to cancel or refund through its provider endpoint (below), and record
what it answers:

```go
// Cancels at the end of the paid period; IsImmediate ends access now.
_, err = paddle.CancelSubscription(ctx, "sub_9", voidhash.CancelSubscriptionParams{})

// A nil Amount refunds everything left of the charge.
_, err = paddle.RefundTransaction(ctx, "txn_123", voidhash.RefundTransactionParams{})
```

When the endpoint cannot act, these return a `*voidhash.APIError`. Its `Type`
is `conflict` for one that is not configured, does not support the operation
or refused it, with the `Code` `payment_source_endpoint_not_configured`,
`payment_source_endpoint_unsupported` or `payment_source_endpoint_rejected`,
and `unavailable` for one that did not answer properly, with
`payment_source_endpoint_unavailable` or
`payment_source_endpoint_invalid_response`.

To let Voidhash import a source's catalog and history, refresh its
subscriptions, and cancel and refund there, mount a provider endpoint.
Implement any of these on one value; the handler verifies each request's
signature, answers `describe` and checks what you return before replying.

| Interface                       | Method               | Operation             |
| ------------------------------- | -------------------- | --------------------- |
| `provider.CatalogLister`        | `ListCatalog`        | `catalog.list`        |
| `provider.HistoryLister`        | `ListHistory`        | `history.list`        |
| `provider.SubscriptionGetter`   | `GetSubscription`    | `subscription.get`    |
| `provider.SubscriptionCanceler` | `CancelSubscription` | `subscription.cancel` |
| `provider.TransactionRefunder`  | `RefundTransaction`  | `transaction.refund`  |

```go
import "github.com/voidhashcom/voidhash-go/provider"

type Paddle struct{ /* your Paddle client */ }

func (p *Paddle) ListCatalog(ctx context.Context, req provider.CatalogRequest) (provider.CatalogPage, error) {
	// Page through prices from req.Cursor.
	return provider.CatalogPage{Items: []provider.CatalogProduct{
		{Key: "pri_monthly", Name: "Pro monthly", Kind: provider.ProductKindSubscription},
	}}, nil
}

func (p *Paddle) GetSubscription(ctx context.Context, req provider.SubscriptionRequest) (*provider.Subscription, error) {
	// Return nil when the subscription does not exist, or fail on purpose:
	return nil, &provider.Error{Code: provider.CodeUnavailable, Message: "Paddle is down"}
}

h, err := provider.NewHandler("paddle", os.Getenv("VOIDHASH_PROVIDER_SECRET"), &Paddle{})
mux.Handle("POST /voidhash/provider", h)
```

An error other than `*provider.Error` is reported as a provider failure; its
message reaches Voidhash only for test requests. In unit tests,
`providertest.Call(h, "catalog.list", map[string]any{"cursor": nil})` sends a
correctly signed request through the handler. The
[Go backend example](../../examples/backend-go) implements every operation
against an in-memory provider.

## Regenerating the API surface

Run `pnpm openapi:generate:dev <host>` from `voidhash/` (see
`scripts/generate-openapi-clients.mjs`).

## Development

```
go test ./...
```
