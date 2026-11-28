// Package provider holds `voidhash provider`: where the project takes
// payments, the store products they sell and the purchases they recorded.
package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash provider`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "provider",
		Aliases: []string{"providers"},
		Short:   "Where the project takes payments: stores and payment sources.",
		Long:    "Where the project takes payments: connect the App Store, Google Play, Stripe or a payment source, check that they work, map their store products to products and import their purchase history.",
	}
	cmd.AddCommand(
		newList(app), newView(app), newConnect(app), newTest(app), newEdit(app),
		newProducts(app), newMap(app), newMove(app), newSell(app), newUnmap(app), newImport(app), newDelete(app),
		newRecordPayment(app), newRefund(app), newCancelSubscription(app),
	)
	return cmd
}

// storeProductCount is the store products a provider sells, as a sentence:
// "2, 1 not mapped".
func storeProductCount(entries []catalogEntry) string {
	unmapped := 0
	for _, entry := range entries {
		if len(entry.Mappings) == 0 {
			unmapped++
		}
	}
	if unmapped == 0 {
		return fmt.Sprint(len(entries))
	}
	return fmt.Sprintf("%d, %d not mapped", len(entries), unmapped)
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List where the project takes payments, with each provider's health.",
		Long:  "List where the project takes payments, with each provider's health: enabled, store products read and mapped, purchases waiting for a mapping.",
		Example: `voidhash provider list
voidhash provider list --json`,
	}
	project := cli.AddProjectFlag(cmd)
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
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(providers)
		case cli.Quiet:
			app.PrintIDs(providers)
			return nil
		}

		// Only people see each provider's health, so only they wait for it.
		type row struct {
			provider     provider
			catalog      []catalogEntry
			readable     bool
			waitingCount int
			isWaiting    bool
		}
		rows, err := cli.Each(ctx, providers.Items, 4, func(ctx context.Context, found provider) (row, error) {
			entries, readable, err := readCatalog(ctx, app, projectID, found, catalogQuery{})
			if err != nil {
				return row{}, err
			}
			waiting, err := readWaiting(ctx, app, projectID, found)
			if err != nil {
				return row{}, err
			}
			health := row{provider: found, catalog: entries.Items, readable: readable, isWaiting: len(waiting.Items) > 0}
			for _, product := range waiting.Items {
				health.waitingCount += product.EventCount
			}
			return health, nil
		})
		if err != nil {
			return err
		}
		anyWaiting := slices.ContainsFunc(rows, func(r row) bool { return r.isWaiting })
		cli.PrintTable(app, []cli.Column[row]{
			{Header: "NAME", Cell: func(r row) string { return catalog.ProviderLabel(r.provider) }},
			{Header: "STATUS", Cell: func(r row) string {
				if r.provider.IsEnabled {
					return "enabled"
				}
				return "off"
			}},
			{Header: "STORE PRODUCTS", Cell: func(r row) string {
				if !r.readable {
					return "could not be read"
				}
				return storeProductCount(r.catalog)
			}},
			{Header: "WAITING", Cell: func(r row) string {
				if r.waitingCount == 0 {
					return "-"
				}
				return plural(r.waitingCount, "purchase event")
			}},
			{Header: "ID", Cell: func(r row) string { return r.provider.Id }},
		}, rows, "No payment providers yet. Connect one with 'voidhash provider connect app-store' (or google-play, stripe, payment-source).")
		for _, r := range rows {
			if !r.readable {
				app.Warnf("%s", cli.Printable(catalogProblem(r.provider)))
			}
		}
		if anyWaiting {
			app.Notef("Imported purchases wait for store products to be mapped: 'voidhash provider products --unmapped' lists them.")
		}
		return nil
	}
	return cmd
}

func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a payment provider's status, store products and imports.",
		Long:  "Show a payment provider: its status, store products, purchases waiting for a mapping, history imports and the address its store sends notifications to.",
		Example: `voidhash provider view app-store
