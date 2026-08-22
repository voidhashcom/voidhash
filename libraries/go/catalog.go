package voidhash

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// ProductsService lists products and their perk associations.
type ProductsService struct {
	client *Client
}

// List returns all products.
func (s *ProductsService) List(ctx context.Context) ([]Product, error) {
	var products []Product
	err := s.client.call(&products, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ProductsListProducts(ctx)
	})
	return products, err
}

// PerksByProduct returns every product-perk association of a product.
func (s *ProductsService) PerksByProduct(ctx context.Context, productID string) ([]ProductPerk, error) {
	var perks []ProductPerk
	err := s.client.call(&perks, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.ProductPerksListProductPerksByProductId(ctx, productID)
	})
	return perks, err
}

// PerksService lists entitlement perk definitions.
type PerksService struct {
	client *Client
}

// List returns all perks.
func (s *PerksService) List(ctx context.Context) ([]Perk, error) {
	var perks []Perk
	err := s.client.call(&perks, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PerksListPerks(ctx)
	})
	return perks, err
}

// PaywallsService lists paywall locations and manages paywall deploys.
type PaywallsService struct {
	client *Client
}

// Locations returns all deployable paywall locations.
func (s *PaywallsService) Locations(ctx context.Context) ([]PaywallLocation, error) {
	var locations []PaywallLocation
	err := s.client.call(&locations, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PaywallLocationsListPaywallLocations(ctx)
	})
	return locations, err
}

// CreateDeployParams is the manifest for [PaywallsService.CreateDeploy]. The
// deploy manifest is a free-form JSON object defined by the paywall compiler,
// so it is passed through verbatim.
type CreateDeployParams struct {
	Manifest json.RawMessage
}

// CreateDeploy registers a new paywall deploy from a manifest. Blobs maps each
// content sha256 to its raw bytes; every blob is uploaded before the deploy is
// finalized, mirroring the documented create/upload/finalize lifecycle.
func (s *PaywallsService) CreateDeploy(ctx context.Context, params CreateDeployParams) (*api.CreatePaywallDeployResponseJsonEncoding, error) {
	response := &api.CreatePaywallDeployResponseJsonEncoding{}
	err := s.client.call(response, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PaywallDeploysCreateDeploy(ctx, params.Manifest)
	})
	if err != nil {
		return nil, err
	}
	return response, nil
}

// UploadBlob uploads one binary blob for a pending deploy. The sha256 must be
// the lowercase hex digest of the blob contents.
func (s *PaywallsService) UploadBlob(ctx context.Context, deployID, sha256 string, blob []byte) (*api.UploadPaywallDeployBlobResponseJsonEncoding, error) {
	response := &api.UploadPaywallDeployBlobResponseJsonEncoding{}
	err := s.client.call(response, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PaywallDeploysUploadBlobWithBody(ctx, deployID, sha256, "application/octet-stream", bytes.NewReader(blob))
	})
	return response, err
}

// FinalizeDeploy completes a pending deploy after all blobs are uploaded.
func (s *PaywallsService) FinalizeDeploy(ctx context.Context, deployID string) (*api.FinalizePaywallDeployResponseJsonEncoding, error) {
	response := &api.FinalizePaywallDeployResponseJsonEncoding{}
	err := s.client.call(response, func(_ ...api.RequestEditorFn) (*http.Response, error) {
		return s.client.core.PaywallDeploysFinalizeDeploy(ctx, deployID)
	})
	return response, err
}
