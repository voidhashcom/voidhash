package voidhash

import (
	"context"
	"net/http"
	"time"

	"github.com/voidhashcom/voidhash-go/api"
)

// APIKeysService manages the project's API keys.
//
// Creating, rotating and deleting a secret key is reserved for a person
// signed in to the Voidhash dashboard: with a secret key or a CLI key those
// calls fail with a permission_denied [*APIError].
type APIKeysService struct {
	client *Client
}

// Create issues a new secret key. The raw key value is only returned here.
func (s *APIKeysService) Create(ctx context.Context, params CreateAPIKeyParams) (*APIKeyWithRawKey, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	key := &APIKeyWithRawKey{}
	err = s.client.call(key, func() (*http.Response, error) {
		return s.client.core.ApiKeysCreate(ctx, projectID, params)
	})
	return key, err
}

// List returns the project's keys, publishable keys first. A secret key's
// value is never listed.
func (s *APIKeysService) List(ctx context.Context) ([]APIKey, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[APIKey](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.ApiKeysList(ctx, projectID, &api.ApiKeysListParams{Cursor: cursor})
	})
}

// Get fetches one key by id.
func (s *APIKeysService) Get(ctx context.Context, apiKeyID string) (*APIKey, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	key := &APIKey{}
	err = s.client.call(key, func() (*http.Response, error) {
		return s.client.core.ApiKeysGet(ctx, projectID, apiKeyID)
	})
	return key, err
}

// Delete revokes a secret key.
func (s *APIKeysService) Delete(ctx context.Context, apiKeyID string) error {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return err
	}
	return s.client.call(nil, func() (*http.Response, error) {
		return s.client.core.ApiKeysDelete(ctx, projectID, apiKeyID)
	})
}

// Rotate replaces a secret key and returns the new raw key value. The previous
// value stops working immediately.
func (s *APIKeysService) Rotate(ctx context.Context, apiKeyID string) (*APIKeyWithRawKey, error) {
	return s.rotate(ctx, apiKeyID, api.RotateApiKeyBodyJsonEncoding{})
}

// RotateWithOverlap replaces a secret key and returns the new raw key value.
// The previous value keeps working for overlap (up to 7 days, whole seconds),
// so deployments can switch to the new key first.
func (s *APIKeysService) RotateWithOverlap(ctx context.Context, apiKeyID string, overlap time.Duration) (*APIKeyWithRawKey, error) {
	seconds := int(overlap / time.Second)
	return s.rotate(ctx, apiKeyID, api.RotateApiKeyBodyJsonEncoding{OverlapSeconds: &seconds})
}

func (s *APIKeysService) rotate(ctx context.Context, apiKeyID string, body api.RotateApiKeyBodyJsonEncoding) (*APIKeyWithRawKey, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	key := &APIKeyWithRawKey{}
	err = s.client.call(key, func() (*http.Response, error) {
		return s.client.core.ApiKeysRotate(ctx, projectID, apiKeyID, body)
	})
	return key, err
}
