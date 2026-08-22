package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	voidhash "github.com/voidhashcom/voidhash-go"
)

const (
	// maxWebhookBody caps the body a delivery may carry. Voidhash payloads are
	// a few hundred bytes.
	maxWebhookBody = 1 << 20
	// dedupeWindow is how long a handled delivery is remembered. It comfortably
	// covers the first two entries of the Voidhash retry schedule (1min, 5min).
	dedupeWindow = 15 * time.Minute
)

// webhookAck is the body returned to Voidhash. Anything 2xx marks the delivery
// as succeeded; the fields are for whoever reads the delivery log in Studio.
type webhookAck struct {
	Received  bool   `json:"received"`
	Event     string `json:"event"`
	Duplicate bool   `json:"duplicate,omitempty"`
}

// webhookSubject is the slice of a lifecycle payload this app cares about.
// Every purchase, subscription and person event carries the distinct id of the
// person it concerns; the rest of the payload differs per event type.
type webhookSubject struct {
	Type        string  `json:"type"`
	DistinctID  string  `json:"distinctId"`
	PersonID    string  `json:"personId"`
	ProductSlug *string `json:"productSlug"`
	OccurredAt  string  `json:"occurredAt"`
}

func (s *server) handleWebhook(w http.ResponseWriter, r *http.Request) {
	if s.webhookSecret == "" {
		writeError(w, http.StatusServiceUnavailable, "webhooks_not_configured",
			"set VOIDHASH_WEBHOOK_SECRET to the endpoint signing secret from Studio")
		return
	}

	// The signature covers the exact bytes Voidhash sent, so the body is read
	// once and passed through verbatim — never re-encoded from a decoded value.
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxWebhookBody))
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, "payload_too_large",
			fmt.Sprintf("webhook bodies are capped at %d bytes", maxWebhookBody))
		return
	}

	event, err := voidhash.ConstructWebhookEvent(body, r.Header, s.webhookSecret)
	if err != nil {
		var verificationErr *voidhash.WebhookVerificationError
		if errors.As(err, &verificationErr) {
			// Retrying never fixes a bad signature, so answer 4xx and let
			// Voidhash mark the delivery failed instead of backing off.
			s.logger.Warn("rejected webhook", "reason", verificationErr.Reason, "detail", verificationErr.Detail)
			writeError(w, http.StatusBadRequest, "invalid_webhook", verificationErr.Reason)
			return
		}
		writeError(w, http.StatusBadRequest, "invalid_webhook", err.Error())
		return
	}

	key := deliveryKey(event.Type, body)
	if !s.deliveries.Claim(key) {
		s.logger.Info("ignoring duplicate webhook delivery", "event", event.Type)
		writeJSON(w, http.StatusOK, webhookAck{Received: true, Event: event.Type, Duplicate: true})
		return
	}

	// Acknowledge before doing the work: Voidhash gives a delivery 30 seconds
	// and retries anything slower, which is exactly how one purchase turns into
	// two handled events. The dedupe claim above is already taken, so a retry
	// that overlaps this handler is recognised as a duplicate.
	writeJSON(w, http.StatusOK, webhookAck{Received: true, Event: event.Type})
	go s.dispatchWebhook(event, key)
}

func (s *server) dispatchWebhook(event *voidhash.WebhookEvent, key string) {
	if err := s.applyWebhook(event); err != nil {
		// Give the claim back so the next Voidhash retry is processed instead
		// of being swallowed as a duplicate of a delivery that never landed.
		s.deliveries.Release(key)
		s.logger.Error("webhook handling failed", "event", event.Type, "error", err)
		return
	}
	s.logger.Info("webhook handled", "event", event.Type)
}

func (s *server) applyWebhook(event *voidhash.WebhookEvent) error {
	switch event.Type {
	case voidhash.WebhookTestPing:
		s.logger.Info("webhook test ping received", "timestamp", event.Timestamp)
		return nil

	case voidhash.WebhookEventPurchaseCompleted,
		voidhash.WebhookEventPurchaseRefunded,
		voidhash.WebhookEventSubscriptionCreated,
		voidhash.WebhookEventSubscriptionRenewed,
		voidhash.WebhookEventSubscriptionCancelled,
		voidhash.WebhookEventSubscriptionExpired,
		voidhash.WebhookEventPersonCreated,
		voidhash.WebhookEventPersonUpdated,
		voidhash.WebhookEventPersonDeleted:

		var subject webhookSubject
		if err := json.Unmarshal(event.Payload, &subject); err != nil {
			return fmt.Errorf("decoding %s payload: %w", event.Type, err)
		}
		if subject.DistinctID == "" {
			return fmt.Errorf("%s payload carries no distinctId", event.Type)
		}

		// Entitlements just changed upstream, so the cached answer is wrong
		// right now rather than in 60 seconds.
		s.entitlements.Invalidate(subject.DistinctID)
		if event.Type == voidhash.WebhookEventPersonDeleted {
			s.notes.Forget(subject.DistinctID)
		}
		s.logger.Info("entitlements invalidated",
			"event", event.Type,
			"distinctId", subject.DistinctID,
			"productSlug", derefOr(subject.ProductSlug, ""),
		)
		return nil

	default:
		// Voidhash can add event types without asking; unknown ones are
		// acknowledged and ignored rather than retried forever.
		s.logger.Info("ignoring unhandled webhook event", "event", event.Type)
		return nil
	}
}

// deliveryKey derives a retry-stable identity for a delivery.
//
// Voidhash sends no delivery id header, and each retry re-signs with a fresh
// timestamp, so neither the signature nor the timestamp can be used. The
// payload bytes are identical across attempts of the same delivery, so their
// digest — scoped by event type — is the stable key.
func deliveryKey(eventType string, body []byte) string {
	digest := sha256.New()
	digest.Write([]byte(eventType))
	digest.Write([]byte("."))
	digest.Write(body)
	return hex.EncodeToString(digest.Sum(nil))
}

// dedupeSet remembers recently handled deliveries.
//
// It rotates two generations rather than expiring keys individually: a key
// lives for somewhere between one and two windows, memory stays bounded by the
// delivery rate, and neither Claim nor Release ever scans the map.
type dedupeSet struct {
	window time.Duration

	mu        sync.Mutex
	rotatedAt time.Time
	current   map[string]struct{}
	previous  map[string]struct{}
}

func newDedupeSet(window time.Duration) *dedupeSet {
	return &dedupeSet{
		window:    window,
		rotatedAt: time.Now(),
		current:   map[string]struct{}{},
		previous:  map[string]struct{}{},
	}
}

// Claim records a delivery and reports whether the caller now owns it. A
// second call with the same key returns false until the key ages out.
func (d *dedupeSet) Claim(key string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.rotateLocked(time.Now())
	if _, seen := d.current[key]; seen {
		return false
	}
	if _, seen := d.previous[key]; seen {
		return false
	}
	d.current[key] = struct{}{}
	return true
}

// Release forgets a delivery, so a later retry of it is handled afresh.
func (d *dedupeSet) Release(key string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	delete(d.current, key)
	delete(d.previous, key)
}

func (d *dedupeSet) rotateLocked(now time.Time) {
	if now.Sub(d.rotatedAt) < d.window {
		return
	}
	d.previous = d.current
	d.current = map[string]struct{}{}
	d.rotatedAt = now
}

func derefOr[T any](value *T, fallback T) T {
	if value == nil {
		return fallback
	}
	return *value
}
