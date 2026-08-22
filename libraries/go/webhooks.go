package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// WebhooksService manages webhook endpoints and inspects deliveries.
type WebhooksService struct {
	client *Client

	// Endpoints manages webhook endpoint registrations.
	Endpoints *WebhookEndpointsService
	// Deliveries inspects and retries webhook deliveries.
	Deliveries *WebhookDeliveriesService
}

// WebhookEndpointsService manages webhook endpoint registrations.
type WebhookEndpointsService struct {
	client *Client
}

// Create registers a new webhook endpoint.
func (s *WebhookEndpointsService) Create(ctx context.Context, params CreateWebhookEndpointParams) (*WebhookEndpoint, error) {
	endpoint := &WebhookEndpoint{}
	err := s.client.call(endpoint, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksCreateWebhookEndpoint(ctx, params)
	})
	return endpoint, err
}

// List returns all registered webhook endpoints.
func (s *WebhookEndpointsService) List(ctx context.Context) ([]WebhookEndpoint, error) {
	var endpoints []WebhookEndpoint
	err := s.client.call(&endpoints, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksListWebhookEndpoints(ctx)
	})
	return endpoints, err
}

// Get fetches one webhook endpoint.
func (s *WebhookEndpointsService) Get(ctx context.Context, endpointID string) (*WebhookEndpoint, error) {
	endpoint := &WebhookEndpoint{}
	err := s.client.call(endpoint, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksGetWebhookEndpoint(ctx, endpointID)
	})
	return endpoint, err
}

// Update patches an existing webhook endpoint.
func (s *WebhookEndpointsService) Update(ctx context.Context, endpointID string, params UpdateWebhookEndpointParams) (*WebhookEndpoint, error) {
	endpoint := &WebhookEndpoint{}
	err := s.client.call(endpoint, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksUpdateWebhookEndpoint(ctx, endpointID, params)
	})
	return endpoint, err
}

// Delete removes a webhook endpoint.
func (s *WebhookEndpointsService) Delete(ctx context.Context, endpointID string) error {
	return s.client.call(nil, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksDeleteWebhookEndpoint(ctx, endpointID)
	})
}

// RotateSecret replaces the signing secret of an endpoint and returns the
// updated endpoint carrying the new Secret.
func (s *WebhookEndpointsService) RotateSecret(ctx context.Context, endpointID string) (*WebhookEndpoint, error) {
	endpoint := &WebhookEndpoint{}
	err := s.client.call(endpoint, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksRotateWebhookSecret(ctx, endpointID)
	})
	return endpoint, err
}

// Test sends a signed test delivery to an endpoint.
func (s *WebhookEndpointsService) Test(ctx context.Context, endpointID string) (*WebhookDelivery, error) {
	delivery := &WebhookDelivery{}
	err := s.client.call(delivery, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksTestWebhookEndpoint(ctx, endpointID)
	})
	return delivery, err
}

// WebhookDeliveriesService inspects and retries webhook deliveries.
type WebhookDeliveriesService struct {
	client *Client
}

// List returns recent deliveries.
func (s *WebhookDeliveriesService) List(ctx context.Context) ([]WebhookDelivery, error) {
	var deliveries []WebhookDelivery
	err := s.client.call(&deliveries, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksListWebhookDeliveries(ctx)
	})
	return deliveries, err
}

// Get fetches one delivery including its attempts.
func (s *WebhookDeliveriesService) Get(ctx context.Context, deliveryID string) (*WebhookDeliveryWithAttempts, error) {
	delivery := &WebhookDeliveryWithAttempts{}
	err := s.client.call(delivery, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksGetWebhookDelivery(ctx, deliveryID)
	})
	return delivery, err
}

// Retry re-delivers a failed delivery.
func (s *WebhookDeliveriesService) Retry(ctx context.Context, deliveryID string) (*WebhookDelivery, error) {
	delivery := &WebhookDelivery{}
	err := s.client.call(delivery, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.WebhooksRetryWebhookDelivery(ctx, deliveryID)
	})
	return delivery, err
}
