// Package catalog holds what the product, perk, provider and sandbox
// commands share: the kinds people name on the command line, the product
// types, billing periods and stores as the CLI spells them, the listings
// several commands read, and how a command finds the person it names.
package catalog

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"unicode"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// ProductKind is how commands find and name a product: by id, slug or name.
var ProductKind = cli.ItemKind[api.ProductJsonEncoding]{
	Noun:          "product",
	ID:            func(product api.ProductJsonEncoding) string { return product.Id },
	Label:         func(product api.ProductJsonEncoding) string { return product.Name + " (" + product.Slug + ")" },
	ListCommand:   "voidhash product list",
	CreateCommand: "voidhash product create",
	Keys:          func(product api.ProductJsonEncoding) []string { return []string{product.Slug} },
	Names:         func(product api.ProductJsonEncoding) []string { return []string{product.Name} },
}

// PerkKind is how commands find and name a perk: by id, slug or name.
var PerkKind = cli.ItemKind[api.PerkJsonEncoding]{
	Noun:          "perk",
	ID:            func(perk api.PerkJsonEncoding) string { return perk.Id },
	Label:         func(perk api.PerkJsonEncoding) string { return perk.Name + " (" + perk.Slug + ")" },
	ListCommand:   "voidhash perk list",
	CreateCommand: "voidhash perk create",
	Keys:          func(perk api.PerkJsonEncoding) []string { return []string{perk.Slug} },
	Names:         func(perk api.PerkJsonEncoding) []string { return []string{perk.Name} },
}

// Spelling pairs a value as a flag takes it with the API's value.
type Spelling struct{ Flag, API string }

// ProductTypes are the product types as --type takes them.
var ProductTypes = []Spelling{
	{"subscription", "subscription"},
	{"one-time", "one_time"},
	{"consumable", "one_time_consumable"},
}

// BillingPeriods are the billing periods as --period takes them.
var BillingPeriods = []Spelling{
	{"weekly", "weekly"},
	{"monthly", "monthly"},
	{"quarterly", "quarterly"},
	{"semi-annual", "semi_annual"},
	{"annual", "annual"},
}

// ProviderTypes are the payment provider types as commands spell them.
var ProviderTypes = []Spelling{
	{"app-store", "app_store"},
	{"google-play", "google_play"},
	{"stripe", "stripe"},
	{"payment-source", "payment_source"},
}

// FlagValues are the values a flag takes for spellings, in order.
func FlagValues(spellings []Spelling) []string {
	values := make([]string, len(spellings))
	for index, spelling := range spellings {
		values[index] = spelling.Flag
	}
	return values
}

// APIValue is the API's value for what a flag was given; empty when the
// flag value is not one of spellings.
func APIValue(spellings []Spelling, flag string) string {
	for _, spelling := range spellings {
		if spelling.Flag == flag {
			return spelling.API
		}
	}
	return ""
}

func flagValue(spellings []Spelling, apiValue string) string {
	for _, spelling := range spellings {
		if spelling.API == apiValue {
			return spelling.Flag
		}
	}
	return apiValue
}

// Letters with a mark, as the unmarked letters a slug keeps.
var unmarked = map[rune]string{
	'à': "a", 'á': "a", 'â': "a", 'ã': "a", 'ä': "a", 'å': "a", 'ā': "a", 'ă': "a", 'ą': "a",
	'ç': "c", 'ć': "c", 'č': "c", 'ď': "d",
	'è': "e", 'é': "e", 'ê': "e", 'ë': "e", 'ē': "e", 'ė': "e", 'ę': "e", 'ě': "e",
	'ğ': "g", 'ì': "i", 'í': "i", 'î': "i", 'ï': "i", 'ī': "i", 'į': "i", 'ı': "i",
	'ľ': "l", 'ĺ': "l", 'ñ': "n", 'ń': "n", 'ň': "n",
	'ò': "o", 'ó': "o", 'ô': "o", 'õ': "o", 'ö': "o", 'ō': "o", 'ő': "o",
	'ŕ': "r", 'ř': "r", 'ś': "s", 'š': "s", 'ş': "s", 'ť': "t", 'ţ': "t",
	'ù': "u", 'ú': "u", 'û': "u", 'ü': "u", 'ū': "u", 'ů': "u", 'ű': "u", 'ų': "u",
	'ý': "y", 'ÿ': "y", 'ź': "z", 'ż': "z", 'ž': "z",
}

