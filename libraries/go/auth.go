package voidhash

import (
	"context"
	"net/http"
)

// AuthService exposes session introspection.
type AuthService struct {
	client *Client
}

// Session validates the configured key and reports what it can access. A
// project secret key's session lists its one project.
func (s *AuthService) Session(ctx context.Context) (*AuthSession, error) {
	session := &AuthSession{}
	err := s.client.call(session, func() (*http.Response, error) {
		return s.client.core.SessionGet(ctx)
	})
	return session, err
}
