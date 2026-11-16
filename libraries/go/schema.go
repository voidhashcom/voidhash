package voidhash

import (
	"context"
	"net/http"
)

// SchemaService exposes the project runtime schema.
type SchemaService struct {
	client *Client
}

// Get returns the full runtime schema of the project.
func (s *SchemaService) Get(ctx context.Context) (*ProjectSchema, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	schema := &ProjectSchema{}
	err = s.client.call(schema, func() (*http.Response, error) {
		return s.client.core.SchemaGet(ctx, projectID, nil)
	})
	return schema, err
}

// Version returns the current schema revision.
func (s *SchemaService) Version(ctx context.Context) (*SchemaVersion, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	version := &SchemaVersion{}
	err = s.client.call(version, func() (*http.Response, error) {
		return s.client.core.SchemaGetVersion(ctx, projectID, nil)
	})
	return version, err
}

// UsersService exposes the signed-in person.
type UsersService struct {
	client *Client
}

// Current returns the person a CLI key acts for. A project secret key acts
// for no person, so with one this fails with a permission_denied
// [*APIError].
func (s *UsersService) Current(ctx context.Context) (*User, error) {
	user := &User{}
	err := s.client.call(user, func() (*http.Response, error) {
		return s.client.core.MeGet(ctx)
	})
	return user, err
}
