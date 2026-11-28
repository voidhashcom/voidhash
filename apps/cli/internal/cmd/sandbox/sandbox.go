// Package sandbox holds `voidhash sandbox`: the simulated purchases debug
// builds make without a store.
package sandbox

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash sandbox`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sandbox",
		Short: "Test your app's purchases without a store.",
		Long: `Test your app's purchases without a store: see what a tester bought, simulate renewals, expiry and refunds, or start over.

Debug builds in development mode make the purchases with the test publishable key; they are test purchases and never unlock production.`,
	}
	cmd.AddCommand(newView(app))
	for _, action := range actions {
		cmd.AddCommand(newAction(app, action))
	}
	cmd.AddCommand(newReset(app))
	return cmd
}

var personArg = cli.Arg{Name: "person", Help: "The person's distinct id, email or id", Optional: true}

const noPurchases = "Buy in a debug build of your app in development mode first, configured with the test publishable key; 'voidhash settings set sandbox-purchasing on' allows it."

// state is a person's sandbox state with the names of products and perks.
type state struct {
	cli.Object[api.SandboxStateJsonEncoding]
	products []api.ProductJsonEncoding
	perks    []api.PerkJsonEncoding
}

func readState(ctx context.Context, app *cli.App, projectID string, person api.PersonJsonEncoding) (state, error) {
	read, err := cli.Fetch[api.SandboxStateJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.SandboxGetState(ctx, projectID, &api.SandboxGetStateParams{PersonId: person.Id})
	})
	if err != nil {
		return state{}, err
	}
	products, err := catalog.ListProducts(ctx, app, projectID)
	if err != nil {
		return state{}, err
	}
	perks, err := catalog.ListPerks(ctx, app, projectID)
	if err != nil {
		return state{}, err
	}
	return state{Object: read, products: products.Items, perks: perks.Items}, nil
}

func (s state) productName(id string) string {
	for _, product := range s.products {
		if product.Id == id {
			return catalog.ProductKind.Label(product)
		}
	}
	return id
}

func (s state) perkSlug(id string) string {
	for _, perk := range s.perks {
		if perk.Id == id {
			return perk.Slug
		}
	}
	return id
}

// until is " until <date>" for an end time, empty for none.
func until(app *cli.App, end *string) string {
	if end == nil {
		return ""
	}
	return " until " + app.FormatDate(*end)
}

// describe is what a person's simulated purchases and access are, for people.
func (s state) describe(app *cli.App, person api.PersonJsonEncoding) string {
	var subscriptions, purchases, access []string
	for _, subscription := range s.Value.Subscriptions {
		status := "canceled"
		if subscription.Status == "active" {
			status = "active"
		}
		line := s.productName(subscription.ProductId) + ": " + status + until(app, subscription.ExpiresAt)
		if subscription.GracePeriodExpiresAt != nil {
			line += ", in grace period until " + app.FormatDate(*subscription.GracePeriodExpiresAt)
		}
		subscriptions = append(subscriptions, line+"  "+subscription.Id)
	}
	for _, purchase := range s.Value.Purchases {
		status := "owned"
		switch {
		case purchase.RefundedAt != nil:
			status = "refunded"
		case purchase.RevokedAt != nil:
			status = "revoked"
		}
		purchases = append(purchases, s.productName(purchase.ProductId)+": "+status+"  "+purchase.Id)
	}
	for _, grant := range s.Value.Grants {
		access = append(access, s.perkSlug(grant.PerkId)+": "+string(grant.Status)+until(app, grant.ExpiresAt))
	}
	lines := func(items []string) string {
		if len(items) == 0 {
			return "none"
		}
		return strings.Join(items, "\n")
	}
	return "Simulated purchases of " + catalog.PersonLabel(person) + "\n" + cli.FormatFields([]cli.Field{
		{Label: "Subscriptions", Value: lines(subscriptions)},
		{Label: "Purchases", Value: lines(purchases)},
		{Label: "Access", Value: lines(access)},
	})
}

func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a person's simulated purchases and the access they grant.",
		Long:  "Show a person's simulated purchases and subscriptions and the access they grant.",
		Example: `voidhash sandbox view kim@example.com
voidhash sandbox view user-42 --json`,
	}
	cli.SetArgs(cmd, personArg)
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		person, err := catalog.RequirePerson(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash sandbox view <person>")
		if err != nil {
			return err
		}
		read, err := readState(ctx, app, target.Project.Id, person)
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(read.Object)
		}
		app.Println(read.describe(app, person))
		if len(read.Value.Purchases) == 0 && len(read.Value.Subscriptions) == 0 {
			app.Notef("%s", noPurchases)
		}
		return nil
	}
	return cmd
}

// action is one store event the sandbox can play, and what it applies to.
type action struct {
	api, verb, done, short string
	targets                []string
}

var actions = []action{
	{
		api: "renew", verb: "renew", done: "Renewed", targets: []string{"subscription"},
		short: "Renew a person's simulated subscription for another period, as the store would.",
	},
	{
		api: "expire", verb: "expire", done: "Expired", targets: []string{"subscription"},
		short: "End a person's simulated subscription now, as when it lapses in the store.",
	},
	{
		api: "grace_period", verb: "grace-period", done: "Started the three-day grace period of", targets: []string{"subscription"},
		short: "Put a person's simulated subscription in its three-day billing grace period, as after a failed renewal.",
	},
	{
		api: "refund", verb: "refund", done: "Refunded", targets: []string{"purchase"},
		short: "Refund a person's one-time simulated purchase; the access it granted ends.",
	},
	{
		api: "revoke", verb: "revoke", done: "Revoked", targets: []string{"purchase", "subscription"},
		short: "Revoke a person's simulated purchase or subscription, as when the store takes it back.",
	},
}

// target is a sandbox purchase or subscription an action can apply to.
type target struct {
	id, kind, productID, summary string
}

var targetKind = cli.ItemKind[target]{
	Noun:        "simulated purchase",
	ID:          func(item target) string { return item.id },
	Label:       func(item target) string { return item.summary },
	ListCommand: "voidhash sandbox view <person>",
}

func newAction(app *cli.App, action action) *cobra.Command {
	usage := fmt.Sprintf("voidhash sandbox %s <person> [product]", action.verb)
	cmd := &cobra.Command{
		Use:   action.verb,
		Short: action.short,
		Long:  action.short + " Webhooks and analytics follow as for a store's event. When the person has several, name the product, or choose in a terminal.",
		Example: fmt.Sprintf(`voidhash sandbox %[1]s kim@example.com
