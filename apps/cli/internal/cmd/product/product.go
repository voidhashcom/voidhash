// Package product holds `voidhash product`: the products people buy and
// the perks they grant.
package product

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// New creates `voidhash product`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "product",
		Aliases: []string{"products"},
		Short:   "The products people buy, and the perks they grant.",
		Long:    "The products people buy: list, view, create, edit and delete them, and choose the perks they grant.",
	}
	perks := &cobra.Command{
		Use:   "perks",
		Short: "Choose the perks a product grants.",
	}
	perks.AddCommand(newPerksSet(app))
	cmd.AddCommand(newList(app), newView(app), newCreate(app), newEdit(app), newDelete(app), perks)
	return cmd
}

var productArg = cli.Arg{Name: "product", Help: "The product's slug, name or id", Optional: true}

// slugs are the slugs of perks, or "no perks".
func slugs(perks []api.PerkJsonEncoding) string {
	if len(perks) == 0 {
		return "no perks"
	}
	names := make([]string, len(perks))
	for index, perk := range perks {
		names[index] = perk.Slug
	}
	return strings.Join(names, ", ")
}

func slugTakenHint(slug string) string {
	return fmt.Sprintf("Choose another --slug; 'voidhash product view %s' shows the product that has it.", slug)
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's products.",
		Long:  "List the project's products with the perks they grant and the stores they are sold in.",
		Example: `voidhash product list
voidhash product list --type subscription --json`,
	}
	project := cli.AddProjectFlag(cmd)
	productType := cli.AddChoiceFlag(cmd, "type", "", catalog.FlagValues(catalog.ProductTypes), "", "Only products of this type")
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		params := &api.ProductsListParams{}
		if *productType != "" {
			wanted := api.ProductType(catalog.APIValue(catalog.ProductTypes, *productType))
			params.Type = &wanted
		}
		products, err := cli.ListAll[api.ProductJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			params.Cursor, params.Limit = page.Cursor, page.Limit
			return c.ProductsList(ctx, projectID, params)
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(products)
		case cli.Quiet:
			app.PrintIDs(products)
			return nil
		}

		// Only people see what each product grants and where it is sold, so
		// only they wait for it.
		granted, err := cli.Each(ctx, products.Items, 8, func(ctx context.Context, product api.ProductJsonEncoding) (cli.List[api.PerkJsonEncoding], error) {
			return catalog.ListProductPerks(ctx, app, projectID, product.Id)
		})
		if err != nil {
			return err
		}
		perksOf := map[string]string{}
		for index, product := range products.Items {
			if perks := granted[index]; len(perks.Items) > 0 {
				perksOf[product.Id] = slugs(perks.Items)
			}
		}
		storeProducts, err := catalog.ListStoreProducts(ctx, app, projectID, "")
		if err != nil {
			return err
		}
		storesOf := func(product api.ProductJsonEncoding) string {
			var stores []string
			for _, storeProduct := range storeProducts {
				label := catalog.StoreLabel(storeProduct.Provider)
				if storeProduct.Mapping.ProductId == product.Id && storeProduct.Mapping.IsActive && !contains(stores, label) {
					stores = append(stores, label)
				}
			}
			return orDash(strings.Join(stores, ", "))
		}
		cli.PrintTable(app, []cli.Column[api.ProductJsonEncoding]{
			{Header: "NAME", Cell: func(product api.ProductJsonEncoding) string { return product.Name }},
			{Header: "SLUG", Cell: func(product api.ProductJsonEncoding) string { return product.Slug }},
			{Header: "TYPE", Cell: catalog.ProductTypeLabel},
			{Header: "PERKS", Cell: func(product api.ProductJsonEncoding) string { return orDash(perksOf[product.Id]) }},
			{Header: "STORES", Cell: storesOf},
			{Header: "ID", Cell: func(product api.ProductJsonEncoding) string { return product.Id }},
		}, products.Items, "No products yet. Create one with 'voidhash product create'.")
		return nil
	}
	return cmd
}

func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func orDash(text string) string {
	if text == "" {
		return "-"
	}
	return text
}

