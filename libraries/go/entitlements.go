package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// EntitlementsService resolves entitlements for persons. Access it through
// [Client.Persons].
type EntitlementsService struct {
	client *Client
}

// GrantsByDistinctID resolves a person by distinct id and returns the perks
// they can use now, one grant per perk, including access shared by persons
// merged into them. An unknown distinct id fails with a 404 [*APIError].
func (s *EntitlementsService) GrantsByDistinctID(ctx context.Context, distinctID string) ([]EntitlementGrant, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	person, err := s.client.Persons.GetByDistinctID(ctx, distinctID)
	if err != nil {
		return nil, err
	}
	return listAll[EntitlementGrant](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.PersonsListEntitlements(ctx, projectID, person.Id, &api.PersonsListEntitlementsParams{Cursor: cursor})
	})
}

// HasActivePerkParams selects exactly one perk by id or slug.
type HasActivePerkParams struct {
	DistinctID string
	PerkID     string
	PerkSlug   string
}

// HasActivePerk reports whether the person holds an active grant for a perk,
// selected either by PerkID or PerkSlug.
//
// An unknown DistinctID — and an unknown PerkSlug — resolve to false: a person
// Voidhash has never seen has no access. Authentication and server failures
// are still returned as errors, so a broken secret key is never mistaken for
// "no access".
func (s *EntitlementsService) HasActivePerk(ctx context.Context, params HasActivePerkParams) (bool, error) {
	if (params.PerkID == "") == (params.PerkSlug == "") {
		return false, newConfigurationError("hasActivePerk requires exactly one of PerkID or PerkSlug")
	}

	grants, err := s.GrantsByDistinctID(ctx, params.DistinctID)
	if err != nil {
		if IsNotFound(err) {
			return false, nil
		}
		return false, err
	}

	// Every grant listed is active; a grant whose perk was deleted has no slug.
	for _, grant := range grants {
		if params.PerkID != "" && grant.PerkId == params.PerkID {
			return true, nil
		}
		if params.PerkSlug != "" && grant.PerkSlug != nil && *grant.PerkSlug == params.PerkSlug {
			return true, nil
		}
	}
	return false, nil
}