voidhash provider view paddle --json`,
	}
	cli.SetArgs(cmd, providerArg)
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
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		object, err := catalog.Require(ctx, app, catalog.ProviderKind, providers, cli.ArgAt(args, 0), "voidhash provider view <provider>")
		if err != nil {
			return err
		}
		if mode == cli.Quiet {
			app.PrintIDs(object)
			return nil
		}
		found := object.Value
		entries, readable, err := readCatalog(ctx, app, projectID, found, catalogQuery{})
		if err != nil {
			return err
		}
		waiting, err := readWaiting(ctx, app, projectID, found)
		if err != nil {
			return err
		}
		imports := cli.List[api.PaymentProviderHistoryImport]{}
		if isImportable(found) {
			imports, err = cli.ListAll[api.PaymentProviderHistoryImport](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.PaymentProviderHistoryImportsList(ctx, projectID, found.Id,
					&api.PaymentProviderHistoryImportsListParams{Cursor: page.Cursor, Limit: page.Limit})
			})
			if err != nil {
				return err
			}
		}
		if mode == cli.JSON {
			storeProducts := json.RawMessage("null")
			if readable {
				storeProducts = entries.RawJSON()
			}
			return app.PrintJSON(catalog.Extend(object.Raw,
				catalog.RawField{Name: "storeProducts", Value: storeProducts},
				catalog.RawField{Name: "waitingForMapping", Value: waiting.RawJSON()},
				catalog.RawField{Name: "imports", Value: imports.RawJSON()},
			))
		}

		settings, err := app.Config()
		if err != nil {
			return err
		}
		handle := catalog.ProviderHandle(found)
		status := "enabled"
		switch {
		case found.IsEnabled:
		case catalog.IsSource(found):
			status = fmt.Sprintf("off: the purchases it reports are refused ('voidhash provider edit %s --enable')", handle)
		default:
			status = fmt.Sprintf("off: it processes no purchases until its credentials are saved ('voidhash provider connect %s')", handle)
		}
		storeProducts := catalogProblem(found)
		if readable {
			storeProducts = storeProductCount(entries.Items)
			if strings.Contains(storeProducts, "not mapped") {
				storeProducts += fmt.Sprintf(" ('voidhash provider products %s --unmapped')", handle)
			}
		}
		fields := []cli.Field{{Label: "Status", Value: status}, {Label: "Store products", Value: storeProducts}}
		if len(waiting.Items) > 0 {
			lines := make([]string, len(waiting.Items))
			for index, product := range waiting.Items {
				lines[index] = product.ProviderProductKey + ": " + plural(product.EventCount, "purchase event")
			}
			fields = append(fields, cli.Field{Label: "Waiting", Value: strings.Join(lines, "\n")})
		}
		if catalog.IsSource(found) {
			endpoint := endpointURL(found, "endpoint")
			if endpoint == "" {
				endpoint = fmt.Sprintf("none ('voidhash provider edit %s --endpoint <url>')", handle)
			}
			fields = append(fields, cli.Field{Label: "Endpoint", Value: endpoint})
			if testEndpoint := endpointURL(found, "testEndpoint"); testEndpoint != "" {
				fields = append(fields, cli.Field{Label: "Test endpoint", Value: testEndpoint})
			}
		}
		if isImportable(found) {
			history := fmt.Sprintf("never imported ('voidhash provider import %s')", handle)
			if len(imports.Items) > 0 {
				lines := make([]string, len(imports.Items))
				for index, entry := range imports.Items {
					lines[index] = string(entry.Environment) + ": " + describeImport(entry)
				}
				history = strings.Join(lines, "\n")
			}
			fields = append(fields, cli.Field{Label: "History", Value: history})
		}
		if notifications, ok := notificationTarget(settings.APIURL, found); ok {
			fields = append(fields, cli.Field{Label: "Notifications", Value: notifications.url + "\nset it as " + notifications.where})
		}
		fields = append(fields, cli.Field{Label: "ID", Value: found.Id})
		if address, ok := cli.DashboardURL(settings.WebURL, target, "settings/payment-providers/"+found.Id); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		app.Println(cli.Printable(catalog.ProviderLabel(found)) + "\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}

// endpointResult is how one endpoint of a payment source answered a test.
type endpointResult struct {
	Environment string   `json:"environment"`
	URL         string   `json:"url"`
	Result      string   `json:"result"`
	Detail      string   `json:"detail"`
	Operations  []string `json:"operations"`

	name string
}

// testReport is what `provider test --json` prints.
type testReport struct {
	PaymentProviderID string            `json:"paymentProviderId"`
	Result            string            `json:"result"`
	Detail            string            `json:"detail"`
	Operations        *[]string         `json:"operations,omitempty"`
	Endpoints         *[]endpointResult `json:"endpoints,omitempty"`
}

var sourceOperations = []string{"catalog.list", "history.list", "subscription.cancel", "transaction.refund"}

func newTest(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "test",
		Short: "Check that Voidhash can reach a provider with what is saved.",
		Long: `Check that Voidhash can reach a provider with what is saved: it reads an App Store, Google Play or Stripe catalog again, or calls each of a payment source's endpoints, the test one with a test request.

Exits with 1 when it does not work. --quiet prints only "works" or "fails".`,
		Example: `voidhash provider test stripe