func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a product, its perks and its store products.",
		Long:  "Show a product: its type, the perks it grants and the store products it is sold as.",
		Example: `voidhash product view pro-monthly
voidhash product view "Pro Monthly" --json`,
	}
	cli.SetArgs(cmd, productArg)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := catalog.Require(ctx, app, catalog.ProductKind, products, cli.ArgAt(args, 0), "voidhash product view <product>")
		if err != nil {
			return err
		}
		if mode == cli.Quiet {
			app.PrintIDs(found)
			return nil
		}
		product := found.Value
		perks, err := catalog.ListProductPerks(ctx, app, projectID, product.Id)
		if err != nil {
			return err
		}
		storeProducts, err := catalog.ListStoreProducts(ctx, app, projectID, product.Id)
		if err != nil {
			return err
		}
		if mode == cli.JSON {
			mappings := cli.List[struct{}]{}
			for _, storeProduct := range storeProducts {
				mappings.Raw = append(mappings.Raw, storeProduct.Raw)
			}
			return app.PrintJSON(catalog.Extend(found.Raw,
				catalog.RawField{Name: "perks", Value: perks.RawJSON()},
				catalog.RawField{Name: "storeProducts", Value: mappings.RawJSON()},
			))
		}

		granted := fmt.Sprintf("none; choose some with 'voidhash product perks set %s'", product.Slug)
		if len(perks.Items) > 0 {
			labels := make([]string, len(perks.Items))
			for index, perk := range perks.Items {
				labels[index] = catalog.PerkKind.Label(perk)
			}
			granted = strings.Join(labels, "\n")
		}
		stores := fmt.Sprintf("none mapped; map its store products with 'voidhash provider map <store-product> %s'", product.Slug)
		if len(storeProducts) > 0 {
			lines := make([]string, len(storeProducts))
			for index, storeProduct := range storeProducts {
				mapping := storeProduct.Mapping
				lines[index] = catalog.StoreLabel(storeProduct.Provider) + ": " + mapping.ProviderProductKey +
					catalog.MappingNote(string(mapping.Environment), mapping.IsActive, mapping.IsSold)
			}
			stores = strings.Join(lines, "\n")
		}
		fields := []cli.Field{
			{Label: "Type", Value: catalog.ProductTypeLabel(product)},
			{Label: "Perks", Value: granted},
			{Label: "Stores", Value: stores},
			{Label: "ID", Value: product.Id},
		}
		settings, err := app.Config()
		if err != nil {
			return err
		}
		if address, ok := cli.DashboardURL(settings.WebURL, target, "products/"+product.Id); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		app.Println(cli.Printable(catalog.ProductKind.Label(product)) + "\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}

const createUsage = "voidhash product create --name <name> --type <subscription|one-time|consumable> [--period <period>]"

func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a product.",
		Long:  "Create a product: a subscription, a one-time purchase or a consumable. Asks for what is missing in a terminal.",
		Example: `voidhash product create --name "Pro Monthly" --type subscription --period monthly --perk premium
voidhash product create --name "Coins 100" --type consumable`,
	}
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "What people see, such as Pro Monthly")
	slug := cmd.Flags().String("slug", "", "How your code and the API name it (default: made from the name)")
	productType := cli.AddChoiceFlag(cmd, "type", "", catalog.FlagValues(catalog.ProductTypes), "",
		"subscription (renews), one-time (kept for good) or consumable (bought again and again)")
	period := cli.AddChoiceFlag(cmd, "period", "", catalog.FlagValues(catalog.BillingPeriods), "", "How often a subscription renews")
	perkInputs := cli.AddStringsFlag(cmd, "perk", "", "A perk buying it grants: its slug, name or id; repeat for each")
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id

		productName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name, as people see it", Usage: createUsage})
		if err != nil {
			return err
		}
		productSlug := *slug
		if productSlug == "" {
			productSlug = catalog.SlugFrom(productName)
			if app.IsInteractive() {
				productSlug, err = app.RequireText(ctx, "", cli.TextPrompt{
					What: "--slug", Message: "Slug, as your code names it", Usage: createUsage, Initial: productSlug,
				})
				if err != nil {
					return err
				}
			}
		}
		var givenType *string
		if *productType != "" {
			value := catalog.APIValue(catalog.ProductTypes, *productType)
			givenType = &value
		}
		chosenType, err := cli.RequireChoice(ctx, app, givenType, cli.ChoicePrompt[string]{
			What: "--type", Message: "What do people buy?", Usage: createUsage,
			Choices: []cli.Choice[string]{
				{Title: "A subscription, renewed until cancelled", Value: "subscription"},
				{Title: "A one-time purchase, kept for good", Value: "one_time"},
				{Title: "A consumable, bought again and again (such as coins)", Value: "one_time_consumable"},
			},
		})
		if err != nil {
			return err
		}
		if chosenType != "subscription" && *period != "" {
			return cli.Usagef("--period applies only to subscriptions.")
		}
		body := map[string]any{"name": productName, "slug": productSlug, "type": chosenType, "billingPeriod": nil}
		if chosenType == "subscription" {
			var givenPeriod *string
			if *period != "" {
				value := catalog.APIValue(catalog.BillingPeriods, *period)
				givenPeriod = &value
			}
			choices := make([]cli.Choice[string], len(catalog.BillingPeriods))
			for index, spelling := range catalog.BillingPeriods {
				choices[index] = cli.Choice[string]{Title: spelling.Flag, Value: spelling.API}
			}
			body["billingPeriod"], err = cli.RequireChoice(ctx, app, givenPeriod, cli.ChoicePrompt[string]{
				What: "--period", Message: "How often does it renew?", Usage: createUsage, Choices: choices,
			})
			if err != nil {
				return err
			}
		}
		// Find the perks first, so a typo creates nothing.
		var perks []api.PerkJsonEncoding
		if len(*perkInputs) > 0 {
			all, err := catalog.ListPerks(ctx, app, projectID)
			if err != nil {
				return err
			}
			for _, input := range *perkInputs {
				perk, err := cli.FindItem(catalog.PerkKind, all.Items, input)
				if err != nil {
					return err
				}
				perks = append(perks, perk)
			}
		}

		created, err := cli.Fetch[api.ProductJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ProductsCreateWithBody(ctx, projectID, catalog.JSON, catalog.Body(body))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{"product_slug_taken": slugTakenHint(productSlug)})
		}
		for _, perk := range perks {
			if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ProductsAddPerk(ctx, projectID, created.Value.Id, perk.Id)
			}); err != nil {
				return err
			}
		}
		product := created.Value
		lines := []string{
			fmt.Sprintf("Created %s: %s, granting %s.", catalog.ProductKind.Label(product), catalog.ProductTypeLabel(product), slugs(perks)),
			"Next:",
		}
		if len(perks) == 0 {
			lines = append(lines, fmt.Sprintf("  Choose the perks it grants: 'voidhash product perks set %s'", product.Slug))
		}
		lines = append(lines,
			fmt.Sprintf("  Map it to its store products: 'voidhash provider map <store-product> %s', or in the dashboard: 'voidhash open product %s'", product.Slug, product.Slug),
			"  Use it in your app after 'voidhash types generate'.",
		)
		return app.PrintItem(mode, created, strings.Join(lines, "\n"))
	}
	return cmd
}

