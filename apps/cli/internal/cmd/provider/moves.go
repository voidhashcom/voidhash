package provider

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

// moveHints say what to do about each reason the API refuses a move for.
var moveHints = map[string]string{
	"product_type_mismatch":        "A store product moves only to a product of the same type. Create one with 'voidhash product create'.",
	"product_duration_mismatch":    "A subscription moves only to a product that renews over the same period. Create one with 'voidhash product create'.",
	"store_product_already_mapped": "'voidhash provider products --mapped' shows its mappings.",
	"target_mapping_has_purchases": "Move that earlier mapping to another product first, or keep this one where it is.",
	"revenue_history_not_ready":    "Nothing was changed. Prepare the project's revenue history as the message says, then move the store product.",
}

// activeMapping is the mapping purchases of store resolve through; a store
// product no product is mapped to cannot be moved or sold.
func activeMapping(store storeProduct) (cli.Object[mapping], error) {
	for index, candidate := range store.mappings.Items {
		if candidate.IsActive {
			return store.mappings.Object(index), nil
		}
	}
	return cli.Object[mapping]{}, &cli.UserError{
		Message:  fmt.Sprintf("%s %s is not mapped to a product.", catalog.ProviderLabel(store.provider), store.key),
		Hint:     fmt.Sprintf("Map it with 'voidhash provider map %s <product>'.", store.key),
		ExitCode: cli.ExitNotFound,
	}
}

// productLabelOf is how the product with id reads, or its id when it is not listed.
func productLabelOf(products []api.ProductJsonEncoding, id string) string {
	for _, product := range products {
		if product.Id == id {
			return catalog.ProductKind.Label(product)
		}
	}
	return id
}

// explainMove says on standard error what moving found to target would do:
// what moves with it, the perks its buyers gain and lose, and what each
// product is sold as afterwards. It fails with the API's reason when the move
// would be refused.
func explainMove(ctx context.Context, app *cli.App, projectID string, store storeProduct, found mapping, sourceName string, target api.ProductJsonEncoding) error {
	explained, err := cli.Fetch[api.PaymentProviderProductMoveExplanationJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaymentProviderProductsExplainMoveWithBody(ctx, projectID, store.provider.Id, found.Id, catalog.JSON,
			catalog.Body(map[string]any{"productId": target.Id}))
	})
	if err != nil {
		return cli.APIError(err, nil)
	}
	explanation := explained.Value
	if code := string(explanation.Refusal.Code); code != "" {
		return &cli.UserError{Message: explanation.Refusal.Message, Hint: moveHints[code]}
	}
	storeName := catalog.ProviderLabel(store.provider)
	lines := []string{fmt.Sprintf("%s and %s recorded under %s move with it: reports by product count them, history included, under %s instead of %s. Totals do not change.",
		plural(explanation.SubscriptionCount, "subscription")+fmt.Sprintf(" (%d active)", explanation.ActiveSubscriptionCount),
		plural(explanation.PurchaseCount, "one-time purchase"), store.key, target.Name, sourceName)}
	var perks []string
	if len(explanation.PerksGained) > 0 {
		perks = append(perks, "gain "+strings.Join(explanation.PerksGained, ", "))
	}
	if len(explanation.PerksLost) > 0 {
		perks = append(perks, "lose "+strings.Join(explanation.PerksLost, ", "))
	}
	if len(perks) == 0 {
		lines = append(lines, "Its buyers keep the same perks.")
	} else {
		lines = append(lines, "Its buyers "+strings.Join(perks, " and ")+".")
	}
	if explanation.IsSoldOnTarget {
		lines = append(lines, fmt.Sprintf("%s is sold as %s on %s.", target.Name, store.key, storeName))
	} else {
		lines = append(lines, fmt.Sprintf("%s stays sold as its current %s store product; %s only recognizes purchases made under it.", target.Name, storeName, store.key))
	}
	if found.IsSold {
		promoted := ""
		if explanation.PromotedMappingId != nil {
			mappings, err := catalog.ListMappings(ctx, app, projectID, store.provider.Id, catalog.MappingsFilter{})
			if err != nil {
				return err
			}
			for _, candidate := range mappings.Items {
				if candidate.Id == *explanation.PromotedMappingId {
					promoted = candidate.ProviderProductKey
				}
			}
		}
		if promoted == "" {
			lines = append(lines, fmt.Sprintf("%s is no longer sold on %s: it has no other active store product there.", sourceName, storeName))
		} else {
			lines = append(lines, fmt.Sprintf("%s is sold as %s on %s instead.", sourceName, promoted, storeName))
		}
	}
	for _, line := range lines {
		app.Notef("  %s", cli.Printable(line))
	}
	return nil
}

// soldNote says what a moved mapping's new product is sold as.
func soldNote(moved mapping, store storeProduct, productName string) string {
	if moved.IsSold {
		return fmt.Sprintf(" %s is sold as it.", productName)
	}
	return fmt.Sprintf(" %s stays sold as another %s store product; this one recognizes purchases only.", productName, catalog.ProviderLabel(store.provider))
}

