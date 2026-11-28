package provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

const watchInterval = 2 * time.Second

func newImport(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "import",
		Short: "Import the purchases a provider recorded before Voidhash was connected.",
		Long: "Import the purchases a provider recorded before Voidhash was connected, in the background. Stripe and payment sources list their own history. " +
			"The App Store and Google Play list no app's purchases, so their import takes a CSV file (--file) whose first line names the columns: " +
			"transaction_id (App Store) or purchase_token (Google Play), one purchase per line, and optionally app_user_id, your id for the buyer. " +
			"Running it again skips what is recorded; --watch follows it, --report writes what became of each purchase, --cancel stops it.",
		Example: `voidhash provider import stripe --watch
voidhash provider import paddle --environment test
voidhash provider import app-store --file subscribers.csv --watch --report report.csv
voidhash provider import google-play --file tokens.csv
voidhash provider import stripe --cancel`,
	}
	cli.SetArgs(cmd, providerArg)
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "test"}, "production",
		"Which purchases: production (default) or test, such as Stripe's test mode, a payment source's test payments, the App Store's sandbox or Google Play's license testers")
	watch := cmd.Flags().Bool("watch", false, "Follow the import until it ends")
	cancel := cmd.Flags().Bool("cancel", false, "Stop the running import instead; what it recorded stays")
	file := cmd.Flags().String("file", "", "App Store and Google Play: the CSV file of purchases to import")
	report := cmd.Flags().String("report", "", "App Store and Google Play: write what became of each purchase to this CSV file (with --watch, once the import ends)")
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
		var found provider
		switch input := cli.ArgAt(args, 0); {
		case input != "":
			found, err = cli.FindItem(catalog.ProviderKind, providers.Items, input)
		case !app.IsInteractive():
			err = cli.MissingInput("the provider", "voidhash provider import <provider>")
		default:
			found, err = cli.ChooseItem(ctx, app, catalog.ProviderKind, providers.Filter(isImportable).Items, "Import the history of which provider?")
		}
		if err != nil {
			return err
		}
		label, handle := catalog.ProviderLabel(found), catalog.ProviderHandle(found)
		if !isImportable(found) && !isStore(found) {
			return cli.Usagef("%s has no history to import.", label)
		}
		if *file != "" && !isStore(found) {
			return cli.Usagef("%s lists its own history; --file is for the App Store and Google Play.", label)
		}
		wanted := api.PaymentProviderHistoryImportsListParamsEnvironment(*environment)
		latest, err := cli.ListAll[api.PaymentProviderHistoryImport](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaymentProviderHistoryImportsList(ctx, projectID, found.Id,
				&api.PaymentProviderHistoryImportsListParams{Cursor: page.Cursor, Limit: page.Limit, Environment: &wanted})
		})
		if err != nil {
			return err
		}
		var current cli.Object[api.PaymentProviderHistoryImport]
		isRunning := false
		for index, historyImport := range latest.Items {
			if historyImport.Status == "running" {
				current, isRunning = latest.Object(index), true
				break
			}
		}

		if *cancel {
			if !isRunning {
				return &cli.UserError{
					Message:  fmt.Sprintf("No %s import of %s is running.", *environment, label),
					ExitCode: cli.ExitNotFound,
				}
			}
			canceled, err := cli.Fetch[api.PaymentProviderHistoryImport](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PaymentProviderHistoryImportsCancel(ctx, projectID, found.Id, current.Value.Id)
			})
			if err != nil {
				return err
			}
			return app.PrintItem(mode, canceled, fmt.Sprintf("Stopped the import: %s.", describeImport(canceled.Value)))
		}

		if isStore(found) {
			return importStoreFile(ctx, app, mode, storeImport{
				environment: *environment, file: *file, found: found, handle: handle, label: label,
				latest: latest, projectID: projectID, report: *report, watch: *watch,
			})
		}

		started := "An import of %s's %s purchase history is already running."
		if !isRunning {
			started = "Started importing %s's %s purchase history."
			current, err = startImport(ctx, app, projectID, found.Id, *environment)
			if err != nil {
				blocked := fmt.Sprintf("Connect its endpoint first: 'voidhash provider edit %s --endpoint <url>'.", handle)
				switch {
				case found.Type == "stripe":
					blocked = "Save its secret keys first: 'voidhash provider connect stripe'."
				case *environment == "test":
					blocked = fmt.Sprintf("Connect an endpoint first: 'voidhash provider edit %s --test-endpoint <url>', or --endpoint <url> for production too.", handle)
				}
				return cli.APIError(err, map[string]string{"history_import_blocked": blocked})
			}
		}
		started = fmt.Sprintf(started, label, *environment)
		progress := func(historyImport api.PaymentProviderHistoryImport) string {
			return "  " + describeImport(historyImport)
		}
		if !*watch {
			return app.PrintItem(mode, current, strings.Join([]string{
				started, progress(current.Value), fmt.Sprintf("Follow it with 'voidhash provider import %s --watch'.", handle),
			}, "\n"))
		}
		if mode == cli.Human {
			app.Println(cli.PrintableLines(started + "\n" + progress(current.Value)))
		}
		current, err = followImport(ctx, app, mode, projectID, found.Id, current, progress)
		if err != nil {
			return err
		}
		if mode != cli.Human {
			if err := app.PrintItem(mode, current, ""); err != nil {
				return err
			}
		}
		if current.Value.Status == "failed" {
			message := "The import failed."
			if current.Value.LastError != nil {
				message = "The import failed: " + *current.Value.LastError
			}
			return cli.Failf("%s", message).WithHint(fmt.Sprintf(
				"Fix that, then run 'voidhash provider import %s' again; what it recorded stays.", handle))
		}
		if mode == cli.Human && current.Value.Counts.Parked > 0 {
			app.Notef("%s wait for store products to be mapped: 'voidhash provider products %s --unmapped'.",
				plural(current.Value.Counts.Parked, "purchase"), cli.Printable(handle))
		}
		return nil
	}
	return cmd
}

