package voidhash

import (
	"context"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// ProductsService lists products and the perks they grant.
type ProductsService struct {
	client *Client
}

// List returns all products.
func (s *ProductsService) List(ctx context.Context) ([]Product, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[Product](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: cursor})
	})
}

// PerksByProduct returns the perks buying a product grants.
func (s *ProductsService) PerksByProduct(ctx context.Context, productID string) ([]Perk, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[Perk](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.ProductsListPerks(ctx, projectID, productID, &api.ProductsListPerksParams{Cursor: cursor})
	})
}

// PerksService lists entitlement perk definitions.
type PerksService struct {
	client *Client
}

// List returns all perks.
func (s *PerksService) List(ctx context.Context) ([]Perk, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	return listAll[Perk](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.PerksList(ctx, projectID, &api.PerksListParams{Cursor: cursor})
	})
}

// PaywallsService lists paywall locations.
type PaywallsService struct {
	client *Client
}

// Locations returns every paywall location that is not archived, with what
// each shows now.
func (s *PaywallsService) Locations(ctx context.Context) ([]PaywallLocation, error) {
	projectID, err := s.client.project(ctx)
	if err != nil {
		return nil, err
	}
	notArchived := api.PaywallLocationsListParamsIsArchivedFalse
	return listAll[PaywallLocation](s.client, func(cursor *string) (*http.Response, error) {
		return s.client.core.PaywallLocationsList(ctx, projectID, &api.PaywallLocationsListParams{
			Cursor:     cursor,
			IsArchived: &notArchived,
		})
	})
}
