package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// PersonsService manages persons.
type PersonsService struct {
	client *Client

	// Entitlements resolves entitlement grants for persons.
	Entitlements *EntitlementsService
}

// Create creates a person keyed by a distinct id.
func (s *PersonsService) Create(ctx context.Context, params CreatePersonParams) (*Person, error) {
	person := &Person{}
	err := s.client.call(person, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PersonsCreatePerson(ctx, params)
	})
	return person, err
}

// List returns all persons.
func (s *PersonsService) List(ctx context.Context) ([]Person, error) {
	var persons []Person
	err := s.client.call(&persons, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PersonsListPersons(ctx)
	})
	return persons, err
}

// Get fetches one person by id.
func (s *PersonsService) Get(ctx context.Context, personID string) (*Person, error) {
	person := &Person{}
	err := s.client.call(person, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PersonsGetPersonById(ctx, personID)
	})
	return person, err
}

// GetByDistinctID fetches one person by their distinct id.
func (s *PersonsService) GetByDistinctID(ctx context.Context, distinctID string) (*Person, error) {
	person := &Person{}
	err := s.client.call(person, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PersonsGetPersonByDistinctId(ctx, distinctID)
	})
	return person, err
}