// startImport starts an import of the provider's environment.
func startImport(ctx context.Context, app *cli.App, projectID, providerID, environment string) (cli.Object[api.PaymentProviderHistoryImport], error) {
	return cli.Fetch[api.PaymentProviderHistoryImport](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaymentProviderHistoryImportsCreateWithBody(ctx, projectID, providerID, catalog.JSON,
			catalog.Body(map[string]any{"environment": environment}))
	})
}

// followImport reads the import until it ends, printing each change of
// progress on a terminal.
func followImport(ctx context.Context, app *cli.App, mode cli.OutputMode, projectID, providerID string,
	current cli.Object[api.PaymentProviderHistoryImport], progress func(api.PaymentProviderHistoryImport) string,
) (cli.Object[api.PaymentProviderHistoryImport], error) {
	for current.Value.Status == "running" {
		if err := app.Sleep(ctx, watchInterval); err != nil {
			return current, err
		}
		next, err := cli.Fetch[api.PaymentProviderHistoryImport](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProviderHistoryImportsGet(ctx, projectID, providerID, current.Value.Id)
		})
		if err != nil {
			return current, err
		}
		if mode == cli.Human && progress(next.Value) != progress(current.Value) {
			app.Println(cli.Printable(progress(next.Value)))
		}
		current = next
	}
	return current, nil
}

// endpointPlan is one endpoint of a payment source after an edit.
type endpointPlan struct {
	current, next string
	// signingSecret is new when the endpoint is connected for the first time
	// or rotated; a changed URL keeps the stored one.
	signingSecret string
}

func planEndpoint(found provider, which, given string, disconnect, rotate bool) endpointPlan {
	plan := endpointPlan{current: endpointURL(found, which)}
	switch {
	case disconnect:
	case given != "":
		plan.next = given
	default:
		plan.next = plan.current
	}
	if plan.next != "" && (plan.current == "" || rotate) {
		plan.signingSecret = newSigningSecret()
	}
	return plan
}

// saved is the endpoint as the configuration takes it: nil disconnects it,
// and the stored-secret placeholder keeps the secret it has.
func (p endpointPlan) saved() any {
	if p.next == "" {
		return nil
	}
	secret := p.signingSecret
	if secret == "" {
		secret = storedSecret
	}
	return map[string]any{"url": p.next, "signingSecret": secret}
}

