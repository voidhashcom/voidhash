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
func (s *WebhookEndpointsService) Create(ctx context.Context, params CreateWebhookEndpointParams) (*WebhookEndpointWithSecret, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	endpoint := &WebhookEndpointWithSecret{}
	err = s.client.call(endpoint, func() (*http.Response, error) {
		return s.client.core.WebhooksCreate(ctx, projectID, params)
	})
	return endpoint, err
}

// List returns all registered webhook endpoints.
func (s *WebhookEndpointsService) List(ctx context.Context) ([]WebhookEndpoint, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[WebhookEndpoint](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.WebhooksList(ctx, projectID, &api.WebhooksListParams{Cursor: cursor})
	})
}

// Get fetches one webhook endpoint.
func (s *WebhookEndpointsService) Get(ctx context.Context, endpointID string) (*WebhookEndpoint, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	endpoint := &WebhookEndpoint{}
	err = s.client.call(endpoint, func() (*http.Response, error) {
		return s.client.core.WebhooksGet(ctx, projectID, endpointID)
	})
	return endpoint, err
}

// Update patches an existing webhook endpoint.
func (s *WebhookEndpointsService) Update(ctx context.Context, endpointID string, params UpdateWebhookEndpointParams) (*WebhookEndpoint, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	endpoint := &WebhookEndpoint{}
	err = s.client.call(endpoint, func() (*http.Response, error) {
		return s.client.core.WebhooksUpdate(ctx, projectID, endpointID, params)
	})
	return endpoint, err
}

// Delete removes a webhook endpoint.
func (s *WebhookEndpointsService) Delete(ctx context.Context, endpointID string) error {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return err
	}
	return s.client.call(nil, func() (*http.Response, error) {
		return s.client.core.WebhooksDelete(ctx, projectID, endpointID)
	})
}

// RotateSecret replaces the signing secret of an endpoint and returns the
// updated endpoint carrying the new Secret.
func (s *WebhookEndpointsService) RotateSecret(ctx context.Context, endpointID string) (*WebhookEndpointWithSecret, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	endpoint := &WebhookEndpointWithSecret{}
	err = s.client.call(endpoint, func() (*http.Response, error) {
		return s.client.core.WebhooksRotate(ctx, projectID, endpointID)
	})
	return endpoint, err
}

// Test sends a signed test.ping delivery to an endpoint in the background and
// returns the delivery; read it with [WebhookDeliveriesService.Get] to see how
// the endpoint answered.
func (s *WebhookEndpointsService) Test(ctx context.Context, endpointID string) (*WebhookDelivery, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	delivery := &WebhookDelivery{}
	err = s.client.call(delivery, func() (*http.Response, error) {
		return s.client.core.WebhooksTest(ctx, projectID, endpointID)
	})
	return delivery, err
}

// WebhookDeliveriesService inspects and retries webhook deliveries.
type WebhookDeliveriesService struct {
	client *Client
}

// List returns an endpoint's deliveries, newest first.
func (s *WebhookDeliveriesService) List(ctx context.Context, endpointID string) ([]WebhookDelivery, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[WebhookDelivery](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.WebhooksListDeliveries(ctx, projectID, endpointID, &api.WebhooksListDeliveriesParams{Cursor: cursor})
	})
}

// Get fetches one delivery including its attempts.
func (s *WebhookDeliveriesService) Get(ctx context.Context, deliveryID string) (*WebhookDeliveryWithAttempts, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	delivery := &WebhookDeliveryWithAttempts{}
	err = s.client.call(delivery, func() (*http.Response, error) {
		return s.client.core.WebhooksGetDelivery(ctx, projectID, deliveryID)
	})
	return delivery, err
}

// Retry sends a failed or exhausted delivery again in the background.
// Retrying one that is pending, in progress or succeeded fails with a 409
// [*APIError] whose Code is "webhook_delivery_not_retryable".
func (s *WebhookDeliveriesService) Retry(ctx context.Context, deliveryID string) (*WebhookDelivery, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	delivery := &WebhookDelivery{}
	err = s.client.call(delivery, func() (*http.Response, error) {
		return s.client.core.WebhooksRetryDelivery(ctx, projectID, deliveryID)
	})
	return delivery, err
}
