package main

import (
	"context"
	"log/slog"

	voidhash "github.com/voidhashcom/voidhash-go"
)

// analyticsClient records product analytics through the SDK.
//
// Both calls run on the same secret key the rest of the server uses; capture
// presents it as the x-secret-key header, so no publishable key is involved:
//
//   - Capture posts an event to ingest and reports how many events it took.
//   - SetAttributes is a server-to-server write. Traits describe the person and
//     persist, so facts like the current plan go here rather than being
//     repeated on every event.
type analyticsClient struct {
	client *voidhash.Client
	logger *slog.Logger
}

func newAnalyticsClient(client *voidhash.Client, logger *slog.Logger) *analyticsClient {
	return &analyticsClient{client: client, logger: logger}
}

// Capture sends one event and returns how ingest handled it.
func (a *analyticsClient) Capture(ctx context.Context, distinctID, event string, properties map[string]any) (*voidhash.CaptureResult, error) {
	return a.client.EventCapture.Capture(ctx, voidhash.Event{
		DistinctID: distinctID,
		Event:      event,
		Properties: properties,
	})
}

// SetAttributes writes person traits, creating the person when the distinct id
// is new.
func (a *analyticsClient) SetAttributes(ctx context.Context, distinctID string, traits map[string]any) error {
	_, err := a.client.Persons.SetAttributes(ctx, voidhash.SetPersonAttributesParams{
		DistinctID: distinctID,
		Traits:     traits,
	})
	return err
}
