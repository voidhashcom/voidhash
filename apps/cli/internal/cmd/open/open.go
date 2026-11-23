// Package open holds `voidhash open`: the project's dashboard pages.
package open

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// page is a dashboard page `voidhash open` takes by name.
type page struct {
	name string
	// path is the page's path under the project.
	path string
	// item finds the page of one item, for a page that takes one.
	item func(ctx context.Context, app *cli.App, projectID, input string) (string, error)
}

// pages are the project's dashboard pages. A page of one item (`product
// <product>`) follows the page that lists them.
var pages = []page{
	{name: "overview", path: ""},
	{name: "products", path: "products"},
	{name: "product", item: productPage},
	{name: "perks", path: "settings/perks"},
	{name: "persons", path: "persons"},
	{name: "person", item: personPage},
	{name: "flags", path: "flags"},
	{name: "flag", item: flagPage},
	{name: "experiments", path: "experiments"},
	{name: "experiment", item: experimentPage},
	{name: "paywalls", path: "paywalls"},
	{name: "paywall", item: paywallPage},
	{name: "locations", path: "settings/paywall-locations"},
	{name: "location", item: locationPage},
	{name: "components", path: "components"},
	{name: "events", path: "activity/events"},
	{name: "event-settings", path: "settings/events"},
	{name: "analytics", path: "analytics/dashboards"},
	{name: "ads", path: "ads"},
	{name: "ad-accounts", path: "settings/ad-accounts"},
	{name: "campaigns", path: "ads/campaigns"},
	{name: "creatives", path: "ads/creatives"},
	{name: "cohorts", path: "ads/cohorts"},
	{name: "webhooks", path: "settings/webhooks"},
	{name: "webhook", item: webhookPage},
	{name: "providers", path: "settings/payment-providers"},
	{name: "provider", item: providerPage},
	{name: "keys", path: "settings/api-keys"},
	{name: "notifications", path: "settings/notifications"},
	{name: "settings", path: "settings"},
	{name: "domains", path: "settings"},
	{name: "sandbox", path: "settings"},
	{name: "push", path: "activity/sent-notifications"},
}

func pageNames() []string {
	names := make([]string, len(pages))
	for index, candidate := range pages {
		names[index] = candidate.name
	}
	return names
}

// New creates `voidhash open [page] [item]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "open",
		Short: "Open a page of the project's dashboard in your browser.",
		Long: `Open a page of the project's dashboard in your browser, and print its address. Without a page, opens the project's overview. Off a terminal, or with --no-browser, the address is only printed.

Pages: ` + strings.Join(pageNames(), ", ") + `.

product, person, flag, experiment, paywall, location, webhook and provider open the page of one item, which you name after it or choose on a terminal.`,
		Example: `voidhash open
voidhash open products
voidhash open product pro-monthly
voidhash open person ada@example.com --no-browser`,
		ValidArgsFunction: func(_ *cobra.Command, args []string, _ string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return pageNames(), cobra.ShellCompDirectiveNoFileComp
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
	}
	cli.SetArgs(cmd,
		cli.Arg{Name: "page", Help: "The dashboard page to open (default: overview)", Optional: true},
		cli.Arg{Name: "item", Help: "For product, paywall or location: its slug, name or id; for person: their email, distinct id or id; for flag: its key or id; for experiment: its name or id; for webhook: its name, URL or id; for provider: app-store, google-play, stripe or a payment source's slug", Optional: true},
	)
	noBrowser := cmd.Flags().Bool("no-browser", false, "Only print the page's address")
	// The earlier spelling: --browser=false is --no-browser.
	browser := cmd.Flags().Bool("browser", true, "Open the page in your browser")
	_ = cmd.Flags().MarkHidden("browser")
	project := cli.AddProjectFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		name := cli.ArgAt(args, 0)
		if name == "" {
			name = "overview"
		}
		var chosen *page
		for index := range pages {
			if pages[index].name == name {
				chosen = &pages[index]
			}
		}
		if chosen == nil {
			return cli.Usagef("There is no dashboard page %q.", name).WithHint("The pages are: " + strings.Join(pageNames(), ", ") + ".")
		}
		input := cli.ArgAt(args, 1)
		if chosen.item == nil && input != "" {
			for _, candidate := range pages {
				if candidate.item != nil && candidate.name+"s" == chosen.name {
					return cli.Usagef("The page %s lists every %s and takes no item.", chosen.name, candidate.name).
						WithHint(fmt.Sprintf("Open one with 'voidhash open %s %s'.", candidate.name, input))
				}
			}
			return cli.Usagef("The page %s takes no item.", chosen.name).WithHint(fmt.Sprintf("Run 'voidhash open %s'.", chosen.name))
		}

		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		path := chosen.path
		if chosen.item != nil {
			if path, err = chosen.item(ctx, app, target.Project.Id, input); err != nil {
				return err
			}
		}
		settings, err := app.Config()
		if err != nil {
			return err
		}
		address, ok := cli.DashboardURL(settings.WebURL, target, path)
		if !ok {
			return cli.Failf("The dashboard address needs the project's organization, which this key does not show.").
				WithHint("Sign in as yourself with 'voidhash login'.")
		}
		app.Println(address)
		if *browser && !*noBrowser && app.IsInteractive() {
			if err := app.OpenURL(address); err != nil {
				app.Warnf("Could not open your browser; open the address above yourself.")
			}
		}
		return nil
	}
	return cmd
}