voidhash sandbox %[1]s user-42 pro-monthly --json`, action.verb),
	}
	cli.SetArgs(cmd, personArg, cli.Arg{
		Name: "product", Help: "The product bought, by slug, name or id, when they have several", Optional: true,
	})
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	applies := func(kind string) bool {
		for _, accepted := range action.targets {
			if accepted == kind {
				return true
			}
		}
		return false
	}
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		resolved, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := resolved.Project.Id
		person, err := catalog.RequirePerson(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		before, err := readState(ctx, app, projectID, person)
		if err != nil {
			return err
		}
		var candidates []target
		if applies("subscription") {
			for _, subscription := range before.Value.Subscriptions {
				if subscription.Status == "active" {
					candidates = append(candidates, target{
						id: subscription.Id, kind: "subscription", productID: subscription.ProductId,
						summary: before.productName(subscription.ProductId) + " subscription" + until(app, subscription.ExpiresAt),
					})
				}
			}
		}
		if applies("purchase") {
			for _, purchase := range before.Value.Purchases {
				if purchase.RefundedAt == nil && purchase.RevokedAt == nil {
					candidates = append(candidates, target{
						id: purchase.Id, kind: "purchase", productID: purchase.ProductId,
						summary: before.productName(purchase.ProductId) + " purchase",
					})
				}
			}
		}
		kinds := make([]string, len(action.targets))
		for index, kind := range action.targets {
			kinds[index] = "active simulated " + kind
		}
		what := strings.Join(kinds, " or ")
		matching, productInput := candidates, cli.ArgAt(args, 1)
		if productInput != "" {
			wanted, err := cli.FindItem(catalog.ProductKind, before.products, productInput)
			if err != nil {
				return err
			}
			matching = nil
			for _, candidate := range candidates {
				if candidate.productID == wanted.Id {
					matching = append(matching, candidate)
				}
			}
		}
		label := catalog.PersonLabel(person)
		var chosen target
		switch {
		case len(matching) == 0:
			message := fmt.Sprintf("%s has no %s", label, what)
			if productInput != "" {
				message += " of " + cli.Printable(productInput)
			}
			hint := fmt.Sprintf("'voidhash sandbox view %s' shows what they have.", person.Id)
			if len(candidates) == 0 {
				hint = noPurchases
			}
			return &cli.UserError{Message: message + ".", Hint: hint, ExitCode: cli.ExitNotFound}
		case len(matching) == 1:
			chosen = matching[0]
		case app.IsInteractive():
			if chosen, err = cli.ChooseItem(ctx, app, targetKind, matching, "Which "+what+"?"); err != nil {
				return err
			}
		default:
			lines := []string{fmt.Sprintf("%s has %d of them:", label, len(matching))}
			for _, item := range matching {
				lines = append(lines, "  "+cli.Printable(item.summary))
			}
			return cli.Usagef("%s", strings.Join(lines, "\n")).WithHint("Name the product: " + usage)
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.SandboxCreateAction(ctx, projectID, api.CreateSandboxActionBodyJsonEncoding{
				ActionId:   app.NewID(),
				Action:     api.CreateSandboxActionBodyJsonEncodingAction(action.api),
				TargetType: api.CreateSandboxActionBodyJsonEncodingTargetType(chosen.kind),
				TargetId:   chosen.id,
			})
		}); err != nil {
			return cli.APIError(err, map[string]string{"sandbox_target_not_found": noPurchases})
		}
		after, err := readState(ctx, app, projectID, person)
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(after.Object)
		}
		app.Println(cli.Printable(fmt.Sprintf("%s %s of %s.", action.done, chosen.summary, label)) + "\n\n" + after.describe(app, person))
		app.Notef("Webhooks and analytics follow in a moment.")
		return nil
	}
	return cmd
}

func newReset(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "reset",
		Short:   "Delete every simulated purchase in the project, to start testing over.",
		Long:    "Delete every simulated purchase in the project, to start testing over. Stripe and payment source test purchases stay. Asks first; --yes skips that.",
		Example: "voidhash sandbox reset --yes",
	}
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		resolved, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
			"Delete every simulated purchase and subscription in %s, and the access they granted? Production, store sandbox and other test purchases, such as Stripe test mode's, stay.",
			resolved.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.SandboxDeleteData(ctx, resolved.Project.Id)
		}); err != nil {
			return err
		}
		app.Println("Deleted every simulated purchase and subscription; testers start over with nothing bought.")
		return nil
	}
	return cmd
}
