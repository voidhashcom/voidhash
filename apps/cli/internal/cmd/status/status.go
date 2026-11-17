// Package status holds `voidhash status`: the project commands act on
// here, and how its setup stands.
package status

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// New creates `voidhash status`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show the project commands act on here, and what its setup still needs.",
		Long: `Show the project commands act on here and why, who you are signed in as, and the health of the project's setup: the stores it is connected to, products mapped to store products, purchases waiting for a product, events from the SDKs, and webhooks. Each part that needs something names the command that fixes it, and the last line is what to do next.

A part your credential cannot read shows as "could not check"; the rest is still reported.`,
		Example: `voidhash status
voidhash status --project acme/app --json`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		checks, err := runChecks(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		next := nextStep(checks)
		settings, err := app.Config()
		if err != nil {
			return err
		}
		dashboard, hasDashboard := cli.DashboardURL(settings.WebURL, target, "")

		if *asJSON {
			return printJSON(app, target, checks, next, dashboard, hasDashboard)
		}

		style := app.Style()
		marks := map[string]string{
			stateOK:        style.Green("✓"),
			stateAttention: style.Yellow("!"),
			stateProblem:   style.Red("✗"),
			stateUnknown:   style.Dim("?"),
		}
		signedIn := "a project secret key"
		if !target.Session.IsKey() {
			signedIn = target.Session.Person.Name + " <" + target.Session.Person.Email + ">"
		}
		if target.Session.IsReadOnly {
			signedIn += " (read-only)"
		}
		fields := []cli.Field{
			{Label: "Project", Value: target.Project.Id + ", " + target.Source.Describe()},
			{Label: "Signed in", Value: signedIn},
		}
		if hasDashboard {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: dashboard})
		}
		width := 0
		for _, item := range checks {
			width = max(width, len(item.Name))
		}
		lines := []string{style.Bold(cli.Printable(target.Label())), cli.FormatFields(fields), ""}
		for _, item := range checks {
			lines = append(lines, fmt.Sprintf("  %s %-*s  %s", marks[item.State], width, item.Name, cli.Printable(item.Summary)))
			if item.Next != "" && item.State != stateOK {
				lines = append(lines, fmt.Sprintf("    %s  → %s", strings.Repeat(" ", width), cli.Printable(item.Next)))
			}
		}
		lines = append(lines, "")
		if next == "" {
			lines = append(lines, "Everything is set up.")
		} else {
			lines = append(lines, "Next: "+cli.Printable(next))
		}
		app.Println(strings.Join(lines, "\n"))
		return nil
	}
	return cmd
}

// printJSON prints the report for scripts. The project, organization and
// person are the session's objects as the server sent them.
func printJSON(app *cli.App, target *cli.ProjectContext, checks []check, next, dashboard string, hasDashboard bool) error {
	var session struct {
		Person        json.RawMessage   `json:"person"`
		Organizations []json.RawMessage `json:"organizations"`
		Projects      []json.RawMessage `json:"projects"`
	}
	if err := json.Unmarshal(target.Session.Raw, &session); err != nil {
		return err
	}
	withID := func(objects []json.RawMessage, id string) json.RawMessage {
		for _, object := range objects {
			var identified struct {
				ID string `json:"id"`
			}
			if json.Unmarshal(object, &identified) == nil && identified.ID == id {
				return object
			}
		}
		return json.RawMessage("null")
	}
	orNull := func(text string, present bool) *string {
		if !present {
			return nil
		}
		return &text
	}
	type source struct {
		Kind      string `json:"kind"`
		Directory string `json:"directory,omitempty"`
		File      string `json:"file,omitempty"`
	}
	organization := json.RawMessage("null")
	if target.Organization != nil {
		organization = withID(session.Organizations, target.Organization.Id)
	}
	person := session.Person
	if len(person) == 0 {
		person = json.RawMessage("null")
	}
	return app.PrintJSON(struct {
		Project      json.RawMessage `json:"project"`
		Organization json.RawMessage `json:"organization"`
		Source       source          `json:"source"`
		Person       json.RawMessage `json:"person"`
		IsReadOnly   bool            `json:"isReadOnly"`
		DashboardURL *string         `json:"dashboardUrl"`
		Checks       []check         `json:"checks"`
		Next         *string         `json:"next"`
	}{
		Project:      withID(session.Projects, target.Project.Id),
		Organization: organization,
		Source:       source{Kind: target.Source.Kind, Directory: target.Source.Directory, File: target.Source.File},
		Person:       person,
		IsReadOnly:   target.Session.IsReadOnly,
		DashboardURL: orNull(dashboard, hasDashboard),
		Checks:       checks,
		Next:         orNull(next, next != ""),
	})
}

