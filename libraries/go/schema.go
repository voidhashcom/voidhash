package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// SchemaService exposes the project runtime schema.
type SchemaService struct {
	client *Client
}

// Get returns the full runtime schema of the project.
func (s *SchemaService) Get(ctx context.Context) (*ProjectSchema, error) {
	schema := &ProjectSchema{}
	err := s.client.call(schema, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.SchemaGetSchema(ctx)
	})
	return schema, err
}

// Version returns the current schema revision.
func (s *SchemaService) Version(ctx context.Context) (*SchemaVersion, error) {
	version := &SchemaVersion{}
	err := s.client.call(version, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.SchemaGetSchemaVersion(ctx)
	})
	return version, err
}

// UsersService exposes the authenticated user.
type UsersService struct {
	client *Client
}

// Current returns the user owning the current secret key.
func (s *UsersService) Current(ctx context.Context) (*User, error) {
	user := &User{}
	err := s.client.call(user, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.UsersGetUser(ctx)
	})
	return user, err
}
