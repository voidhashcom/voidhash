package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// storeProduct is a store product as the products command lists it.
type storeProduct struct {
	provider provider
	key      string
	// name is the store's name for it; empty when it has none of its own.
	name          string
	configuration json.RawMessage
	mappings      cli.List[mapping]
	waitingEvents int
}

// storeProducts are the store products of some providers, and the
// providers whose catalog could not be read.
type storeProducts struct {
	rows       []storeProduct
	unreadable []provider
}

// loadStoreProducts reads every store product providers sell, with their
// mappings and the purchases waiting for them.
func loadStoreProducts(ctx context.Context, app *cli.App, projectID string, providers []provider, query catalogQuery) (storeProducts, error) {
	type listings struct {
		entries  cli.List[catalogEntry]
		readable bool
		mappings cli.List[mapping]
		waiting  cli.List[api.PaymentProviderUnmappedProduct]
	}
	read, err := cli.Each(ctx, providers, 4, func(ctx context.Context, found provider) (of listings, err error) {
		if of.entries, of.readable, err = readCatalog(ctx, app, projectID, found, query); err != nil {
			return of, err
		}
		if of.mappings, err = catalog.ListMappings(ctx, app, projectID, found.Id, catalog.MappingsFilter{}); err != nil {
			return of, err
		}
		of.waiting, err = readWaiting(ctx, app, projectID, found)
		return of, err
	})
	var loaded storeProducts
	if err != nil {
		return loaded, err
	}
	for index, found := range providers {
		entries, readable, mappings, waiting := read[index].entries, read[index].readable, read[index].mappings, read[index].waiting
		if !readable {
			loaded.unreadable = append(loaded.unreadable, found)
		}
		listed := map[string]bool{}
		for _, entry := range entries.Items {
			key := entry.ProviderProductKey
			listed[key] = true
			row := storeProduct{
				provider: found, key: key, configuration: entry.Configuration,
				mappings: mappings.Filter(func(candidate mapping) bool { return candidate.ProviderProductKey == key }),
			}
			if entry.Name != key {
				row.name = entry.Name
			}
			for _, product := range waiting.Items {
				if product.ProviderProductKey == key {
					row.waitingEvents = product.EventCount
				}
			}
			loaded.rows = append(loaded.rows, row)
		}
		// Purchases can name store products the catalog does not list, such
		// as archived Stripe prices.
		if query.isUnmapped != nil && !*query.isUnmapped {
			continue
		}
		for _, product := range waiting.Items {
			if !listed[product.ProviderProductKey] {
				loaded.rows = append(loaded.rows, storeProduct{
					provider: found, key: product.ProviderProductKey, waitingEvents: product.EventCount,
					configuration: catalog.Encoded(mappingConfigurationFor(found.Type, product.ProviderProductKey)),
				})
			}
		}
	}
	return loaded, nil
}

func productCell(mappings []mapping, products []api.ProductJsonEncoding) string {
	var cells []string
	for _, candidate := range mappings {
		slug := candidate.ProductId
		for _, product := range products {
			if product.Id == candidate.ProductId {
				slug = product.Slug
			}
		}
		cells = append(cells, slug+catalog.MappingNote(string(candidate.Environment), candidate.IsActive))
	}
	if len(cells) == 0 {
		return "-"
	}
	return strings.Join(cells, ", ")
}

