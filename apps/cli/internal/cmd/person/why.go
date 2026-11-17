package person

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

type perk = api.PerkJsonEncoding

var perkKind = cli.ItemKind[perk]{
	Noun:          "perk",
	ID:            func(item perk) string { return item.Id },
	Label:         func(item perk) string { return item.Name + " (" + item.Slug + ")" },
	ListCommand:   "voidhash perk list",
	CreateCommand: "voidhash perk create",
	Keys:          func(item perk) []string { return []string{item.Slug} },
	Names:         func(item perk) []string { return []string{item.Name} },
}

// named is the part of a product `person why` reads.
type named struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// link is one link of the access chain `person why` prints. OK is nil when
// the link could not be checked.
type link struct {
	Name   string `json:"name"`
	OK     *bool  `json:"ok"`
	Detail string `json:"detail"`
}

// productsGranting reads the project's products that grant the perk.
func productsGranting(ctx context.Context, app *cli.App, projectID, perkID string) ([]named, error) {
	products, err := cli.ListAll[named](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return nil, err
	}
	perks, err := cli.Each(ctx, products.Items, 8, func(ctx context.Context, product named) (cli.List[named], error) {
		return cli.ListAll[named](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ProductsListPerks(ctx, projectID, product.ID, &api.ProductsListPerksParams{Cursor: page.Cursor, Limit: page.Limit})
		})
	})
	if err != nil {
		return nil, err
	}
	var granting []named
	for index, product := range products.Items {
		if slices.ContainsFunc(perks[index].Items, func(item named) bool { return item.ID == perkID }) {
			granting = append(granting, product)
		}
	}
	return granting, nil
}

