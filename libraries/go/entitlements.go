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

// GrantsByDistinctID resolves a person by distinct id and returns their
// entitlement grants. An unknown distinct id fails with a 404 [*APIError].
func (s *EntitlementsService) GrantsByDistinctID(ctx context.Context, distinctID string) ([]EntitlementGrant, error) {
	person, err := s.client.Persons.GetByDistinctID(ctx, distinctID)
	if err != nil {
		return nil, err
	}

	entitlements := &api.PersonEntitlementsResponseJsonEncoding{}
	err = s.client.call(entitlements, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PersonsGetPersonEntitlements(ctx, person.PersonId)
	})
	if err != nil {
		return nil, err
	}
	return entitlements.Grants, nil
}

// HasActivePerkParams selects exactly one perk by id or slug.
type HasActivePerkParams struct {
	DistinctID string
	PerkID     string
	PerkSlug   string
}

// HasActivePerk reports whether the person holds an active grant for a perk,
// selected either by PerkID or PerkSlug (resolved through [PerksService.List]).
//
// An unknown DistinctID — and an unknown PerkSlug — resolve to false: a person
// Voidhash has never seen has no access. Authentication and server failures
// are still returned as errors, so a broken secret key is never mistaken for
// "no access".
func (s *EntitlementsService) HasActivePerk(ctx context.Context, params HasActivePerkParams) (bool, error) {
	if (params.PerkID == "") == (params.PerkSlug == "") {
		return false, newConfigurationError("hasActivePerk requires exactly one of PerkID or PerkSlug")
	}

	perkID := params.PerkID
	if perkID == "" {
		perks, err := s.client.Perks.List(ctx)
		if err != nil {
			return false, err
		}
		for _, perk := range perks {
			if perk.Slug == params.PerkSlug {
				perkID = perk.Id
				break
			}
		}
		if perkID == "" {
			return false, nil
		}
	}

	grants, err := s.GrantsByDistinctID(ctx, params.DistinctID)
	if err != nil {
		if IsNotFound(err) {
			return false, nil
		}
		return false, err
	}

	for _, grant := range grants {
		if grant.PerkId == perkID && grant.Status == "active" {
			return true, nil
		}
	}
	return false, nil
}