func newProducts(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "products",
		Short: "List the store products providers sell and what each is mapped to.",
		Long: `List the store products the App Store, Google Play, Stripe or a payment source sells, with the product each is mapped to and the purchases waiting for one.

--quiet prints the store product keys, which 'voidhash provider map' takes.`,
		Example: `voidhash provider products
voidhash provider products stripe --unmapped
voidhash provider products app-store --refresh --json`,
	}
	cli.SetArgs(cmd, providerArg)
	unmapped := cmd.Flags().Bool("unmapped", false, "Only store products not mapped to a product yet")
	mapped := cmd.Flags().Bool("mapped", false, "Only store products mapped to a product")
	refresh := cmd.Flags().Bool("refresh", false, "Read the stores again instead of Voidhash's copy, up to an hour old")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if *mapped && *unmapped {
			return cli.Usagef("--mapped and --unmapped cannot be combined.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		selected, err := selectProviders(providers, cli.ArgAt(args, 0))
		if err != nil {
			return err
		}
		query := catalogQuery{refresh: *refresh}
		if *unmapped || *mapped {
			query.isUnmapped = unmapped
		}
		loaded, err := loadStoreProducts(ctx, app, projectID, selected, query)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			items := make([]json.RawMessage, len(loaded.rows))
			for index, row := range loaded.rows {
				name := json.RawMessage("null")
				if row.name != "" {
					name = catalog.Encoded(row.name)
				}
				configuration := row.configuration
				if len(configuration) == 0 {
					configuration = json.RawMessage("{}")
				}
				items[index] = catalog.RawObject(
					catalog.RawField{Name: "paymentProviderId", Value: catalog.Encoded(row.provider.Id)},
					catalog.RawField{Name: "providerProductKey", Value: catalog.Encoded(row.key)},
					catalog.RawField{Name: "name", Value: name},
					catalog.RawField{Name: "configuration", Value: configuration},
					catalog.RawField{Name: "mappings", Value: row.mappings.RawJSON()},
					catalog.RawField{Name: "waitingEvents", Value: catalog.Encoded(row.waitingEvents)},
				)
			}
			return app.PrintJSON(catalog.RawArray(items))
		case cli.Quiet:
			for _, row := range loaded.rows {
				app.Println(cli.Printable(row.key))
			}
			return nil
		}
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		empty := "No store products yet. Create them in the store, then run this again with --refresh."
		if *unmapped {
			empty = "Every store product is mapped to a product."
		}
		anyUnmapped := false
		for _, row := range loaded.rows {
			anyUnmapped = anyUnmapped || len(row.mappings.Items) == 0
		}
		cli.PrintTable(app, []cli.Column[storeProduct]{
			{Header: "PROVIDER", Cell: func(row storeProduct) string { return catalog.ProviderLabel(row.provider) }},
			{Header: "STORE PRODUCT", Cell: func(row storeProduct) string { return row.key }},
			{Header: "NAME", Cell: func(row storeProduct) string {
				if row.name == "" {
					return "-"
				}
				return row.name
			}},
			{Header: "PRODUCT", Cell: func(row storeProduct) string { return productCell(row.mappings.Items, products.Items) }},
			{Header: "WAITING", Cell: func(row storeProduct) string {
				if row.waitingEvents == 0 {
					return "-"
				}
				return plural(row.waitingEvents, "event")
			}},
		}, loaded.rows, empty)
		for _, failing := range loaded.unreadable {
			app.Warnf("%s", cli.Printable(catalogProblem(failing)))
		}
		if anyUnmapped {
			app.Notef("Map one to a product with 'voidhash provider map <store-product> <product>'.")
		}
		return nil
	}
	return cmd
}

const mapUsage = "voidhash provider map <store-product> <product> [--provider <provider>] [--environment all|production|test]"

const providerFlagUsage = "The provider selling it (app-store, google-play, stripe, a payment source's slug); needed only when several do"

// mappingScope is how a mapping's environment reads after a store product:
// "", or " (test purchases)".
func mappingScope(environment string) string {
	if environment == "all" {
		return ""
	}
	return " (" + environment + " purchases)"
}

// locateStoreProduct finds the provider selling key, and its catalog entry:
// the one named by --provider, else the provider whose catalog or waiting
// purchases name it, else the only provider.
func locateStoreProduct(ctx context.Context, app *cli.App, projectID string, providers cli.List[provider], key, providerInput string) (storeProduct, error) {
	named, err := selectProviders(providers, providerInput)
	if err != nil {
		return storeProduct{}, err
	}
	loaded, err := loadStoreProducts(ctx, app, projectID, named, catalogQuery{})
	if err != nil {
		return storeProduct{}, err
	}
	var matching []storeProduct
	for _, row := range loaded.rows {
		if row.key == key {
			matching = append(matching, row)
		}
	}
	switch {
	case len(matching) == 1:
		return matching[0], nil
	case len(matching) > 1:
		lines := []string{fmt.Sprintf("Several providers sell %q:", key)}
		for _, row := range matching {
			lines = append(lines, "  "+catalog.ProviderLabel(row.provider)+"  "+row.provider.Id)
		}
		return storeProduct{}, cli.Usagef("%s", strings.Join(lines, "\n")).WithHint("Pass the one you mean with --provider.")
	case len(named) == 1:
		// A store product the catalog does not list, such as an archived Stripe price.
		return storeProduct{
			provider: named[0], key: key,
			configuration: catalog.Encoded(mappingConfigurationFor(named[0].Type, key)),
		}, nil
	}
	return storeProduct{}, &cli.UserError{
		Message:  fmt.Sprintf("No provider lists a store product %q.", key),
		Hint:     "'voidhash provider products' lists them. To map one a catalog does not list, such as an archived Stripe price (prod_...:price_...), pass --provider.",
		ExitCode: cli.ExitNotFound,
	}
}