// SlugFrom makes a slug from name: lowercase letters and digits, words
// joined by dashes. Letters with a mark lose it ("Café" is "cafe").
func SlugFrom(name string) string {
	var slug strings.Builder
	pendingDash := false
	write := func(text string) {
		if pendingDash && slug.Len() > 0 {
			slug.WriteByte('-')
		}
		pendingDash = false
		slug.WriteString(text)
	}
	for _, r := range strings.ToLower(name) {
		switch {
		case r >= 'a' && r <= 'z' || r >= '0' && r <= '9':
			write(string(r))
		case unmarked[r] != "":
			write(unmarked[r])
		case unicode.Is(unicode.Mn, r):
			// A combining mark belongs to the letter before it.
		default:
			pendingDash = true
		}
	}
	return slug.String()
}

var typeLabels = map[string]string{
	"subscription":        "Subscription",
	"one_time":            "One-time purchase",
	"one_time_consumable": "Consumable",
}

var periodLabels = map[string]string{
	"weekly":      "weekly",
	"monthly":     "monthly",
	"quarterly":   "quarterly",
	"semi_annual": "every 6 months",
	"annual":      "yearly",
}

func labelOr(labels map[string]string, value string) string {
	if label, ok := labels[value]; ok {
		return label
	}
	return value
}

// ProductTypeLabel is what a product is, as people say it: "Subscription,
// monthly".
func ProductTypeLabel(product api.ProductJsonEncoding) string {
	label := labelOr(typeLabels, string(product.Type))
	if product.BillingPeriod == "" {
		return label
	}
	return label + ", " + labelOr(periodLabels, string(product.BillingPeriod))
}

var storeLabels = map[string]string{
	"app_store":      "App Store",
	"google_play":    "Google Play",
	"stripe":         "Stripe",
	"payment_source": "Payment source",
}

// IsSource reports whether a provider is a payment source rather than a store.
func IsSource(provider api.PaymentProviderJsonEncoding) bool {
	return provider.Type == "payment_source"
}

// StoreLabel is a payment provider as people know it: the store, or a
// payment source's own name.
func StoreLabel(provider api.PaymentProviderJsonEncoding) string {
	if IsSource(provider) {
		return provider.Name
	}
	return labelOr(storeLabels, string(provider.Type))
}

// ProviderLabel is a provider as a list shows it: "App Store
// (com.acme.app)", "Paddle (paddle)".
func ProviderLabel(provider api.PaymentProviderJsonEncoding) string {
	if provider.Key == nil {
		return StoreLabel(provider)
	}
	return StoreLabel(provider) + " (" + *provider.Key + ")"
}

// ProviderHandle is how a provider reads in a command a person types:
// `app-store`, or a payment source's slug.
func ProviderHandle(provider api.PaymentProviderJsonEncoding) string {
	if !IsSource(provider) {
		return flagValue(ProviderTypes, string(provider.Type))
	}
	if provider.Key != nil {
		return *provider.Key
	}
	return provider.Id
}

// ProviderKind is how commands find and name a payment provider: by its id,
// store (`app-store`), key (bundle id, package name, Stripe account, payment
// source slug) and name.
var ProviderKind = cli.ItemKind[api.PaymentProviderJsonEncoding]{
	Noun:          "payment provider",
	ID:            func(provider api.PaymentProviderJsonEncoding) string { return provider.Id },
	Label:         ProviderLabel,
	ListCommand:   "voidhash provider list",
	CreateCommand: "voidhash provider connect",
	Keys: func(provider api.PaymentProviderJsonEncoding) []string {
		var keys []string
		if !IsSource(provider) {
			keys = append(keys, flagValue(ProviderTypes, string(provider.Type)))
		}
		if provider.Key != nil {
			keys = append(keys, *provider.Key)
		}
		return keys
	},
	Names: func(provider api.PaymentProviderJsonEncoding) []string {
		return []string{provider.Name, StoreLabel(provider)}
	},
}

// JSON is the content type of a request body made with [Body].
const JSON = "application/json"