voidhash provider test paddle --json`,
	}
	cli.SetArgs(cmd, providerArg)
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
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, catalog.ProviderKind, providers.Items, cli.ArgAt(args, 0), "voidhash provider test <provider>")
		if err != nil {
			return err
		}
		label, handle := catalog.ProviderLabel(found), catalog.ProviderHandle(found)
		print := func(report testReport, human string) error {
			switch mode {
			case cli.JSON:
				return app.PrintJSON(report)
			case cli.Quiet:
				app.Println(report.Result)
			default:
				app.Println(cli.PrintableLines(human))
			}
			return nil
		}

		if catalog.IsSource(found) {
			// Each endpoint is tested as the requests it serves: the main one
			// with production requests, the test one with test requests.
			var results []endpointResult
			for _, endpoint := range []struct{ environment, name, which, rotateFlag, connectFlag string }{
				{"production", "endpoint", "endpoint", "--rotate-secret", "--endpoint"},
				{"test", "test endpoint", "testEndpoint", "--rotate-test-secret", "--test-endpoint"},
			} {
				url := endpointURL(found, endpoint.which)
				if url == "" {
					continue
				}
				result := endpointResult{Environment: endpoint.environment, URL: url, name: endpoint.name}
				environment := api.PaymentSourceEnvironment(endpoint.environment)
				description, err := cli.Fetch[api.PaymentSourceEndpointDescription](ctx, app, func(c *api.Client) (*http.Response, error) {
					return c.PaymentProvidersTest(ctx, projectID, found.Id, &api.PaymentProvidersTestParams{Environment: &environment})
				})
				switch {
				case err == nil:
					operations := description.Value.Operations
					if operations == nil {
						operations = []string{}
					}
					result.Result, result.Operations = "works", operations
					result.Detail = "answers"
					if sdk := description.Value.Sdk; sdk != nil {
						result.Detail += fmt.Sprintf(" (%s %s)", sdk.Name, sdk.Version)
					}
					result.Detail += " and implements " + strings.Join(operations, ", ") + "."
					var missing []string
					for _, operation := range sourceOperations {
						if !contains(operations, operation) {
							missing = append(missing, operation)
						}
					}
					if len(missing) > 0 {
						result.Detail += " Not implemented: " + strings.Join(missing, ", ") + "."
					}
				case !cli.IsAPIError(err):
					return err
				default:
					// A failing endpoint is reported next to the others, not as the command's error.
					result.Result = "fails"
					result.Detail = errorLine(cli.APIError(err, map[string]string{
						"payment_source_endpoint_not_configured": fmt.Sprintf("Connect it first: 'voidhash provider edit %s %s <url>'.", handle, endpoint.connectFlag),
						"payment_source_endpoint_rejected":       fmt.Sprintf("Its server likely has another signing secret: 'voidhash provider edit %s %s' makes a new one to give it.", handle, endpoint.rotateFlag),
					}))
				}
				results = append(results, result)
			}
			if len(results) == 0 {
				return cli.Failf("%s has no endpoint to test.", label).WithHint(fmt.Sprintf(
					"Connect one first: 'voidhash provider edit %s --endpoint <url>' (or --test-endpoint <url> for test requests only).", handle))
			}
			var failing []endpointResult
			var lines, human []string
			for _, result := range results {
				line := result.name + " " + result.URL + ": "
				if result.Result == "fails" {
					failing = append(failing, result)
					line += "fails: "
				}
				lines = append(lines, line+result.Detail)
				human = append(human, label+" "+line+result.Detail)
			}
			overall := "works"
			if len(failing) > 0 {
				overall = "fails"
			}
			if err := print(testReport{
				PaymentProviderID: found.Id, Result: overall, Detail: strings.Join(lines, "\n"), Endpoints: &results,
			}, strings.Join(human, "\n")); err != nil {
				return err
			}
			switch len(failing) {
			case 0:
				return nil
			case 1:
				return cli.Failf("%s's %s does not work.", label, failing[0].name)
			}
			return cli.Failf("Neither endpoint of %s works.", label)
		}

		// A store has no operations to list: the field is null.
		report := testReport{PaymentProviderID: found.Id, Result: "fails", Operations: new([]string)}
		switch {
		case !found.IsEnabled:
			report.Detail = "it is not enabled, so its credentials were never checked."
		default:
			entries, readable, err := readCatalog(ctx, app, projectID, found, catalogQuery{refresh: true})
			if err != nil {
				return err
			}
			report.Detail = catalogProblem(found)
			if readable {
				report.Result = "works"
				report.Detail = fmt.Sprintf("Voidhash read %s with the saved credentials, so they work.", plural(len(entries.Items), "store product"))
			}
		}
		if err := print(report, label+": "+report.Detail); err != nil {
			return err
		}
		if report.Result == "fails" {
			return cli.Failf("%s does not work.", label).WithHint(fmt.Sprintf("Save new credentials with 'voidhash provider connect %s'.", handle))
		}
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

// errorLine is a failure in one line: its message and its hint.
func errorLine(err error) string {
	if userErr, ok := err.(*cli.UserError); ok {
		return userErr.Line()
	}
	return err.Error()
}
