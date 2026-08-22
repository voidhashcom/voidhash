package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// APIKeysService manages secret API keys.
type APIKeysService struct {
	client *Client
}

// Create issues a new secret key. The raw key value is only returned here.
func (s *APIKeysService) Create(ctx context.Context, params CreateAPIKeyParams) (*APIKeyWithRawKey, error) {
	key := &APIKeyWithRawKey{}
	err := s.client.call(key, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ApiKeysCreateSecretKey(ctx, params)
	})
	return key, err
}

// List returns all secret keys visible to the current key.
func (s *APIKeysService) List(ctx context.Context) ([]APIKey, error) {
	var keys []APIKey
	err := s.client.call(&keys, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ApiKeysListApiKeys(ctx)
	})
	return keys, err
}

// Get fetches one secret key by id.
func (s *APIKeysService) Get(ctx context.Context, apiKeyID string) (*APIKey, error) {
	key := &APIKey{}
	err := s.client.call(key, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ApiKeysGetApiKeyById(ctx, apiKeyID)
	})
	return key, err
}

// Delete revokes a secret key.
func (s *APIKeysService) Delete(ctx context.Context, apiKeyID string) error {
	return s.client.call(nil, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ApiKeysDeleteApiKey(ctx, apiKeyID)
	})
}

// Rotate replaces a secret key and returns the new raw key value.
func (s *APIKeysService) Rotate(ctx context.Context, apiKeyID string) (*APIKeyWithRawKey, error) {
	key := &APIKeyWithRawKey{}
	err := s.client.call(key, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ApiKeysRotateSecretKey(ctx, apiKeyID)
	})
	return key, err
}
