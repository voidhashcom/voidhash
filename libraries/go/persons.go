package voidhash

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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

// SetPersonAttributesParams is the body for [PersonsService.SetAttributes].
//
// This is hand-written rather than aliased to the generated body because the
// generated trait map is a union type that is painful to construct; traits are
// flat scalars, so map[string]any is both accurate and usable.
type SetPersonAttributesParams struct {
	// DistinctID identifies the person. A distinct id Voidhash has not seen
	// creates a person, the same way Create does.
	DistinctID string `json:"distinctId"`
	// Email sets the person's email address.
	Email string `json:"email,omitempty"`
	// Name sets the person's display name.
	Name string `json:"name,omitempty"`
	// Traits are `$set` attributes — the newest write wins per key.
	Traits map[string]any `json:"traits,omitempty"`
	// SetOnce are `$set_once` attributes — the earliest write wins, and any
	// Traits write beats them.
	SetOnce map[string]any `json:"setOnce,omitempty"`
}

// SetAttributes writes profile fields and traits for the person with the given
// distinct id, creating the person when the distinct id is new.
//
// Traits describe the person and persist across events, so a fact like a
// subscription plan belongs here rather than repeated on every event's
// properties.
func (s *PersonsService) SetAttributes(ctx context.Context, params SetPersonAttributesParams) (*Person, error) {
	body, err := json.Marshal(params)
	if err != nil {
		return nil, fmt.Errorf("voidhash: encoding person attributes: %w", err)
	}

	person := &Person{}
	err = s.client.call(person, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PersonsSetPersonAttributesWithBody(ctx, "application/json", bytes.NewReader(body))
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
