package provider

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	voidhash "github.com/voidhashcom/voidhash/libraries/go"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// provider is a payment provider, short for the commands of this package.
type provider = api.PaymentProviderJsonEncoding

// mapping is a store product's mapping to a product.
type mapping = api.PaymentProviderProductMappingJsonEncoding

var providerArg = cli.Arg{
	Name:     "provider",
	Help:     "The provider: app-store, google-play, stripe, a payment source's slug or name, or its id",
	Optional: true,
}

func plural(count int, noun string) string {
	if count == 1 {
		return "1 " + noun
	}
	return fmt.Sprintf("%d %ss", count, noun)
}

// isImportable reports whether Voidhash can import the provider's purchase history.
func isImportable(found provider) bool {
	return found.Type == "stripe" || found.Type == "payment_source"
}

// catalogEntry is a store product a provider sells, with its configuration
// and mappings kept as the server sent them.
type catalogEntry struct {
	ProviderProductKey string            `json:"providerProductKey"`
	Name               string            `json:"name"`
	Configuration      json.RawMessage   `json:"configuration"`
	Mappings           []json.RawMessage `json:"mappings"`
}

// catalogQuery is which store products [readCatalog] reads.
type catalogQuery struct {
	// refresh reads the store again instead of the saved copy.
	refresh bool
	// isUnmapped keeps only the unmapped (true) or mapped (false) ones; nil keeps all.
	isUnmapped *bool
}

// readCatalog reads the store products a provider sells, from the store or
// the payment source's endpoint. ok is false when the store refused the
// saved credentials or did not answer, which the caller reports.
func readCatalog(ctx context.Context, app *cli.App, projectID string, found provider, query catalogQuery) (entries cli.List[catalogEntry], ok bool, err error) {
	params := &api.PaymentProvidersListCatalogParams{}
	if query.isUnmapped != nil {
		value := api.PaymentProvidersListCatalogParamsIsUnmapped(fmt.Sprint(*query.isUnmapped))
		params.IsUnmapped = &value
	}
	entries, err = cli.ListAll[catalogEntry](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		params.Cursor, params.Limit, params.Refresh = page.Cursor, page.Limit, nil
		// Refreshing reads the whole catalog from the store again, so only the first page asks.
		if query.refresh && page.Cursor == nil {
			refresh := api.PaymentProvidersListCatalogParamsRefresh("true")
			params.Refresh = &refresh
		}
		return c.PaymentProvidersListCatalog(ctx, projectID, found.Id, params)
	})
	var apiErr *voidhash.APIError
	if errors.As(err, &apiErr) && apiErr.StatusCode >= 500 {
		app.Debugf("Reading the catalog of %s failed: %v", found.Id, err)
		return cli.List[catalogEntry]{}, false, nil
	}
	return entries, err == nil, err
}