// requireStoreProduct is the store product a command's argument names; on
// a terminal, chosen among the unmapped ones.
func requireStoreProduct(ctx context.Context, app *cli.App, projectID string, providers cli.List[provider], input, providerInput, usage string) (storeProduct, error) {
	if input != "" {
		return locateStoreProduct(ctx, app, projectID, providers, input, providerInput)
	}
	if !app.IsInteractive() {
		return storeProduct{}, cli.MissingInput("the store product", usage)
	}
	named, err := selectProviders(providers, providerInput)
	if err != nil {
		return storeProduct{}, err
	}
	onlyUnmapped := true
	loaded, err := loadStoreProducts(ctx, app, projectID, named, catalogQuery{isUnmapped: &onlyUnmapped})
	if err != nil {
		return storeProduct{}, err
	}
	if len(loaded.rows) == 0 {
		return storeProduct{}, &cli.UserError{
			Message:  "Every store product is mapped to a product.",
			Hint:     "Name one to move it: 'voidhash provider products --mapped' lists them.",
			ExitCode: cli.ExitNotFound,
		}
	}
	labels := make([]string, len(loaded.rows))
	for index, row := range loaded.rows {
		labels[index] = catalog.ProviderLabel(row.provider) + ": " + row.key
		if row.name != "" {
			labels[index] += fmt.Sprintf(" %q", row.name)
		}
		labels[index] = cli.Printable(labels[index])
	}
	index, err := app.Prompter().Select(ctx, "Which store product?", labels)
	if err != nil {
		return storeProduct{}, err
	}
	return loaded.rows[index], nil
}

// offer is an offer a paywall can sell on a store product.
type offer struct {
	ID      string `json:"id"`
	OfferID string `json:"offerId"`
}

func parseOffers(inputs []string) ([]offer, error) {
	offers := make([]offer, 0, len(inputs))
	for _, text := range inputs {
		id, offerID, _ := strings.Cut(text, "=")
		if id == "" || offerID == "" {
			return nil, cli.Usagef("--offer %s is not <id>=<store offer id>.", text).
				WithHint("For example --offer win-back=WINBACK50: paywalls name it win-back, the store WINBACK50.")
		}
		offers = append(offers, offer{ID: id, OfferID: offerID})
	}
	return offers, nil
}

