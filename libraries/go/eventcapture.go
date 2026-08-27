package voidhash

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// EventCaptureService posts analytics events to the ingestion surface.
//
// It authenticates with the client's secret key through the x-secret-key
// header, exactly like every other service. A publishable key is never
// required; when one is configured it is additionally sent as the body token
// so that server-side captures match what the browser and mobile SDKs send.
type EventCaptureService struct {
	client *Client
}

// Event is a single analytics capture.
type Event struct {
	// UUID is the deduplication key. Leave it empty to have a UUIDv4
	// generated; set it explicitly to make retries of the same event
	// idempotent.
	UUID string `json:"uuid"`
	// Event is the event name, for example "paywall_viewed".
	Event string `json:"event"`
	// DistinctID identifies the person the event belongs to.
	DistinctID string `json:"distinct_id"`
	// Properties are the event's own attributes. A nil map is sent as {}.
	// Use person attributes ([PersonsService.SetAttributes]) for facts about
	// the person instead.
	Properties map[string]any `json:"properties"`
	// Context carries ambient attributes (app version, platform, locale).
	// A nil map is sent as {}.
	Context map[string]any `json:"context"`
	// SessionID groups events into a session. Omitted when empty.
	SessionID string `json:"session_id,omitempty"`
	// Timestamp is when the event occurred.
	Timestamp time.Time `json:"timestamp"`
}

// captureRequest is the /i/v1/capture body. context and properties are
// required objects: a nil map encodes as null and is rejected.
type captureRequest struct {
	Event
	SentAt time.Time `json:"sent_at"`
	Token  string    `json:"token,omitempty"`
}

// batchRequest is the /i/v1/batch body.
type batchRequest struct {
	Events []Event   `json:"events"`
	SentAt time.Time `json:"sent_at"`
	Token  string    `json:"token,omitempty"`
}

// CaptureResult reports how ingestion handled a request: how many events it
// took and how many it discarded (for example because the project's admission
// policy does not accept them).
type CaptureResult struct {
	Accepted int `json:"accepted"`
	Rejected int `json:"rejected"`
}

// prepared returns a copy of the event with the fields the ingestion API
// requires filled in: a generated UUID when none was supplied, and empty
// objects instead of null for properties and context.
func (e Event) prepared() (Event, error) {
	if e.Timestamp.IsZero() {
		return Event{}, fmt.Errorf("voidhash: event timestamp is required")
	}
	if e.UUID == "" {
		generated, err := newEventUUID()
		if err != nil {
			return Event{}, fmt.Errorf("voidhash: generating event uuid: %w", err)
		}
		e.UUID = generated
	}
	if e.Properties == nil {
		e.Properties = map[string]any{}
	}
	if e.Context == nil {
		e.Context = map[string]any{}
	}
	return e, nil
}

// Capture posts one event to the ingestion API.
func (s *EventCaptureService) Capture(ctx context.Context, event Event) (*CaptureResult, error) {
	prepared, err := event.prepared()
	if err != nil {
		return nil, err
	}
	return s.post(ctx, "/i/v1/capture", captureRequest{
		Event:  prepared,
		SentAt: time.Now().UTC(),
		Token:  s.client.publishableKey,
	})
}

// CaptureBatch posts several events in a single request. All events share one
// sent_at stamp; each still carries its own uuid and occurrence timestamp. An
// empty slice sends nothing and reports an empty result.
func (s *EventCaptureService) CaptureBatch(ctx context.Context, events []Event) (*CaptureResult, error) {
	if len(events) == 0 {
		return &CaptureResult{}, nil
	}
	prepared := make([]Event, len(events))
	for i, event := range events {
		ready, err := event.prepared()
		if err != nil {
			return nil, err
		}
		prepared[i] = ready
	}
	return s.post(ctx, "/i/v1/batch", batchRequest{
		Events: prepared,
		SentAt: time.Now().UTC(),
		Token:  s.client.publishableKey,
	})
}

func (s *EventCaptureService) post(ctx context.Context, path string, payload any) (*CaptureResult, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("voidhash: encoding event: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.client.ingestBase+path, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("voidhash: building request: %w", err)
	}
	req.Header.Set("content-type", "application/json")
	req.Header.Set(secretKeyHeader, s.client.secretKey)
	for name, value := range s.client.extraHeaders {
		req.Header.Set(name, value)
	}

	doer := s.client.httpClient
	if doer == nil {
		doer = http.DefaultClient
	}
	resp, err := doer.Do(req)
	if err != nil {
		return nil, fmt.Errorf("voidhash: request failed: %w", err)
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("voidhash: reading response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, newAPIError(resp.StatusCode, responseBody)
	}

	result := &CaptureResult{}
	// A 2xx with no body still means the events were taken; report zeroes
	// rather than failing on an empty document.
	if len(bytes.TrimSpace(responseBody)) == 0 {
		return result, nil
	}
	if err := json.Unmarshal(responseBody, result); err != nil {
		return nil, fmt.Errorf("voidhash: decoding response: %w", err)
	}
	return result, nil
}

// newEventUUID returns a random RFC 4122 version 4 UUID. Sixteen random bytes
// and two masked nibbles keep the SDK free of a UUID dependency.
func newEventUUID() (string, error) {
	var buffer [16]byte
	if _, err := rand.Read(buffer[:]); err != nil {
		return "", err
	}
	buffer[6] = (buffer[6] & 0x0f) | 0x40
	buffer[8] = (buffer[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x",
		buffer[0:4], buffer[4:6], buffer[6:8], buffer[8:10], buffer[10:16]), nil
}
