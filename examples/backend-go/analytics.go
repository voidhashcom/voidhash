package main

import (
	"context"
	"log/slog"

	voidhash "github.com/voidhashcom/voidhash-go"
)

// analyticsClient records product analytics through the SDK.
//
// Two different credentials are in play, which is the thing worth noticing:
//
//   - Capture posts to event ingest, which authenticates on the publishable
//     key (voidhash.WithPublishableKey). It is disabled when that is unset.
//   - SetAttributes is a server-to-server write on the secret key. Traits
//     describe the person and persist, so facts like the current plan go here
//     rather than being repeated on every event.
type analyticsClient struct {
	client  *voidhash.Client
	enabled bool
	logger  *slog.Logger
}

func newAnalyticsClient(client *voidhash.Client, publishableKey string, logger *slog.Logger) *analyticsClient {
	return &analyticsClient{client: client, enabled: publishableKey != "", logger: logger}
}

// Enabled reports whether events can be sent at all.
func (a *analyticsClient) Enabled() bool {
	return a.enabled
}

// Capture sends one event.
func (a *analyticsClient) Capture(ctx context.Context, distinctID, event string, properties map[string]any) error {
	_, err := a.client.EventCapture.Capture(ctx, voidhash.Event{
		DistinctID: distinctID,
		Event:      event,
		Properties: properties,
	})
	return err
}

// SetAttributes writes person traits, creating the person when the distinct id
// is new. Unlike Capture this needs no publishable key, so it works even when
// analytics capture is switched off.
func (a *analyticsClient) SetAttributes(ctx context.Context, distinctID string, traits map[string]any) error {
	_, err := a.client.Persons.SetAttributes(ctx, voidhash.SetPersonAttributesParams{
		DistinctID: distinctID,
		Traits:     traits,
	})
	return err
}