func newMove(app *cli.App) *cobra.Command {
	const usage = "voidhash provider move <store-product> <product> [--provider <provider>]"
	cmd := &cobra.Command{
		Use:   "move",
		Short: "Move a store product to another product, with the purchases recorded under it.",
		Long: `Move a store product to another product of the same type and duration. The purchases, subscriptions and revenue recorded under it move with it: reports by product then count them under the other product, and totals do not change. Its buyers get the other product's perks instead.

To split a product sold as several store products, create a product with the same type, duration and perks, then move one of them to it.

It shows what moves and asks first; --yes skips that.`,
		Example: `voidhash provider move com.acme.pro.monthly.intro pro-intro
voidhash provider move prod_123:price_456 pro-legacy --provider stripe --yes`,
	}
	cli.SetArgs(cmd,
		cli.Arg{Name: "store-product", Help: "The store's id for it, as 'provider products' lists it", Optional: true},
		cli.Arg{Name: "product", Help: "The product to move it to: its slug, name or id", Optional: true},
	)
	providerInput := cmd.Flags().String("provider", "", providerFlagUsage)
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
		found, err := activeMapping(store)
		if err != nil {
			return err
		}
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		product, err := cli.RequireItem(ctx, app, catalog.ProductKind, products.Items, cli.ArgAt(args, 1), usage)
		if err != nil {
			return err
		}
		where := catalog.ProviderLabel(store.provider) + " " + store.key
		productLabel := catalog.ProductKind.Label(product)
		if found.Value.ProductId == product.Id {
			return app.PrintItem(mode, found, fmt.Sprintf("%s already belongs to %s.", where, productLabel))
		}
		sourceLabel := productLabelOf(products.Items, found.Value.ProductId)
		if !*yes {
			sourceName := found.Value.ProductId
			for _, candidate := range products.Items {
				if candidate.Id == found.Value.ProductId {
					sourceName = candidate.Name
				}
			}
			if err := explainMove(ctx, app, projectID, store, found.Value, sourceName, product); err != nil {
				return err
			}
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Move %s from %s to %s?", where, sourceLabel, productLabel)); err != nil {
			return err
		}
		moved, err := cli.Fetch[mapping](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProviderProductsMoveWithBody(ctx, projectID, store.provider.Id, found.Value.Id, catalog.JSON,
				catalog.Body(map[string]any{"productId": product.Id}))
		})
		if err != nil {
			return cli.APIError(err, moveHints)
		}
		return app.PrintItem(mode, moved, fmt.Sprintf("Moved %s from %s to %s, with the purchases and subscriptions recorded under it. Its buyers now get %s's perks.%s",
			where, sourceLabel, productLabel, product.Name, soldNote(moved.Value, store, product.Name)))
	}
	return cmd
}

func newSell(app *cli.App) *cobra.Command {
	const usage = "voidhash provider sell <store-product> [--provider <provider>]"
	cmd := &cobra.Command{
		Use:   "sell",
		Short: "Sell a product as one of its store products: the one apps are offered.",
		Long: `Sell the product a store product is mapped to as that store product on its provider: apps are offered it and paywalls list it, with its offers, from then on. A product with several store products on one provider is sold as one of them; the others stay mapped and only recognize purchases made under them, so their buyers keep their access.

It changes what new buyers are offered, so it asks first; --yes skips that.`,
		Example: `voidhash provider sell com.acme.pro.monthly.v2
voidhash provider sell prod_123:price_789 --provider stripe --yes`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "store-product", Help: "The store's id for it, as 'provider products' lists it", Optional: true})
	providerInput := cmd.Flags().String("provider", "", providerFlagUsage)
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
		found, err := activeMapping(store)
		if err != nil {
			return err
		}
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		where := catalog.ProviderLabel(store.provider) + " " + store.key
		productLabel := productLabelOf(products.Items, found.Value.ProductId)
		if found.Value.IsSold {
			return app.PrintItem(mode, found, fmt.Sprintf("%s is already sold as %s.", productLabel, where))
		}
		siblings, err := catalog.ListMappings(ctx, app, projectID, store.provider.Id, catalog.MappingsFilter{ProductID: found.Value.ProductId})
		if err != nil {
			return err
		}
		current := ""
		for _, candidate := range siblings.Items {
			if candidate.IsSold && candidate.Environment == found.Value.Environment {
				current = candidate.ProviderProductKey
			}
		}
		question := fmt.Sprintf("Sell %s as %s? Apps are offered it and paywalls list it from then on.", productLabel, where)
		if current != "" {
			question = fmt.Sprintf("Sell %s as %s instead of %s? Apps are offered it and paywalls list it from then on; %s stays mapped and still grants the product to those who bought it.",
				productLabel, where, current, current)
		}
		if err := app.ConfirmChange(ctx, *yes, question); err != nil {
			return err
		}
		sold, err := cli.Fetch[mapping](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProviderProductsSell(ctx, projectID, store.provider.Id, found.Value.Id)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"product_mapping_inactive": fmt.Sprintf("Map it again with 'voidhash provider map %s <product>' first.", store.key),
			})
		}
		human := fmt.Sprintf("%s is now sold as %s.", productLabel, where)
		if current != "" {
			human += fmt.Sprintf(" %s stays mapped and recognizes purchases made under it.", current)
		}
		return app.PrintItem(mode, sold, human)
	}
	return cmd
}