// Check is one line of a project's health report.
type Check = check

// Checks reads a project's setup for another command: every check, and what
// to do first, which is empty when everything is set up.
func Checks(ctx context.Context, app *cli.App, projectID string) ([]Check, string, error) {
	checks, err := runChecks(ctx, app, projectID)
	return checks, nextStep(checks), err
}

// runChecks makes every check. Each is independent: one the credential
// cannot make, or the API does not answer, reads "could not check". Only an
// interrupted run fails.
func runChecks(ctx context.Context, app *cli.App, projectID string) ([]check, error) {
	unknown := func(name string, err error) check {
		why := "the API did not answer"
		var described *cli.UserError
		if errors.As(cli.APIError(err, nil), &described) {
			why = strings.TrimSuffix(strings.SplitN(described.Message, "\n", 2)[0], ".")
		}
		return check{Name: name, State: stateUnknown, Summary: "could not check: " + why}
	}

	var (
		providers                                                    cli.List[provider]
		mappings                                                     []mapping
		waiting                                                      []waitingProduct
		products                                                     cli.List[product]
		health                                                       cli.Object[trackingHealth]
		webhooks                                                     cli.List[webhook]
		mappingsErr, waitingErr, productsErr, healthErr, webhooksErr error
	)
	// The checks read at the same time. A task keeps its failure for its own
	// check instead of returning it, which would stop the others.
	_ = cli.Together(ctx,
		func(ctx context.Context) error {
			var providersErr error
			providers, providersErr = cli.ListAll[provider](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.PaymentProvidersList(ctx, projectID, &api.PaymentProvidersListParams{Cursor: page.Cursor, Limit: page.Limit})
			})
			mappingsErr, waitingErr = providersErr, providersErr
			type storeProducts struct {
				mappings    cli.List[mapping]
				waiting     cli.List[waitingProduct]
				mappingsErr error
				waitingErr  error
			}
			perProvider, _ := cli.Each(ctx, providers.Items, 4, func(ctx context.Context, item provider) (found storeProducts, _ error) {
				found.mappings, found.mappingsErr = cli.ListAll[mapping](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
					return c.PaymentProviderProductsList(ctx, projectID, item.ID, &api.PaymentProviderProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
				})
				limit := 50
				found.waiting, _, found.waitingErr = cli.FetchPage[waitingProduct](ctx, app, func(c *api.Client) (*http.Response, error) {
					return c.PaymentProvidersListUnmappedProducts(ctx, projectID, item.ID, &api.PaymentProvidersListUnmappedProductsParams{Limit: &limit})
				})
				return found, nil
			})
			for _, found := range perProvider {
				mappings = append(mappings, found.mappings.Items...)
				waiting = append(waiting, found.waiting.Items...)
				if mappingsErr == nil {
					mappingsErr = found.mappingsErr
				}
				if waitingErr == nil {
					waitingErr = found.waitingErr
				}
			}
			return nil
		},
		func(ctx context.Context) error {
			products, productsErr = cli.ListAll[product](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
			})
			return nil
		},
		func(ctx context.Context) error {
			health, healthErr = cli.Fetch[trackingHealth](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.AnalyticsReportTrackingHealth(ctx, projectID)
			})
			return nil
		},
		func(ctx context.Context) error {
			webhooks, webhooksErr = cli.ListAll[webhook](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.WebhooksList(ctx, projectID, &api.WebhooksListParams{Cursor: page.Cursor, Limit: page.Limit})
			})
			return nil
		},
	)
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	// The stores are known once the providers and their store products are.
	catalogErr := mappingsErr
	checks := make([]check, 0, 5)
	if catalogErr != nil {
		checks = append(checks, unknown("Stores", catalogErr))
	} else {
		checks = append(checks, storesCheck(providers.Items))
	}
	switch {
	case productsErr != nil:
		checks = append(checks, unknown("Products", productsErr))
	case catalogErr != nil:
		checks = append(checks, unknown("Products", catalogErr))
	default:
		checks = append(checks, productsCheck(products.Items, mappings))
	}
	if waitingErr != nil {
		checks = append(checks, unknown("Purchases", waitingErr))
	} else {
		checks = append(checks, waitingPurchasesCheck(waiting))
	}
	if healthErr != nil {
		checks = append(checks, unknown("SDK events", healthErr))
	} else {
		checks = append(checks, sdkCheck(health.Value, app.FormatTimeAgo))
	}
	if webhooksErr != nil {
		checks = append(checks, unknown("Webhooks", webhooksErr))
	} else {
		checks = append(checks, webhooksCheck(webhooks.Items))
	}
	return checks, nil
}