func newMap(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "map",
		Short: "Map a store product to a product, so buying it grants the product's perks.",
		Long: `Map a store product to a product, so buying it grants the product's perks. Without arguments it asks for both in a terminal, offering the store products not mapped yet.

Moving one mapped to another product asks first; --yes skips that. A payment source whose test system names products differently maps each key with --environment production or test.`,
		Example: `voidhash provider map com.acme.pro.monthly pro-monthly
voidhash provider map prod_123:price_456 pro-annual --provider stripe
voidhash provider map com.acme.pro.monthly pro-monthly --offer win-back=WINBACK50`,
	}
	cli.SetArgs(cmd,
		cli.Arg{Name: "store-product", Help: "The store's id for it, as 'provider products' lists it (a Stripe price is prod_...:price_...)", Optional: true},
		cli.Arg{Name: "product", Help: "The product buying it grants: its slug, name or id", Optional: true},
	)
	providerInput := cmd.Flags().String("provider", "", providerFlagUsage)
	offerInputs := cli.AddStringsFlag(cmd, "offer", "", "An offer a paywall can sell on it, as `id=store-offer-id`; repeat for each. Replaces the saved offers")
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"all", "production", "test"}, "",
		"For a payment source whose test system names products differently: the purchases this store product key names (default all). App Store and Google Play products name every environment, and a Stripe price's mode decides its own")
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		offers, err := parseOffers(*offerInputs)
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		store, err := requireStoreProduct(ctx, app, projectID, providers, cli.ArgAt(args, 0), *providerInput, mapUsage)
		if err != nil {
			return err
		}
		isSource := catalog.IsSource(store.provider)
		if *environment != "" && !isSource {
			hint := "Its store products keep their ids in the store's sandbox, so one mapping serves every environment."
			if store.provider.Type == "stripe" {
				hint = "Voidhash reads it from the price: a live price names production purchases, a test price test ones."
			}
			return cli.Usagef("--environment is for payment sources, not %s.", catalog.ProviderLabel(store.provider)).WithHint(hint)
		}
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		product, err := cli.RequireItem(ctx, app, catalog.ProductKind, products.Items, cli.ArgAt(args, 1), mapUsage)
		if err != nil {
			return err
		}
		productLabel := catalog.ProductKind.Label(product)
		where := catalog.ProviderLabel(store.provider) + " " + store.key
		mappings, err := catalog.ListMappings(ctx, app, projectID, store.provider.Id, catalog.MappingsFilter{ProviderProductKey: store.key})
		if err != nil {
			return err
		}
		find := func(isActive, sameProduct bool) (cli.Object[mapping], bool) {
			for index, candidate := range mappings.Items {
				if candidate.IsActive == isActive && (candidate.ProductId == product.Id) == sameProduct {
					return mappings.Object(index), true
				}
			}
			return cli.Object[mapping]{}, false
		}
		withOffers := func(configuration map[string]any) map[string]any {
			if len(offers) == 0 {
				return configuration
			}
			saved := map[string]any{}
			for key, value := range configuration {
				saved[key] = value
			}
			saved["offers"] = offers
			return saved
		}
		// update saves the offers and a new environment on a mapping; changed
		// is false when neither differs from what is saved.
		update := func(existing mapping) (updated cli.Object[mapping], newEnvironment string, changed bool, err error) {
			if *environment != "" && *environment != string(existing.Environment) {
				newEnvironment = *environment
			}
			if len(offers) == 0 && newEnvironment == "" {
				return updated, "", false, nil
			}
			body := map[string]any{"configuration": withOffers(existing.Configuration)}
			if newEnvironment != "" {
				body["environment"] = newEnvironment
			}
			updated, err = cli.Fetch[mapping](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PaymentProviderProductsUpdateWithBody(ctx, projectID, store.provider.Id, existing.Id, catalog.JSON, catalog.Body(body))
			})
			return updated, newEnvironment, true, err
		}

		if activeSame, ok := find(true, true); ok {
			updated, newEnvironment, changed, err := update(activeSame.Value)
			if err != nil {
				return err
			}
			if !changed {
				return app.PrintItem(mode, activeSame, fmt.Sprintf("%s%s is already mapped to %s.",
					where, mappingScope(string(activeSame.Value.Environment)), productLabel))
			}
			var lines []string
			if len(offers) > 0 {
				ids := make([]string, len(offers))
				for index, saved := range offers {
					ids[index] = saved.ID
				}
				lines = append(lines, fmt.Sprintf("Saved the offers of %s: %s.", where, strings.Join(ids, ", ")))
			}
			switch newEnvironment {
			case "":
			case "all":
				lines = append(lines, where+" now names purchases of every environment.")
			default:
				lines = append(lines, fmt.Sprintf("%s now names %s purchases only.", where, newEnvironment))
			}
			return app.PrintItem(mode, updated, strings.Join(lines, "\n"))
		}

		inactiveSame, hasInactiveSame := find(false, true)
		if activeOther, ok := find(true, false); ok {
			previousLabel := activeOther.Value.ProductId
			for _, candidate := range products.Items {
				if candidate.Id == activeOther.Value.ProductId {
					previousLabel = catalog.ProductKind.Label(candidate)
				}
			}
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
				"%s is mapped to %s. Move it to %s? Its purchases and renewals from now on grant %s's perks instead.",
				where, previousLabel, productLabel, product.Name)); err != nil {
				return err
			}
			configuration := activeOther.Value.Configuration
			if hasInactiveSame {
				configuration = inactiveSame.Value.Configuration
			}
			body := map[string]any{"productId": product.Id, "configuration": withOffers(configuration), "isReassignment": true}
			// A payment source's key keeps the purchases it named unless told otherwise.
			if isSource {
				body["environment"] = string(activeOther.Value.Environment)
				if *environment != "" {
					body["environment"] = *environment
				}
			}
			moved, err := cli.Fetch[mapping](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PaymentProviderProductsCreateWithBody(ctx, projectID, store.provider.Id, catalog.JSON, catalog.Body(body))
			})
			if err != nil {
				return err
			}
			return app.PrintItem(mode, moved, fmt.Sprintf("Moved %s from %s to %s.", where, previousLabel, productLabel))
		}

		if hasInactiveSame {
			if _, _, _, err := update(inactiveSame.Value); err != nil {
				return err
			}
			activated, err := cli.Fetch[mapping](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PaymentProviderProductsActivate(ctx, projectID, store.provider.Id, inactiveSame.Value.Id)
			})
			if err != nil {
				return err
			}
			return app.PrintItem(mode, activated, fmt.Sprintf("Mapped %s to %s again.", where, productLabel))
		}

		body := map[string]any{"productId": product.Id, "configuration": withOffers(decodeObject(store.configuration))}
		if *environment != "" {
			body["environment"] = *environment
		}
		created, err := cli.Fetch[mapping](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProviderProductsCreateWithBody(ctx, projectID, store.provider.Id, catalog.JSON, catalog.Body(body))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invalid_product_mapping": "Name the store product as 'voidhash provider products' lists it: a Stripe price is prod_...:price_..., a Google Play base plan productId:basePlanId (offers need one).",
			})
		}
		human := fmt.Sprintf("Mapped %s%s to %s. Buying it now grants %s's perks", where, mappingScope(string(created.Value.Environment)), productLabel, product.Name)
		if store.waitingEvents > 0 {
			human += fmt.Sprintf("; the %s waiting for it are applied in the background", plural(store.waitingEvents, "purchase event"))
		}
		return app.PrintItem(mode, created, human+".")
	}
	return cmd
}