// readWaiting reads the store products whose imported purchases wait for a
// mapping, most waiting first.
func readWaiting(ctx context.Context, app *cli.App, projectID string, found provider) (cli.List[api.PaymentProviderUnmappedProduct], error) {
	return cli.ListAll[api.PaymentProviderUnmappedProduct](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaymentProvidersListUnmappedProducts(ctx, projectID, found.Id,
			&api.PaymentProvidersListUnmappedProductsParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// catalogProblem says why a provider's store products could not be read,
// and what to run.
func catalogProblem(found provider) string {
	label, handle := catalog.ProviderLabel(found), catalog.ProviderHandle(found)
	if catalog.IsSource(found) {
		return fmt.Sprintf("Voidhash could not read %s's products from its endpoint; 'voidhash provider test %s' says why.", label, handle)
	}
	restricted := ""
	if found.Type == "stripe" {
		restricted = " (a restricted key needs read access to Prices and Products)"
	}
	return fmt.Sprintf("Voidhash could not read %s's store products: the saved credentials may be wrong or expired%s, or the store did not answer. 'voidhash provider test %s' checks again; 'voidhash provider connect %s' saves new credentials.",
		label, restricted, handle, handle)
}

// notification is the address a store sends its notifications to, and
// where a person sets it.
type notification struct{ url, where string }

// notificationTarget is where the provider's store sends notifications; ok
// is false for a payment source, which has none.
func notificationTarget(apiURL string, found provider) (target notification, ok bool) {
	base := strings.TrimRight(apiURL, "/")
	if !strings.HasSuffix(base, "/api") {
		base += "/api"
	}
	base += "/v1/inbound-webhooks"
	switch found.Type {
	case "app_store":
		return notification{
			url:   base + "/apple-server-to-server/" + found.Id,
			where: "the App Store Server Notifications URL (version 2) of the app in App Store Connect",
		}, true
	case "google_play":
		return notification{
			url:   base + "/google-play-rtdn/" + found.Id,
			where: "the push endpoint of the Pub/Sub subscription to the app's real-time developer notifications topic",
		}, true
	case "stripe":
		return notification{
			url:   base + "/stripe/" + found.Id,
			where: "a webhook endpoint in Stripe, live and test mode, whose signing secrets Voidhash then needs",
		}, true
	}
	return notification{}, false
}

// endpointURL is the URL of a payment source's endpoint from its stored
// configuration: `endpoint` serves production requests (and test ones
// without a test endpoint), `testEndpoint` serves only test requests. It is
// empty when the endpoint is not connected.
func endpointURL(found provider, which string) string {
	endpoint, _ := found.Configuration[which].(map[string]any)
	url, _ := endpoint["url"].(string)
	return url
}

// mappingConfigurationFor is the configuration a mapping of storeProductKey
// takes when the catalog does not list it: a Stripe `prod_…:price_…` pair,
// a Google Play `productId:basePlanId`, an App Store product id or a
// payment source key.
func mappingConfigurationFor(providerType api.PaymentProviderType, storeProductKey string) map[string]any {
	first, second, _ := strings.Cut(storeProductKey, ":")
	switch providerType {
	case "app_store":
		return map[string]any{"productId": storeProductKey}
	case "payment_source":
		return map[string]any{"productKey": storeProductKey}
	case "google_play":
		if second == "" {
			return map[string]any{"productId": first}
		}
		return map[string]any{"productId": first, "basePlanId": second}
	}
	return map[string]any{"productId": first, "priceId": second}
}

// describeImport is an import's progress in one line: "running, recording
// them: 300 found, 120 recorded".
func describeImport(historyImport api.PaymentProviderHistoryImport) string {
	counts := historyImport.Counts
	tally := []string{fmt.Sprintf("%d found", counts.Total), fmt.Sprintf("%d recorded", counts.Applied)}
	if counts.Ignored != 0 {
		tally = append(tally, fmt.Sprintf("%d needed no change", counts.Ignored))
	}
	if counts.Parked != 0 {
		tally = append(tally, fmt.Sprintf("%d waiting for a store product mapping", counts.Parked))
	}
	if counts.Failed != 0 {
		tally = append(tally, fmt.Sprintf("%d failed", counts.Failed))
	}
	state := string(historyImport.Status)
	if state == "running" {
		state = "running, recording them"
		if historyImport.Phase == "collecting" {
			state = "running, listing the store's records"
		}
	}
	line := state + ": " + strings.Join(tally, ", ")
	if historyImport.LastError != nil {
		line += " (last error: " + *historyImport.LastError + ")"
	}
	return line
}

// storedSecret is what a stored credential reads as; sending it back keeps
// the stored one.
const storedSecret = "<stored secret>"

// newSigningSecret makes a signing secret for one of a payment source's
// endpoints; it is shown once and stored encrypted.
func newSigningSecret() string {
	var random [32]byte
	// crypto/rand does not fail on the systems the CLI runs on.
	_, _ = rand.Read(random[:])
	return "vhps_" + base64.RawURLEncoding.EncodeToString(random[:])
}

// findProvider returns the provider input names, or every provider when
// input is empty.
func selectProviders(providers cli.List[provider], input string) ([]provider, error) {
	if input == "" {
		return providers.Items, nil
	}
	found, err := cli.FindItem(catalog.ProviderKind, providers.Items, input)
	if err != nil {
		return nil, err
	}
	return []provider{found}, nil
}

// decodeObject is raw as a JSON object; empty when it is not one.
func decodeObject(raw json.RawMessage) map[string]any {
	object := map[string]any{}
	_ = json.Unmarshal(raw, &object)
	return object
}
