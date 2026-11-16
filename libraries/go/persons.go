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

// Create creates a person keyed by a distinct id. When a person already has
// the distinct id, it writes the given email and name onto them and returns
// them instead.
func (s *PersonsService) Create(ctx context.Context, params CreatePersonParams) (*Person, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	person := &Person{}
	err = s.client.call(person, func() (*http.Response, error) {
		return s.client.core.PersonsCreate(ctx, projectID, params)
	})
	return person, err
}

// List returns all persons, newest first.
func (s *PersonsService) List(ctx context.Context) ([]Person, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[Person](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.PersonsList(ctx, projectID, &api.PersonsListParams{Cursor: cursor})
	})
}

// Get fetches one person by id.
func (s *PersonsService) Get(ctx context.Context, personID string) (*Person, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	person := &Person{}
	err = s.client.call(person, func() (*http.Response, error) {
		return s.client.core.PersonsGet(ctx, projectID, personID)
	})
	return person, err
}

// SetPersonAttributesParams is the input for [PersonsService.SetAttributes].
//
// This is hand-written rather than aliased to the generated body because the
// generated trait map is a union type that is painful to construct; traits are
// flat scalars, so map[string]any is both accurate and usable.
type SetPersonAttributesParams struct {
	// DistinctID identifies the person. A distinct id Voidhash has not seen
	// creates a person, the same way Create does.
	DistinctID string `json:"-"`
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
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}

	person, err := s.GetByDistinctID(ctx, params.DistinctID)
	if IsNotFound(err) {
		create := CreatePersonParams{DistinctId: params.DistinctID}
		if params.Email != "" {
			create.Email = &params.Email
		}
		if params.Name != "" {
			create.Name = &params.Name
		}
		person, err = s.Create(ctx, create)
	}
	if err != nil {
		return nil, err
	}

	updated := &Person{}
	err = s.client.call(updated, func() (*http.Response, error) {
		return s.client.core.PersonsUpdateWithBody(ctx, projectID, person.Id, "application/json", bytes.NewReader(body))
	})
	return updated, err
}

// GetByDistinctID fetches one person by their distinct id. A distinct id with
// no person fails with a 404 [*APIError] whose Code is "person_not_found".
func (s *PersonsService) GetByDistinctID(ctx context.Context, distinctID string) (*Person, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	result := page[Person]{}
	err = s.client.call(&result, func() (*http.Response, error) {
		return s.client.core.PersonsList(ctx, projectID, &api.PersonsListParams{DistinctId: &distinctID})
	})
	if err != nil {
		return nil, err
	}
	if len(result.Data) == 0 {
		return nil, &APIError{
			StatusCode: http.StatusNotFound,
			Type:       "not_found",
			Code:       "person_not_found",
			Message:    fmt.Sprintf("This project has no person with the distinct id %q.", distinctID),
			Param:      "distinctId",
		}
	}
	return &result.Data[0], nil
}
