package voidhash

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Webhook event names Voidhash can deliver to an endpoint. Unknown names are
// still delivered and pass through [ConstructWebhookEvent] as plain strings.
const (
	WebhookEventPersonCreated         = "person.created"
	WebhookEventPersonUpdated         = "person.updated"
	WebhookEventPersonDeleted         = "person.deleted"
	WebhookEventSubscriptionCreated   = "subscription.created"
	WebhookEventSubscriptionRenewed   = "subscription.renewed"
	WebhookEventSubscriptionCancelled = "subscription.cancelled"
	WebhookEventSubscriptionExpired   = "subscription.expired"
	WebhookEventPurchaseCompleted     = "purchase.completed"
	WebhookEventPurchaseRefunded      = "purchase.refunded"
)

// WebhookTestPing is the event name used when an endpoint is tested.
const WebhookTestPing = "test.ping"

const (
	webhookEventHeader     = "X-Webhook-Event"
	webhookSignatureHeader = "X-Webhook-Signature"
	webhookTimestampHeader = "X-Webhook-Timestamp"

	webhookSignaturePrefix  = "v1="
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
	signature, err := requireSingleHeader(headers, webhookSignatureHeader)
	if err != nil {
		return nil, err
	}
	if !VerifyWebhookSignature(payload, signature, timestamp, secret, webhookDefaultTolerance, time.Now()) {
		return nil, &WebhookVerificationError{Reason: "invalid_signature", Detail: "signature or timestamp check failed"}
	}

	var decoded json.RawMessage
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, &WebhookVerificationError{Reason: "invalid_payload", Detail: "body is not valid JSON"}
	}
	timestampSeconds, _ := strconv.ParseInt(timestamp, 10, 64)
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
func VerifyWebhookSignature(payload []byte, signature, timestamp, secret string, tolerance time.Duration, now time.Time) bool {
	timestampSeconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || strconv.FormatInt(timestampSeconds, 10) != timestamp {
		return false
	}
	if now.Sub(time.Unix(timestampSeconds, 0)) > tolerance || time.Unix(timestampSeconds, 0).Sub(now) > tolerance {
		return false
	}
	if !strings.HasPrefix(signature, webhookSignaturePrefix) {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(payload)
	expected := mac.Sum(nil)
	provided, err := hex.DecodeString(strings.TrimPrefix(signature, webhookSignaturePrefix))
	if err != nil {
		return false
	}
	return hmac.Equal(expected, provided)
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
