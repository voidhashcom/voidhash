package voidhash

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/voidhashcom/voidhash/libraries/go/internal/signature"
)

// Webhook event names Voidhash can deliver to an endpoint. Unknown names are
// still delivered and pass through [ConstructWebhookEvent] as plain strings.
const (
	WebhookEventPersonCreated                = "person.created"
	WebhookEventPersonUpdated                = "person.updated"
	WebhookEventPersonDeleted                = "person.deleted"
	WebhookEventSubscriptionCreated          = "subscription.created"
	WebhookEventSubscriptionRenewed          = "subscription.renewed"
	WebhookEventSubscriptionProductChanged   = "subscription.product_changed"
	WebhookEventSubscriptionCancelled        = "subscription.cancelled"
	WebhookEventSubscriptionUncancelled      = "subscription.uncancelled"
	WebhookEventSubscriptionExpired          = "subscription.expired"
	WebhookEventSubscriptionBillingIssue     = "subscription.billing_issue"
	WebhookEventSubscriptionBillingRecovered = "subscription.billing_recovered"
	WebhookEventSubscriptionPaused           = "subscription.paused"
	WebhookEventSubscriptionResumed          = "subscription.resumed"
	WebhookEventSubscriptionTransferred      = "subscription.transferred"
	WebhookEventPurchaseCompleted            = "purchase.completed"
	WebhookEventPurchaseRefunded             = "purchase.refunded"
	WebhookEventPurchaseRevoked              = "purchase.revoked"
	WebhookEventPurchaseTransferred          = "purchase.transferred"
	WebhookEventPerkAccessGranted            = "perk_access.granted"
	WebhookEventPerkAccessRevoked            = "perk_access.revoked"
)

// WebhookTestPing is the event name used when an endpoint is tested.
const WebhookTestPing = "test.ping"

const (
	webhookEventHeader     = "X-Webhook-Event"
	webhookSignatureHeader = "X-Webhook-Signature"
	webhookTimestampHeader = "X-Webhook-Timestamp"

	webhookDefaultTolerance = 300 * time.Second
)

// WebhookVerificationError is returned by [ConstructWebhookEvent] when a
// request cannot be trusted. Respond with a 4xx: Voidhash never retries its
// way out of a bad signature.
type WebhookVerificationError struct {
	Reason string // "missing_header", "invalid_signature", "timestamp_out_of_tolerance" or "invalid_payload"
	Detail string
}

// Error implements the error interface.
func (e *WebhookVerificationError) Error() string {
	return fmt.Sprintf("voidhash: webhook verification failed (%s): %s", e.Reason, e.Detail)
}

// ConstructWebhookEvent verifies an inbound webhook request and parses its
// body. Headers are looked up case-insensitively; the raw body must be the
// exact bytes Voidhash signed, so callers using net/http should read the body
// before any JSON re-serialization.
func ConstructWebhookEvent(payload []byte, headers http.Header, secret string) (*WebhookEvent, error) {
	eventName, err := requireSingleHeader(headers, webhookEventHeader)
	if err != nil {
		return nil, err
	}
	timestamp, err := requireSingleHeader(headers, webhookTimestampHeader)
	if err != nil {
		return nil, err
	}
	sig, err := requireSingleHeader(headers, webhookSignatureHeader)
	if err != nil {
		return nil, err
	}
	// A stale or malformed timestamp is reported apart from a bad signature,
	// so a drifting server clock is easy to tell from a wrong secret.
	now := time.Now()
	timestampSeconds, err := strconv.ParseInt(timestamp, 10, 64)
	signedAt := time.Unix(timestampSeconds, 0)
	if err != nil || now.Sub(signedAt) > webhookDefaultTolerance || signedAt.Sub(now) > webhookDefaultTolerance {
		return nil, &WebhookVerificationError{
			Reason: "timestamp_out_of_tolerance",
			Detail: fmt.Sprintf("webhook timestamp %q is not within %s of the current time", timestamp, webhookDefaultTolerance),
		}
	}
	if !VerifyWebhookSignature(payload, sig, timestamp, secret, webhookDefaultTolerance, now) {
		return nil, &WebhookVerificationError{Reason: "invalid_signature", Detail: "signature check failed"}
	}

	var decoded json.RawMessage
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, &WebhookVerificationError{Reason: "invalid_payload", Detail: "body is not valid JSON"}
	}
	return &WebhookEvent{
		Type:      eventName,
		Payload:   decoded,
		Timestamp: time.Unix(timestampSeconds, 0),
	}, nil
}

// WebhookEvent is a verified webhook delivery.
type WebhookEvent struct {
	// Type is the X-Webhook-Event header value.
	Type string
	// Payload is the parsed JSON body.
	Payload json.RawMessage
	// Timestamp is the signing time from the X-Webhook-Timestamp header.
	Timestamp time.Time
}

// VerifyWebhookSignature checks a webhook signature and timestamp freshness.
//
// Voidhash signs `${timestamp}.${rawBody}` with HMAC-SHA256 keyed by the raw
// UTF-8 endpoint secret and sends it as `v1=<lowercase hex>`. Signatures with
// an unknown scheme prefix, a malformed timestamp, or a timestamp outside
// tolerance (past or future) are rejected.
func VerifyWebhookSignature(payload []byte, sig, timestamp, secret string, tolerance time.Duration, now time.Time) bool {
	return signature.Verify(payload, sig, timestamp, secret, tolerance, now)
}

// requireSingleHeader reads exactly one value for a header, treating repeats
// as missing — a repeated signing header is ambiguous.
func requireSingleHeader(headers http.Header, name string) (string, error) {
	values := headers.Values(name)
	if len(values) != 1 || values[0] == "" {
		return "", &WebhookVerificationError{
			Reason: "missing_header",
			Detail: fmt.Sprintf("webhook request must carry exactly one %q header", name),
		}
	}
	return values[0], nil
}