func newUnmap(app *cli.App) *cobra.Command {
	const usage = "voidhash provider unmap <store-product> [--provider <provider>]"
	cmd := &cobra.Command{
		Use:   "unmap",
		Short: "Remove a store product's mapping to a product made by mistake.",
		Long:  "Remove a store product's mapping to a product made by mistake. Asks first when the mapping is active; --yes skips that. A mapping purchases were recorded under stays; move it with 'voidhash provider map' instead.",
		Example: `voidhash provider unmap com.acme.pro.monthly --yes
voidhash provider unmap prod_123:price_456 --provider stripe --product pro-annual`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "store-product", Help: "The store's id for it, as 'provider products' lists it", Optional: true})
	providerInput := cmd.Flags().String("provider", "", providerFlagUsage)
	productInput := cmd.Flags().String("product", "", "The product to unmap it from, when it has mappings to several")
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if cli.ArgAt(args, 0) == "" {
			return cli.MissingInput("the store product", usage)
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		store, err := locateStoreProduct(ctx, app, projectID, providers, cli.ArgAt(args, 0), *providerInput)
		if err != nil {
			return err
		}
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		where := catalog.ProviderLabel(store.provider) + " " + store.key
		candidates, wantedLabel := store.mappings, ""
		if *productInput != "" {
			wanted, err := cli.FindItem(catalog.ProductKind, products.Items, *productInput)
			if err != nil {
				return err
			}
			wantedLabel = " to " + catalog.ProductKind.Label(wanted)
			candidates = candidates.Filter(func(candidate mapping) bool { return candidate.ProductId == wanted.Id })
		}
		switch {
		case len(candidates.Items) == 0:
			return &cli.UserError{
				Message:  fmt.Sprintf("%s is not mapped%s.", where, wantedLabel),
				Hint:     "'voidhash provider products --mapped' lists the mappings.",
				ExitCode: cli.ExitNotFound,
			}
		case len(candidates.Items) > 1:
			return cli.Usagef("%s is mapped to several products.", where).WithHint("Pass the one to remove with --product.")
		}
		found := candidates.Object(0)
		fromLabel := found.Value.ProductId
		for _, candidate := range products.Items {
			if candidate.Id == found.Value.ProductId {
				fromLabel = catalog.ProductKind.Label(candidate)
			}
		}
		if found.Value.IsActive {
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Unmap %s from %s? Buying it then grants nothing until it is mapped again.", where, fromLabel)); err != nil {
				return err
			}
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProviderProductsDelete(ctx, projectID, store.provider.Id, found.Value.Id)
		}); err != nil {
			return cli.APIError(err, map[string]string{
				"product_mapping_has_purchases": fmt.Sprintf("Purchases were recorded under it, so it stays. Move it to another product with 'voidhash provider map %s <product>'.", store.key),
			})
		}
		return app.PrintItem(mode, found, fmt.Sprintf("Unmapped %s from %s.", where, fromLabel))
	}
	return cmd
}