// activeStoreProducts reads the keys of the active store products mapped to
// one of the products, across every payment provider.
func activeStoreProducts(ctx context.Context, app *cli.App, projectID string, products []named) ([]string, error) {
	providers, err := cli.ListAll[named](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaymentProvidersList(ctx, projectID, &api.PaymentProvidersListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return nil, err
	}
	listings, err := cli.Each(ctx, providers.Items, 4, func(ctx context.Context, provider named) (cli.List[api.PaymentProviderProductMappingJsonEncoding], error) {
		return cli.ListAll[api.PaymentProviderProductMappingJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaymentProviderProductsList(ctx, projectID, provider.ID, &api.PaymentProviderProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
	})
	if err != nil {
		return nil, err
	}
	var keys []string
	for _, mappings := range listings {
		for _, mapping := range mappings.Items {
			if mapping.IsActive && slices.ContainsFunc(products, func(product named) bool { return product.ID == mapping.ProductId }) {
				keys = append(keys, mapping.ProviderProductKey)
			}
		}
	}
	return keys, nil
}

func unique(values []string) []string {
	var kept []string
	for _, value := range values {
		if !slices.Contains(kept, value) {
			kept = append(kept, value)
		}
	}
	return kept
}

// newWhy creates `voidhash person why <person> <perk>`.
func newWhy(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "why",
		Short: "Explain why a person has or lacks a perk.",
		Long: `Explain why a person has or lacks a perk: their access, the products that grant the perk, the store products that sell those, and the person's purchases. It shows where the chain breaks and how to fix it.

With --json it prints the person, the perk, hasAccess, the chain (each link's name, ok and detail; ok is null when your access does not let it be checked) and the fix.`,
		Example: `voidhash person why ada@example.com premium
voidhash person why user-42 premium --json`,
	}
	cli.SetArgs(cmd, personArg, cli.Arg{Name: "perk", Help: "The perk's slug (what your app checks), name or id", Optional: true})
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		const usage = "voidhash person why <person> <perk>"
		found, err := paywalls.RequirePerson(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		person := found.Value
		perks, err := cli.ListAll[perk](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PerksList(ctx, projectID, &api.PerksListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		perkInput, err := app.RequireText(ctx, cli.ArgAt(args, 1), cli.TextPrompt{What: "the perk", Message: "Which perk (its slug)?", Usage: usage})
		if err != nil {
			return err
		}
		wanted, err := cli.FindItem(perkKind, perks.Items, perkInput)
		if err != nil {
			return err
		}
		read, err := readHistory(ctx, app, projectID, person.Id)
		if err != nil {
			return err
		}

		var chain []link
		add := func(name string, ok *bool, detail string) {
			chain = append(chain, link{Name: name, OK: ok, Detail: detail})
		}
		yes, no := true, false
		report := func(hasAccess bool, fix string) error {
			if *asJSON {
				rawPerk := json.RawMessage(nil)
				for index, item := range perks.Items {
					if item.Id == wanted.Id {
						rawPerk = perks.Raw[index]
					}
				}
				var rawFix json.RawMessage
				if fix != "" {
					rawFix = encodeJSON(fix)
				}
				return app.PrintJSON(paywalls.ExtendObject(json.RawMessage("{}"),
					paywalls.Member{Key: "person", Value: found.Raw},
					paywalls.Member{Key: "perk", Value: rawPerk},
					paywalls.Member{Key: "hasAccess", Value: encodeJSON(hasAccess)},
					paywalls.Member{Key: "chain", Value: encodeJSON(chain)},
					paywalls.Member{Key: "fix", Value: rawFix},
				))
			}
			style := app.Style()
			verdict := style.Red("does not have")
			if hasAccess {
				verdict = style.Green("has")
			}
			out := []string{fmt.Sprintf("%s %s %s.", paywalls.PersonKind.Label(person), verdict, cli.Printable(perkKind.Label(wanted)))}
			for _, step := range chain {
				mark := style.Dim("? ")
				if step.OK != nil {
					mark = style.Red("x ")
					if *step.OK {
						mark = style.Green("ok")
					}
				}
				out = append(out, fmt.Sprintf("  %s  %-9s %s", mark, step.Name, cli.Printable(step.Detail)))
			}
			if fix != "" {
				out = append(out, "Fix: "+cli.PrintableLines(fix))
			}
			app.Println(strings.Join(out, "\n"))
			return nil
		}

		if read.canSeeEntitlements {
			for _, granted := range read.entitlements.Items {
				if granted.PerkId == wanted.Id {
					add("access", &yes, describeEntitlement(app, granted, read))
					return report(true, "")
				}
			}
			add("access", &no, "they cannot use "+wanted.Slug+" now")
		} else {
			add("access", nil, "not checked: your access does not include entitlements")
		}

		granting, err := productsGranting(ctx, app, projectID, wanted.Id)
		if err != nil {
			return err
		}
		if len(granting) == 0 {
			add("catalog", &no, "no product grants "+wanted.Slug)
			return report(false, fmt.Sprintf("make the product they bought grant it: 'voidhash product perks set <product> %s …'", wanted.Slug))
		}
		grantingNames := make([]string, len(granting))
		for index, product := range granting {
			grantingNames[index] = product.Name
		}
		products := strings.Join(grantingNames, ", ")
		add("catalog", &yes, "granted by "+products)

		selling, err := activeStoreProducts(ctx, app, projectID, granting)
		canSeeStores, err := cli.IfPermitted(err)
		if err != nil {
			return err
		}
		switch {
		case !canSeeStores:
			add("store", nil, "not checked: your access does not include payment providers")
		case len(selling) == 0:
			add("store", &no, products+": no active store product")
		default:
			add("store", &yes, strings.Join(selling, ", "))
		}
		isUnsold := canSeeStores && len(selling) == 0

		// Purchases name their product only by name.
		var current, ended, other []string
		for _, sub := range read.subscriptions.Items {
			switch {
			case !slices.Contains(grantingNames, sub.ProductName):
				if isCurrent(sub, app.Now()) {
					other = append(other, sub.ProductName)
				}
			case isCurrent(sub, app.Now()):
				current = append(current, describeSubscription(app, sub))
			}
			if slices.Contains(grantingNames, sub.ProductName) {
				ended = append(ended, describeSubscription(app, sub))
			}
		}
		for _, bought := range read.purchases.Items {
			switch {
			case !slices.Contains(grantingNames, bought.ProductName):
				if isOwned(bought) {
					other = append(other, bought.ProductName)
				}
			case isOwned(bought):
				current = append(current, describePurchase(app, bought))
			}
			if slices.Contains(grantingNames, bought.ProductName) {
				ended = append(ended, describePurchase(app, bought))
			}
		}
		other = unique(other)
		switch {
		case len(current) > 0:
			add("purchase", &yes, strings.Join(current, "; "))
			add("grant", &no, "missing for "+wanted.Slug)
			return report(false, "access is recomputed in the background after a product's perks change; if it persists, contact Voidhash support.")
		case len(ended) > 0:
			add("purchase", &no, strings.Join(ended, "; "))
			return report(false, "access returns when they renew or buy again. If they say they renewed, check the store connection with 'voidhash status'.")
		case len(other) > 0:
			add("purchase", &no, fmt.Sprintf("they have %s, which does not grant %s", strings.Join(other, ", "), wanted.Slug))
			return report(false, fmt.Sprintf("if %s should unlock it, add %s with 'voidhash product perks set'; otherwise they need %s.",
				strings.Join(other, " or "), wanted.Slug, products))
		}
		add("purchase", &no, "no production purchase or subscription recorded")
		causes := []string{"if they paid, the likely causes are:"}
		if isUnsold {
			causes = append(causes, "  - the product has no store product yet: map it in the dashboard")
		}
		if !person.IsIdentified {
			causes = append(causes, "  - they are anonymous: the purchase may be on the person your app identified them as")
		}
		causes = append(causes,
			"  - a test purchase (a debug build's or Stripe test mode's), which production never counts, or a store sandbox one while the project keeps those out of production",
			"  - store notifications are not reaching Voidhash: 'voidhash status' checks the connection",
		)
		return report(false, strings.Join(causes, "\n"))
	}
	return cmd
}