// listed is an item of a listing, by the fields the pages are found with.
type listed struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Slug string  `json:"slug"`
	Key  *string `json:"key"`
	URL  string  `json:"url"`
	Type string  `json:"type"`
}

type fetchPage func(c *api.Client, page cli.Page) (*http.Response, error)

// pageOf finds the item input names among those the listings return, or
// asks which on a terminal, and returns its page.
func pageOf(ctx context.Context, app *cli.App, kind cli.ItemKind[listed], input, usage, prefix string, listings ...fetchPage) (string, error) {
	var items []listed
	for _, fetch := range listings {
		found, err := cli.ListAll[listed](ctx, app, fetch)
		if err != nil {
			return "", err
		}
		items = append(items, found.Items...)
	}
	item, err := cli.RequireItem(ctx, app, kind, items, input, usage)
	if err != nil {
		return "", err
	}
	return prefix + item.ID, nil
}

func kindOf(noun, command string, label func(listed) string, keys, names func(listed) []string) cli.ItemKind[listed] {
	create := "create"
	if noun == "payment provider" {
		create = "connect"
	}
	return cli.ItemKind[listed]{
		Noun:          noun,
		ID:            func(item listed) string { return item.ID },
		Label:         label,
		ListCommand:   "voidhash " + command + " list",
		CreateCommand: "voidhash " + command + " " + create,
		Keys:          keys,
		Names:         names,
	}
}

func nameAndSlug(item listed) string { return item.Name + " (" + item.Slug + ")" }
func slugOf(item listed) []string    { return []string{item.Slug} }
func nameOf(item listed) []string    { return []string{item.Name} }
func none(listed) []string           { return nil }

func productPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	return pageOf(ctx, app, kindOf("product", "product", nameAndSlug, slugOf, nameOf), input, "voidhash open product <product>", "products/",
		func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
}

func paywallPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	return pageOf(ctx, app, kindOf("paywall", "paywall", nameAndSlug, slugOf, nameOf), input, "voidhash open paywall <paywall>", "paywalls/",
		func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaywallsList(ctx, projectID, &api.PaywallsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
}

func locationPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	return pageOf(ctx, app, kindOf("location", "location", nameAndSlug, slugOf, nameOf), input, "voidhash open location <location>", "settings/paywall-locations/",
		func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaywallLocationsList(ctx, projectID, &api.PaywallLocationsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
}

func webhookPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	kind := kindOf("webhook", "webhook",
		func(item listed) string { return item.Name + " (" + item.URL + ")" },
		func(item listed) []string { return []string{item.URL} }, nameOf)
	return pageOf(ctx, app, kind, input, "voidhash open webhook <webhook>", "settings/webhooks/",
		func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.WebhooksList(ctx, projectID, &api.WebhooksListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
}

// flagPage finds a flag in use or archived, by its key or id.
func flagPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	keyOf := func(item listed) string {
		if item.Key == nil {
			return item.ID
		}
		return *item.Key
	}
	kind := kindOf("flag", "flag", keyOf, func(item listed) []string { return []string{keyOf(item)} }, none)
	listing := func(archived string) fetchPage {
		return func(c *api.Client, page cli.Page) (*http.Response, error) {
			isArchived := api.FeatureFlagsListParamsIsArchived(archived)
			return c.FeatureFlagsList(ctx, projectID, &api.FeatureFlagsListParams{Cursor: page.Cursor, Limit: page.Limit, IsArchived: &isArchived})
		}
	}
	return pageOf(ctx, app, kind, input, "voidhash open flag <flag>", "flags/", listing("false"), listing("true"))
}

// experimentPage finds an experiment in use or archived, by its name or id.
func experimentPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	kind := kindOf("experiment", "experiment", func(item listed) string { return item.Name }, none, nameOf)
	listing := func(archived string) fetchPage {
		return func(c *api.Client, page cli.Page) (*http.Response, error) {
			isArchived := api.ExperimentsListParamsIsArchived(archived)
			return c.ExperimentsList(ctx, projectID, &api.ExperimentsListParams{Cursor: page.Cursor, Limit: page.Limit, IsArchived: &isArchived})
		}
	}
	return pageOf(ctx, app, kind, input, "voidhash open experiment <experiment>", "experiments/", listing("false"), listing("true"))
}

// storeNames are the stores as commands and people name them; a payment
// source goes by its own name and slug.
var storeNames = map[string]struct{ handle, label string }{
	"app_store":   {"app-store", "App Store"},
	"google_play": {"google-play", "Google Play"},
	"stripe":      {"stripe", "Stripe"},
}

// providerPage finds a payment provider by its id, store (app-store), key
// (bundle id, package name, Stripe account, payment source slug) or name.
func providerPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	store := func(item listed) string {
		if known, ok := storeNames[item.Type]; ok {
			return known.label
		}
		return item.Name
	}
	kind := kindOf("payment provider", "provider",
		func(item listed) string {
			if item.Key == nil {
				return store(item)
			}
			return store(item) + " (" + *item.Key + ")"
		},
		func(item listed) []string {
			var keys []string
			if known, ok := storeNames[item.Type]; ok {
				keys = append(keys, known.handle)
			}
			if item.Key != nil {
				keys = append(keys, *item.Key)
			}
			return keys
		},
		func(item listed) []string { return []string{item.Name, store(item)} })
	return pageOf(ctx, app, kind, input, "voidhash open provider <provider>", "settings/payment-providers/",
		func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaymentProvidersList(ctx, projectID, &api.PaymentProvidersListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
}

// person is an end user, by the fields they are found and named with.
type person struct {
	ID         string  `json:"id"`
	DistinctID string  `json:"distinctId"`
	Name       *string `json:"name"`
	Email      *string `json:"email"`
}

var personKind = cli.ItemKind[person]{
	Noun: "person",
	ID:   func(found person) string { return found.ID },
	Label: func(found person) string {
		name := found.DistinctID
		switch {
		case found.Name != nil && found.Email != nil:
			name = *found.Name + " <" + *found.Email + ">"
		case found.Name != nil:
			name = *found.Name
		case found.Email != nil:
			name = *found.Email
		}
		if name == found.DistinctID {
			return name
		}
		return name + " (" + found.DistinctID + ")"
	},
	ListCommand: "voidhash person list",
	Keys: func(found person) []string {
		if found.Email == nil {
			return []string{found.DistinctID}
		}
		return []string{found.DistinctID, *found.Email}
	},
	Names: func(found person) []string {
		if found.Name == nil {
			return nil
		}
		return []string{*found.Name}
	},
}

// personPage finds the one person input names exactly. A project can hold
// millions of persons, so they are looked up through the API's filters
// rather than listed: a prefix (person_id:, distinct_id:, email:) says
// which; without one, a person_ id is looked up as an id, and every input
// as a distinct id and, when it has an @, as an email.
func personPage(ctx context.Context, app *cli.App, projectID, input string) (string, error) {
	query, err := app.RequireText(ctx, input, cli.TextPrompt{
		What:    "the person",
		Message: "Their email, distinct id or id",
		Usage:   "voidhash open person <person>",
	})
	if err != nil {
		return "", err
	}
	wanted := strings.TrimSpace(query)
	prefix := ""
	for _, candidate := range []string{"person_id", "distinct_id", "email"} {
		if rest, ok := strings.CutPrefix(wanted, candidate+":"); ok && rest != "" {
			prefix, wanted = candidate, strings.TrimSpace(rest)
		}
	}
	lookUp := func(which string) bool { return prefix == "" || prefix == which }

	var persons []person
	add := func(found ...person) {
		for _, candidate := range found {
			known := false
			for _, existing := range persons {
				known = known || existing.ID == candidate.ID
			}
			if !known {
				persons = append(persons, candidate)
			}
		}
	}
	if lookUp("person_id") && (prefix != "" || strings.HasPrefix(wanted, "person_")) {
		found, err := cli.Fetch[person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsGet(ctx, projectID, wanted)
		})
		switch {
		case err == nil:
			add(found.Value)
		case cli.APIErrorCode(err) != "person_not_found":
			return "", err
		}
	}
	if lookUp("distinct_id") {
		found, _, err := cli.FetchPage[person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{DistinctId: &wanted})
		})
		if err != nil {
			return "", err
		}
		add(found.Items...)
	}
	if lookUp("email") && (prefix != "" || strings.Contains(wanted, "@")) {
		limit := 20
		found, _, err := cli.FetchPage[person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{Email: &wanted, Limit: &limit})
		})
		if err != nil {
			return "", err
		}
		add(found.Items...)
	}

	switch len(persons) {
	case 0:
		return "", &cli.UserError{
			Message:  fmt.Sprintf("No person has the email, distinct id or id %q.", strings.TrimSpace(query)),
			Hint:     "Persons are found by their exact email, distinct id or id; names and parts of an email cannot be searched. 'voidhash person list' shows the newest.",
			ExitCode: cli.ExitNotFound,
		}
	case 1:
		return "persons/" + url.PathEscape(persons[0].DistinctID), nil
	}
	// Several persons share the email: the candidates are listed.
	found, err := cli.FindItem(personKind, persons, wanted)
	if err != nil {
		return "", err
	}
	return "persons/" + url.PathEscape(found.DistinctID), nil
}
