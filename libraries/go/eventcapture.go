package voidhash

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// EventCaptureService posts analytics events to the ingestion surface. It
// shares the client's secret key authentication.
type EventCaptureService struct {
	client *Client
}

// Event is a single analytics capture.
type Event struct {
	Event      string         `json:"event"`
	DistinctID string         `json:"distinctId"`
	Properties map[string]any `json:"properties,omitempty"`
}

// Capture posts one event to the ingestion API.
func (s *EventCaptureService) Capture(ctx context.Context, event Event) error {
	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("voidhash: encoding event: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.client.ingestBase+"/i/v1/capture", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("voidhash: building request: %w", err)
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
		return fmt.Errorf("voidhash: request failed: %w", err)
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("voidhash: reading response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return newAPIError(resp.StatusCode, payload)
	}
	return nil
}