// renaming is the new name and slug an edit command was given or asked for;
// nil means unchanged.
type renaming struct{ name, slug *string }

func (r renaming) body() map[string]any {
	body := map[string]any{}
	if r.name != nil {
		body["name"] = *r.name
	}
	if r.slug != nil {
		body["slug"] = *r.slug
	}
	return body
}

func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Rename a product or change its slug.",
		Long:  "Rename a product or change its slug. Its type and billing period cannot change. Without --name or --slug it asks for both in a terminal.",
		Example: `voidhash product edit pro-monthly --name "Pro (monthly)"
voidhash product edit lifetime --slug forever`,
	}
	cli.SetArgs(cmd, productArg)
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "Its new name")
	slug := cmd.Flags().String("slug", "", "Its new slug")
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := catalog.Require(ctx, app, catalog.ProductKind, products, cli.ArgAt(args, 0), "voidhash product edit <product> --name <name>")
		if err != nil {
			return err
		}
		askedName, askedSlug := *name, *slug
		if askedName == "" && askedSlug == "" {
			if !app.IsInteractive() {
				return cli.Usagef("Nothing to change.").WithHint("Pass --name or --slug. A product's type and billing period cannot change.")
			}
			if askedName, err = app.RequireText(ctx, "", cli.TextPrompt{Message: "Name", Initial: found.Value.Name}); err != nil {
				return err
			}
			if askedSlug, err = app.RequireText(ctx, "", cli.TextPrompt{Message: "Slug", Initial: found.Value.Slug}); err != nil {
				return err
			}
		}
		var change renaming
		if askedName != "" && askedName != found.Value.Name {
			change.name = &askedName
		}
		if askedSlug != "" && askedSlug != found.Value.Slug {
			change.slug = &askedSlug
		}
		if change.name == nil && change.slug == nil {
			return app.PrintItem(mode, found, "Nothing changed.")
		}
		updated, err := cli.Fetch[api.ProductJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ProductsUpdateWithBody(ctx, projectID, found.Value.Id, catalog.JSON, catalog.Body(change.body()))
		})
		if err != nil {
			taken := found.Value.Slug
			if change.slug != nil {
				taken = *change.slug
			}
			return cli.APIError(err, map[string]string{"product_slug_taken": slugTakenHint(taken)})
		}
		human := fmt.Sprintf("Updated %s.", catalog.ProductKind.Label(updated.Value))
		if change.slug != nil {
			human += fmt.Sprintf("\nCode that names it %s needs %s now; run 'voidhash types generate' in your app.", found.Value.Slug, updated.Value.Slug)
		}
		return app.PrintItem(mode, updated, human)
	}
	return cmd
}

func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a product that no store product is mapped to.",
		Long:    "Delete a product that no store product is mapped to. Asks first; --yes skips that.",
		Example: "voidhash product delete lifetime --yes",
	}
	cli.SetArgs(cmd, productArg)
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := catalog.Require(ctx, app, catalog.ProductKind, products, cli.ArgAt(args, 0), "voidhash product delete <product> --yes")
		if err != nil {
			return err
		}
		label := catalog.ProductKind.Label(found.Value)
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete %s from %s? This cannot be undone.", label, target.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ProductsDelete(ctx, projectID, found.Value.Id)
		}); err != nil {
			return cli.APIError(err, map[string]string{
				"product_in_use": fmt.Sprintf("Remove its store products first: 'voidhash product view %[1]s' lists them and 'voidhash provider unmap <store-product>' removes one, or use the dashboard: 'voidhash open product %[1]s'.", found.Value.Slug),
			})
		}
		return app.PrintItem(mode, found, "Deleted "+label+".")
	}
	return cmd
}