func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Rename a provider, turn it on or off, or change a payment source's endpoints.",
		Long: `Rename a provider, enable or disable it, or connect, change or disconnect a payment source's endpoint and its test endpoint and rotate their signing secrets.

Disabling, disconnecting and rotating ask first; --yes skips that. A new signing secret is shown once: with --json or --quiet it goes to standard error. 'voidhash provider connect' changes a store's credentials.`,
		Example: `voidhash provider edit stripe --disable
voidhash provider edit paddle --endpoint https://pay.example.com/voidhash
voidhash provider edit paddle --rotate-secret --yes`,
	}
	cli.SetArgs(cmd, providerArg)
	name := cmd.Flags().String("name", "", "Its new name")
	enable := cmd.Flags().Bool("enable", false, "Process its purchases again; a store's credentials are checked")
	disable := cmd.Flags().Bool("disable", false, "Stop processing its purchases")
	endpoint := cmd.Flags().String("endpoint", "", "A payment source's HTTPS endpoint `url`, its server's provider handler; it serves production requests, and test ones without a test endpoint")
	disconnectEndpoint := cmd.Flags().Bool("disconnect-endpoint", false, "Stop calling a payment source's endpoint")
	rotateSecret := cmd.Flags().Bool("rotate-secret", false, "Give a payment source's endpoint a new signing secret")
	testEndpoint := cmd.Flags().String("test-endpoint", "", "A payment source's HTTPS endpoint `url` for test requests only, such as its staging server's provider handler")
	disconnectTestEndpoint := cmd.Flags().Bool("disconnect-test-endpoint", false, "Stop calling a payment source's test endpoint; test requests go to its endpoint")
	rotateTestSecret := cmd.Flags().Bool("rotate-test-secret", false, "Give a payment source's test endpoint a new signing secret")
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		switch {
		case *enable && *disable:
			return cli.Usagef("--enable and --disable cannot be combined.")
		case *endpoint != "" && *disconnectEndpoint:
			return cli.Usagef("--endpoint and --disconnect-endpoint cannot be combined.")
		case *testEndpoint != "" && *disconnectTestEndpoint:
			return cli.Usagef("--test-endpoint and --disconnect-test-endpoint cannot be combined.")
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
		found, err := cli.RequireItem(ctx, app, catalog.ProviderKind, providers.Items, cli.ArgAt(args, 0), "voidhash provider edit <provider> --name <name>")
		if err != nil {
			return err
		}
		label, handle, isSource := catalog.ProviderLabel(found), catalog.ProviderHandle(found), catalog.IsSource(found)
		changesEndpoint := *endpoint != "" || *disconnectEndpoint || *rotateSecret
		changesTestEndpoint := *testEndpoint != "" || *disconnectTestEndpoint || *rotateTestSecret
		if !isSource && (changesEndpoint || changesTestEndpoint) {
			return cli.Usagef("Only a payment source has an endpoint.").WithHint(
				fmt.Sprintf("Change a store's credentials with 'voidhash provider connect %s'.", handle))
		}
		if *name == "" && !*enable && !*disable && !changesEndpoint && !changesTestEndpoint {
			hint := fmt.Sprintf("Pass --name, --enable or --disable; 'voidhash provider connect %s' changes its credentials.", handle)
			if isSource {
				hint = "Pass --name, --enable, --disable, --endpoint, --disconnect-endpoint, --rotate-secret, --test-endpoint, --disconnect-test-endpoint or --rotate-test-secret."
			}
			return cli.Usagef("Nothing to change.").WithHint(hint)
		}
		main := planEndpoint(found, "endpoint", *endpoint, *disconnectEndpoint, *rotateSecret)
		test := planEndpoint(found, "testEndpoint", *testEndpoint, *disconnectTestEndpoint, *rotateTestSecret)
		if *rotateSecret && main.next == "" {
			return cli.Usagef("%s has no endpoint to rotate the secret of.", label).WithHint("Connect one with --endpoint <url>.")
		}
		if *rotateTestSecret && test.next == "" {
			return cli.Usagef("%s has no test endpoint to rotate the secret of.", label).WithHint("Connect one with --test-endpoint <url>.")
		}
		var risks []string
		if *disable && found.IsEnabled {
			if isSource {
				risks = append(risks, "the purchases it reports are refused")
			} else {
				risks = append(risks, "its purchases stop being processed")
			}
		}
		if *disconnectEndpoint && main.current != "" {
			if test.next != "" {
				risks = append(risks, "production imports, refunds and cancellations through its endpoint stop")
			} else {
				risks = append(risks, "imports, refunds and cancellations through its endpoint stop")
			}
		}
		if *rotateSecret {
			risks = append(risks, "its server's requests fail until it has the new secret")
		}
		if *disconnectTestEndpoint && test.current != "" {
			if main.next != "" {
				risks = append(risks, "test requests go to its endpoint instead")
			} else {
				risks = append(risks, "test imports, refunds and cancellations stop")
			}
		}
		if *rotateTestSecret {
			risks = append(risks, "its test server's requests fail until it has the new secret")
		}
		if len(risks) > 0 {
			consequences := strings.Join(risks, "; ")
			consequences = strings.ToUpper(consequences[:1]) + consequences[1:]
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Change %s in %s? %s.", label, target.Label(), consequences)); err != nil {
				return err
			}
		}
		body := map[string]any{}
		if *name != "" {
			body["name"] = *name
		}
		if *enable || *disable {
			body["isEnabled"] = *enable
		}
		// The configuration is saved whole; the endpoint not edited goes back
		// as read, its secret as the stored-secret placeholder, so it stays.
		if changesEndpoint || changesTestEndpoint {
			configuration := map[string]any{}
			for key, value := range found.Configuration {
				configuration[key] = value
			}
			if changesEndpoint {
				configuration["endpoint"] = main.saved()
			}
			if changesTestEndpoint {
				configuration["testEndpoint"] = test.saved()
			}
			body["configuration"] = configuration
		}
		updated, err := cli.Fetch[provider](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProvidersUpdateWithBody(ctx, projectID, found.Id, catalog.JSON, catalog.Body(body))
		})
		if err != nil {
			return err
		}
		lines := []string{fmt.Sprintf("Updated %s.", catalog.ProviderLabel(updated.Value))}
		var secrets []string
		if main.signingSecret != "" {
			secrets = append(secrets, "Signing secret, shown once: "+main.signingSecret)
			lines = append(lines, secrets[len(secrets)-1], fmt.Sprintf(
				"Give it to the source's server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash provider test %s'.", handle))
		}
		if test.signingSecret != "" {
			secrets = append(secrets, "Test endpoint signing secret, shown once: "+test.signingSecret)
			lines = append(lines, secrets[len(secrets)-1], fmt.Sprintf(
				"Give it to the source's test (staging) server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash provider test %s'.", handle))
		}
		if err := app.PrintItem(mode, updated, strings.Join(lines, "\n")); err != nil {
			return err
		}
		// A new secret cannot be read again, so scripts get it on standard error.
		if mode != cli.Human {
			for _, line := range secrets {
				app.Notef("%s", line)
			}
		}
		return nil
	}
	return cmd
}

