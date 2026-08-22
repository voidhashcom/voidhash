package voidhash

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ErrPublishableKeyRequired is returned by [EventCaptureService] when the
// client was built without [WithPublishableKey]. Ingestion authenticates on
// the publishable key, so there is nothing to send it with.
var ErrPublishableKeyRequired = errors.New("voidhash: a publishable key is required to capture events; pass voidhash.WithPublishableKey")

// EventCaptureService posts analytics events to the ingestion surface.
//
// Unlike every other service it does not use the client's secret key:
// ingestion is the same endpoint the mobile SDKs post to and it authenticates
// on the publishable key carried in the request body.
type EventCaptureService struct {
	client *Client
}

// Event is a single analytics capture.
type Event struct {
	// Event is the event name, for example "note_created".
	Event string
	// DistinctID identifies the person the event belongs to.
	DistinctID string
	// Properties are the event's own attributes. Use person attributes
	// ([PersonsService.SetAttributes]) for facts about the person instead.
	Properties map[string]any
	// Context describes the sending environment. Optional.
	Context map[string]any
	// Timestamp is when the event occurred. Defaults to the time Capture is
	// called.
	Timestamp time.Time
}

// captureRequest is the /i/v1/capture body. context and properties are
// required objects: a nil map encodes as null and is rejected.
type captureRequest struct {
	UUID       string         `json:"uuid"`
	Event      string         `json:"event"`
	Context    map[string]any `json:"context"`
	Properties map[string]any `json:"properties"`
	DistinctID string         `json:"distinct_id"`
	Timestamp  string         `json:"timestamp,omitempty"`
	SentAt     string         `json:"sent_at"`
	Token      string         `json:"token"`
}

// CaptureResult reports how ingestion handled a request: how many events it
// took and how many it discarded (for example because the project's admission
// policy does not accept them).
type CaptureResult struct {
	Accepted int `json:"accepted"`
	Rejected int `json:"rejected"`
}

// Capture posts one event to the ingestion API. It returns
// [ErrPublishableKeyRequired] when the client has no publishable key.
func (s *EventCaptureService) Capture(ctx context.Context, event Event) (*CaptureResult, error) {
	if s.client.publishableKey == "" {
		return nil, ErrPublishableKeyRequired
	}

	eventID, err := newEventUUID()
	if err != nil {
		return nil, fmt.Errorf("voidhash: generating event uuid: %w", err)
	}

	now := time.Now().UTC()
	payload := captureRequest{
		UUID:       eventID,
		Event:      event.Event,
		Context:    event.Context,
		Properties: event.Properties,
		DistinctID: event.DistinctID,
		SentAt:     now.Format(time.RFC3339),
		Token:      s.client.publishableKey,
	}
	if payload.Context == nil {
		payload.Context = map[string]any{}
	}
	if payload.Properties == nil {
		payload.Properties = map[string]any{}
	}
	if !event.Timestamp.IsZero() {
		payload.Timestamp = event.Timestamp.UTC().Format(time.RFC3339)
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("voidhash: encoding event: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.client.ingestBase+"/i/v1/capture", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("voidhash: building request: %w", err)
	}
	req.Header.Set("content-type", "application/json")
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
