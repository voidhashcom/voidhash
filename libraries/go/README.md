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
