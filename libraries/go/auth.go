package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// AuthService exposes session introspection.
type AuthService struct {
	client *Client
}

// Session validates the configured secret key and reports what it can access.
func (s *AuthService) Session(ctx context.Context) (*AuthSession, error) {
	session := &AuthSession{}
	err := s.client.call(session, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.AuthSession(ctx)
	})
	return session, err
}