func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a payment provider that no store product is mapped to.",
		Long:    "Delete a payment provider that no store product is mapped to. Asks first; --yes skips that.",
		Example: "voidhash provider delete google-play --yes",
	}
	cli.SetArgs(cmd, providerArg)
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
		providers, err := catalog.ListProviders(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := catalog.Require(ctx, app, catalog.ProviderKind, providers, cli.ArgAt(args, 0), "voidhash provider delete <provider> --yes")
		if err != nil {
			return err
		}
		label, handle := catalog.ProviderLabel(found.Value), catalog.ProviderHandle(found.Value)
		effect := "Its purchases stop being processed and its saved credentials are removed"
		if catalog.IsSource(found.Value) {
			effect = "The purchases its backend reports are refused from then on"
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete %s from %s? %s; what it recorded keeps its history. This cannot be undone.",
			label, target.Label(), effect)); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProvidersDelete(ctx, projectID, found.Value.Id)
		}); err != nil {
			return cli.APIError(err, map[string]string{
				"payment_provider_in_use": fmt.Sprintf(
					"Unmap its store products first: 'voidhash provider products %[1]s --mapped' lists them, 'voidhash provider unmap <store-product> --provider %[1]s' removes each. Or turn it off: 'voidhash provider edit %[1]s --disable'.", handle),
			})
		}
		return app.PrintItem(mode, found, "Deleted "+label+".")
	}
	return cmd
}