// Body is value as a JSON request body, for an operation's WithBody
// variant: the fields a command leaves out of a map are then left out of
// the request, where a generated body type would send them as null.
func Body(value any) io.Reader {
	encoded, err := json.Marshal(value)
	if err != nil {
		// Commands pass maps of strings, numbers and booleans.
		panic(err)
	}
	return bytes.NewReader(encoded)
}

// ListProducts reads every product of the project.
func ListProducts(ctx context.Context, app *cli.App, projectID string) (cli.List[api.ProductJsonEncoding], error) {
	return cli.ListAll[api.ProductJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// ListPerks reads every perk of the project.
func ListPerks(ctx context.Context, app *cli.App, projectID string) (cli.List[api.PerkJsonEncoding], error) {
	return cli.ListAll[api.PerkJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PerksList(ctx, projectID, &api.PerksListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// ListProductPerks reads the perks a product grants.
func ListProductPerks(ctx context.Context, app *cli.App, projectID, productID string) (cli.List[api.PerkJsonEncoding], error) {
	return cli.ListAll[api.PerkJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ProductsListPerks(ctx, projectID, productID, &api.ProductsListPerksParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// ListProviders reads every payment provider of the project.
func ListProviders(ctx context.Context, app *cli.App, projectID string) (cli.List[api.PaymentProviderJsonEncoding], error) {
	return cli.ListAll[api.PaymentProviderJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaymentProvidersList(ctx, projectID, &api.PaymentProvidersListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// MappingsFilter narrows [ListMappings]; an empty field does not filter.
type MappingsFilter struct{ ProductID, ProviderProductKey string }

// ListMappings reads a provider's store product mappings.
func ListMappings(ctx context.Context, app *cli.App, projectID, providerID string, filter MappingsFilter) (cli.List[api.PaymentProviderProductMappingJsonEncoding], error) {
	params := &api.PaymentProviderProductsListParams{}
	if filter.ProductID != "" {
		params.ProductId = &filter.ProductID
	}
	if filter.ProviderProductKey != "" {
		params.ProviderProductKey = &filter.ProviderProductKey
	}
	return cli.ListAll[api.PaymentProviderProductMappingJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		params.Cursor, params.Limit = page.Cursor, page.Limit
		return c.PaymentProviderProductsList(ctx, projectID, providerID, params)
	})
}

// StoreProduct is a store product mapped to one of the project's products,
// with the store it is in. Raw is the mapping as the server sent it.
type StoreProduct struct {
	Provider api.PaymentProviderJsonEncoding
	Mapping  api.PaymentProviderProductMappingJsonEncoding
	Raw      json.RawMessage
}

// ListStoreProducts reads the store products mapped to the project's
// products across every payment provider, or only those of productID when
// it is not empty: one listing per provider.
func ListStoreProducts(ctx context.Context, app *cli.App, projectID, productID string) ([]StoreProduct, error) {
	providers, err := ListProviders(ctx, app, projectID)
	if err != nil {
		return nil, err
	}
	listings, err := cli.Each(ctx, providers.Items, 4, func(ctx context.Context, provider api.PaymentProviderJsonEncoding) (cli.List[api.PaymentProviderProductMappingJsonEncoding], error) {
		return ListMappings(ctx, app, projectID, provider.Id, MappingsFilter{ProductID: productID})
	})
	if err != nil {
		return nil, err
	}
	var storeProducts []StoreProduct
	for at, provider := range providers.Items {
		mappings := listings[at]
		for index, mapping := range mappings.Items {
			storeProducts = append(storeProducts, StoreProduct{Provider: provider, Mapping: mapping, Raw: mappings.Raw[index]})
		}
	}
	return storeProducts, nil
}

// MappingNote is how a mapping's environment and state read after a store
// product: "", " [test]", " (earlier link)" for a store product linked to
// another product (or none) now, " (not offered)" for a linked one its
// product does not sell.
func MappingNote(environment string, isActive, isSold bool) string {
	note := ""
	if environment != "all" {
		note = " [" + environment + "]"
	}
	switch {
	case !isActive:
		note += " (earlier link)"
	case !isSold:
		note += " (not offered)"
	}
	return note
}
