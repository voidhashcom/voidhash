package provider

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// `voidhash provider connect <store>` saves what a store needs and enables
// it, asking for each value on a terminal and reading key files from disk.
// Running it again for a connected store changes its settings; values not
// given keep what is saved, credentials included.
//
// A credential comes from its flag, from the key file a flag or an answer
// names, or from an answer typed without echo. It is sent to the API and
// never printed, logged or read from the environment.

type fieldKind int

const (
	// textField is typed as it is.
	textField fieldKind = iota
	// secretField is typed without echo.
	secretField
	// fileField is read from the path given.
	fileField
)

// field is one value a store needs: where it is saved, the flag that gives
// it, and how to ask for it.
type field struct {
	// path is where it is saved in the provider's configuration: live, secretKey.
	path []string
	flag string
	// given is the flag's value; nil when the flag was not passed.
	given *string
	// message is what the prompt asks.
	message string
	kind    fieldKind
	// fallback is the value when none is given or saved; a field without one
	// is required.
	fallback *string
	// optional fields are left out when none is given or saved, such as the
	// credentials of a Stripe mode not used.
	optional bool
	// derive works a default out from the values before it, such as a key id
	// from its file name; it returns "" when it cannot.
	derive func(values map[string]string) string
}

func (f field) key() string { return strings.Join(f.path, ".") }

// credentialMode is a set of credentials that works on its own, such as
// Stripe's test mode: the field that turns it on, and the fields it then
// needs.
type credentialMode struct {
	key   string
	needs []string
}

// valueAt is the text at path of a configuration; empty when there is none.
func valueAt(configuration map[string]any, path []string) string {
	var current any = configuration
	for _, segment := range path {
		object, _ := current.(map[string]any)
		current = object[segment]
	}
	text, _ := current.(string)
	return text
}

// withValueAt is configuration with value at path; configuration itself
// is not changed.
func withValueAt(configuration map[string]any, path []string, value string) map[string]any {
	next := map[string]any{}
	for key, existing := range configuration {
		next[key] = existing
	}
	if len(path) == 1 {
		next[path[0]] = value
		return next
	}
	inner, _ := configuration[path[0]].(map[string]any)
	next[path[0]] = withValueAt(inner, path[1:], value)
	return next
}

// readKeyFile reads the key file a flag or an answer names.
func readKeyFile(app *cli.App, path, flag string) (string, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(app.Dir, path)
	}
	text, err := os.ReadFile(path)
	if err != nil {
		return "", cli.Usagef("Could not read %s, given to %s.", path, flag).
			WithHint("Pass the path of the key file you downloaded.")
	}
	return strings.TrimSpace(string(text)), nil
}

// resolveField is a field's value: the flag, else what the person types on
// a terminal (a saved credential is kept by pressing Enter), else what is
// saved, derived or defaulted. ok is false when there is no value, as for a
// required one missing off a terminal.
func resolveField(ctx context.Context, app *cli.App, f field, saved string, values map[string]string) (value string, ok bool, err error) {
	if f.given != nil {
		if f.kind == fileField {
			value, err = readKeyFile(app, *f.given, f.flag)
			return value, err == nil, err
		}
		return *f.given, true, nil
	}
	derived := ""
	if f.derive != nil {
		derived = f.derive(values)
	}
	isStored := saved == storedSecret
	known, isKnown := saved, saved != ""
	if !isKnown && derived != "" {
		known, isKnown = derived, true
	}
	if !isKnown && f.fallback != nil {
		known, isKnown = *f.fallback, true
	}
	if !app.IsInteractive() {
		return known, isKnown, nil
	}
	switch f.kind {
	case secretField:
		message := f.message
		switch {
		case isStored:
			message += " (Enter keeps the saved one)"
		case f.optional:
			message += " (Enter skips)"
		}
		for {
			typed, err := app.AskSecret(ctx, message)
			switch {
			case err != nil:
				return "", false, err
			case typed != "":
				return typed, true, nil
			case isStored:
				return storedSecret, true, nil
			case f.optional:
				return "", false, nil
			}
			fmt.Fprintln(app.Stderr, "Type a value.")
		}
	case fileField:
		message := f.message
		if isStored {
			message += " (Enter keeps the saved key)"
		}
		for {
			typed, err := app.Prompter().Text(ctx, message, prompt.TextOptions{
				Validate: func(answer string) (string, error) {
					if answer == "" && !isStored {
						return "", errors.New("Type a value.")
					}
					return answer, nil
				},
			})
			if err != nil {
				return "", false, err
			}
			if typed == "" {
				return storedSecret, true, nil
			}
			value, err := readKeyFile(app, typed, f.flag)
			if err == nil {
				return value, true, nil
			}
			// A mistyped path is asked for again rather than ending the run.
			fmt.Fprintln(app.Stderr, cli.Printable(err.Error()))
		}
	}
	initial := ""
	if isKnown {
		initial = cli.Printable(known)
	}
	typed, err := app.Prompter().Text(ctx, f.message, prompt.TextOptions{
		Default: initial,
		Validate: func(answer string) (string, error) {
			if answer == "" && f.fallback == nil {
				return "", errors.New("Type a value.")
			}
			return answer, nil
		},
	})
	if err != nil {
		return "", false, err
	}
	if typed == "" {
		return *f.fallback, true, nil
	}
	return typed, true, nil
}

var keyFileName = regexp.MustCompile(`(?:AuthKey|SubscriptionKey|ApiKey)_([A-Z0-9]+)\.p8$`)

// keyIDFromFileName is the key id in an App Store Connect key file name:
// `AuthKey_ABC123DEF4.p8` is `ABC123DEF4`. nil when the name has none.
func keyIDFromFileName(path *string) *string {
	if path == nil {
		return nil
	}
	if match := keyFileName.FindStringSubmatch(*path); match != nil {
		return &match[1]
	}
	return nil
}

func flagNames(fields []field) []string {
	var names []string
	for _, f := range fields {
		if !contains(names, f.flag) {
			names = append(names, f.flag)
		}
	}
	return names
}

// storeConnection is what `provider connect <store>` saves.
type storeConnection struct {
	providerType string
	project      string
	fields       []field
	defaults     map[string]any
	usage        string
	// modes are credential sets of which at least one is needed, such as
	// Stripe's live and test mode; the fields a mode then needs may come in a
	// later run: the settings are saved without enabling the provider.
	modes []credentialMode
	mode  cli.OutputMode
}

// connectStore saves the fields into the project's provider of the type and
// enables it. The provider is added first when the project has none, so the
// notification address that names it can be shown before the values that
// need it.
func connectStore(ctx context.Context, app *cli.App, connection storeConnection) error {
	target, err := app.ResolveProject(ctx, connection.project)
	if err != nil {
		return err
	}
	projectID := target.Project.Id
	providerType := api.PaymentProviderType(connection.providerType)
	providers, err := cli.ListAll[provider](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaymentProvidersList(ctx, projectID, &api.PaymentProvidersListParams{Cursor: page.Cursor, Limit: page.Limit, Type: &providerType})
	})
	if err != nil {
		return err
	}
	savedConfiguration := map[string]any{}
	for key, value := range connection.defaults {
		savedConfiguration[key] = value
	}
	if len(providers.Items) > 0 {
		for key, value := range providers.Items[0].Configuration {
			savedConfiguration[key] = value
		}
	}
	fieldAt := func(key string) *field {
		for index := range connection.fields {
			if connection.fields[index].key() == key {
				return &connection.fields[index]
			}
		}
		return nil
	}
	var modeFields []field
	for _, mode := range connection.modes {
		if f := fieldAt(mode.key); f != nil {
			modeFields = append(modeFields, *f)
		}
	}
	noMode := cli.Usagef("Missing %s.", strings.Join(flagNames(modeFields), " or ")).
		WithHint("Give the credentials of at least one mode: " + connection.usage)

	// Off a terminal, find what is missing before changing anything.
	if !app.IsInteractive() {
		var missing []field
		for _, f := range connection.fields {
			derivable := f.derive != nil && f.derive(map[string]string{}) != ""
			if f.given == nil && valueAt(savedConfiguration, f.path) == "" && f.fallback == nil && !f.optional && !derivable {
				missing = append(missing, f)
			}
		}
		if len(missing) > 0 {
			return cli.Usagef("Missing %s.", strings.Join(flagNames(missing), ", ")).
				WithHint("There is no terminal to ask in; run it as: " + connection.usage)
		}
		hasMode := len(connection.modes) == 0
		for _, f := range modeFields {
			hasMode = hasMode || f.given != nil || valueAt(savedConfiguration, f.path) != ""
		}
		if !hasMode {
			return noMode
		}
		// Read the key files too, so a wrong path adds no provider.
		for _, f := range connection.fields {
			if f.given != nil && f.kind == fileField {
				if _, err := readKeyFile(app, *f.given, f.flag); err != nil {
					return err
				}
			}
		}
	}

	var found provider
	if len(providers.Items) > 0 {
		found = providers.Items[0]
	} else {
		created, err := cli.Fetch[provider](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProvidersCreateWithBody(ctx, projectID, catalog.JSON, catalog.Body(map[string]any{"type": connection.providerType}))
		})
		if err != nil {
			return err
		}
		found = created.Value
	}
	settings, err := app.Config()
	if err != nil {
		return err
	}
	notifications, hasNotifications := notificationTarget(settings.APIURL, found)
	if app.IsInteractive() && connection.mode == cli.Human {
		if hasNotifications {
			app.Notef("Connecting %s. Set %s as %s.", catalog.StoreLabel(found), notifications.url, notifications.where)
		} else {
			app.Notef("Connecting %s.", catalog.StoreLabel(found))
		}
	}

	configuration, values := savedConfiguration, map[string]string{}
	// unused reports whether a field belongs only to credential modes that
	// are not being connected, so a terminal does not ask for it.
	unused := func(f field) bool {
		needed, used := false, false
		for _, mode := range connection.modes {
			if contains(mode.needs, f.key()) {
				needed = true
				used = used || valueAt(configuration, strings.Split(mode.key, ".")) != ""
			}
		}
		return needed && !used && f.given == nil
	}
	var deferred []field
	for _, f := range connection.fields {
		if unused(f) {
			continue
		}
		value, ok, err := resolveField(ctx, app, f, valueAt(savedConfiguration, f.path), values)
		if err != nil {
			return err
		}
		switch {
		case ok:
			configuration = withValueAt(configuration, f.path, value)
			values[f.key()] = value
		case !f.optional:
			deferred = append(deferred, f)
		}
	}
	isActive := len(connection.modes) == 0
	for _, mode := range connection.modes {
		if valueAt(configuration, strings.Split(mode.key, ".")) == "" {
			continue
		}
		isActive = true
		for _, needed := range mode.needs {
			if f := fieldAt(needed); f != nil && valueAt(configuration, f.path) == "" {
				deferred = append(deferred, *f)
			}
		}
	}
	if !isActive {
		return noMode
	}
	saved, err := cli.Fetch[provider](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaymentProvidersUpdateWithBody(ctx, projectID, found.Id, catalog.JSON, catalog.Body(map[string]any{
			"configuration": configuration, "isEnabled": len(deferred) == 0,
		}))
	})
	if err != nil {
		return cli.APIError(err, map[string]string{
			"invalid_payment_provider_configuration": fmt.Sprintf("Nothing was enabled. Fix that value, then run '%s' again; '--help' says what each flag is.", connection.usage),
			"payment_provider_key_taken":             "Another provider of this project is set up for this app or account: 'voidhash provider list' shows it.",
		})
	}

	label, handle := catalog.ProviderLabel(saved.Value), catalog.ProviderHandle(saved.Value)
	var lines []string
	if len(deferred) > 0 {
		flags := flagNames(deferred)
		lines = append(lines, fmt.Sprintf("Saved %s, but it is not enabled yet: it needs %s.", label, strings.Join(flags, ", ")))
		if hasNotifications {
			lines = append(lines, fmt.Sprintf("  Set %s as %s.", notifications.url, notifications.where))
		}
		lines = append(lines, fmt.Sprintf("  Then run 'voidhash provider connect %s %s <value>'.", handle, strings.Join(flags, " <value> ")))
	} else {
		lines = append(lines, fmt.Sprintf("Connected %s; Voidhash checked its credentials.", label), "Next:")
		if hasNotifications {
			lines = append(lines, fmt.Sprintf("  Set %s as %s.", notifications.url, notifications.where))
		}
		lines = append(lines, fmt.Sprintf(
			"  Map its store products to products: 'voidhash provider products %s --unmapped', then 'voidhash provider map <store-product> <product>'.", handle))
		if saved.Value.Type == "stripe" {
			lines = append(lines, "  Import its earlier purchases: 'voidhash provider import stripe'.")
		}
	}
	return app.PrintItem(connection.mode, saved, strings.Join(lines, "\n"))
}

// optionalFlag adds a text flag whose value is nil until it is passed, so
// passing it empty clears a saved value.
func optionalFlag(cmd *cobra.Command, name, usage string) func() *string {
	value := cmd.Flags().String(name, "", usage)
	return func() *string {
		if !cli.Changed(cmd, name) {
			return nil
		}
		return value
	}
}

const forwardingUsage = "Also forward the store's notifications to this HTTPS `url`, such as your own server"

func newConnect(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "connect",
		Short: "Connect a store with its credentials, or add a payment source.",
		Long:  "Connect the App Store, Google Play or Stripe with its credentials, or add a payment source. Run it again to change a store's settings: values not given keep what is saved.",
	}
	cmd.AddCommand(newConnectAppStore(app), newConnectGooglePlay(app), newConnectStripe(app), newConnectPaymentSource(app))
	return cmd
}

const appStoreUsage = "voidhash provider connect app-store --bundle-id <id> --apple-id <number> --issuer-id <id> --iap-key <SubscriptionKey_....p8> --api-key <AuthKey_....p8> --vendor-number <number>"

func newConnectAppStore(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "app-store",
		Short: "Connect the App Store with the app's ids and keys.",
		Long: `Connect the App Store: the app's ids and its In-App Purchase and App Store Connect API keys, read from their .p8 files. Asks for what is missing in a terminal; run it again to change them.

The keys are read from the files and sent to Voidhash, which stores them encrypted; they are never printed.`,
		Example: `voidhash provider connect app-store
voidhash provider connect app-store --bundle-id com.acme.app --apple-id 1234567890 --issuer-id 57246542-96fe-1a63-e053-0824d011072a --iap-key SubscriptionKey_ABC123DEF4.p8 --api-key AuthKey_XYZ987WVU6.p8 --vendor-number 87654321`,
	}
	bundleID := optionalFlag(cmd, "bundle-id", "The app's bundle `id`, such as com.acme.app")
	appleID := optionalFlag(cmd, "apple-id", "The app's Apple ID: the `number` in its App Store Connect address")
	issuerID := optionalFlag(cmd, "issuer-id", "The issuer `id` of your App Store Connect keys (Users and Access, Integrations)")
	iapKey := optionalFlag(cmd, "iap-key", "The In-App Purchase key `file` (SubscriptionKey_....p8)")
	iapKeyID := optionalFlag(cmd, "iap-key-id", "Its key `id` (default: from the file name)")
	apiKey := optionalFlag(cmd, "api-key", "The App Store Connect API key `file` (AuthKey_....p8)")
	apiKeyID := optionalFlag(cmd, "api-key-id", "Its key `id` (default: from the file name)")
	vendorNumber := optionalFlag(cmd, "vendor-number", "Your vendor `number`, from Payments and Financial Reports")
	forward := optionalFlag(cmd, "forward-notifications-to", forwardingUsage)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		orFileName := func(id, file *string) *string {
			if id != nil {
				return id
			}
			return keyIDFromFileName(file)
		}
		none := ""
		return connectStore(cmd.Context(), app, storeConnection{
			providerType: "app_store",
			project:      *project,
			fields: []field{
				{path: []string{"bundleId"}, flag: "--bundle-id", given: bundleID(), message: "Bundle id"},
				{path: []string{"appAppleId"}, flag: "--apple-id", given: appleID(), message: "Apple ID of the app (a number)"},
				{path: []string{"inAppPurchaseKeyIssuerId"}, flag: "--issuer-id", given: issuerID(), message: "Issuer id of your App Store Connect keys"},
				{path: []string{"inAppPurchasePrivateKey"}, flag: "--iap-key", given: iapKey(), kind: fileField,
					message: "Path of the In-App Purchase key file (SubscriptionKey_....p8)"},
				{path: []string{"inAppPurchaseKeyId"}, flag: "--iap-key-id", given: orFileName(iapKeyID(), iapKey()), message: "Its key id"},
				{path: []string{"appStoreConnectApiIssuerId"}, flag: "--issuer-id", given: issuerID(), message: "Issuer id of the App Store Connect API key",
					derive: func(values map[string]string) string { return values["inAppPurchaseKeyIssuerId"] }},
				{path: []string{"appStoreConnectApiPrivateKey"}, flag: "--api-key", given: apiKey(), kind: fileField,
					message: "Path of the App Store Connect API key file (AuthKey_....p8)"},
				{path: []string{"appStoreConnectApiKeyId"}, flag: "--api-key-id", given: orFileName(apiKeyID(), apiKey()), message: "Its key id"},
				{path: []string{"appStoreConnectApiVendorNumber"}, flag: "--vendor-number", given: vendorNumber(), message: "Vendor number"},
				{path: []string{"appleServerNotificationForwardingUrl"}, flag: "--forward-notifications-to", given: forward(),
					message: "Forward Apple's notifications to (optional)", fallback: &none},
			},
			defaults: map[string]any{
				"appleServerNotificationForwardingUrl":          "",
				"appleSmallBusinessProgramHasEndDate":           false,
				"trackNewPurchasesFromAppleServerNotifications": true,
			},
			usage: appStoreUsage,
			mode:  mode,
		})
	}
	return cmd
}

const googlePlayUsage = "voidhash provider connect google-play --package-name <name> --service-account-key <file.json>"

func newConnectGooglePlay(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "google-play",
		Short: "Connect Google Play with the app's package name and a service account key.",
		Long: `Connect Google Play: the app's package name and a service account key, read from its JSON file. Asks for what is missing in a terminal; run it again to change them.

The key is read from the file and sent to Voidhash, which stores it encrypted; it is never printed.`,
		Example: `voidhash provider connect google-play
voidhash provider connect google-play --package-name com.acme.app --service-account-key service-account.json`,
	}
	packageName := optionalFlag(cmd, "package-name", "The app's package `name`, such as com.acme.app")
	serviceAccountKey := optionalFlag(cmd, "service-account-key", "The JSON key `file` of a Google Cloud service account with access to the app in Play Console")
	topic := optionalFlag(cmd, "notifications-topic", "The Pub/Sub `topic` of its real-time developer notifications, projects/<project>/topics/<topic>")
	forward := optionalFlag(cmd, "forward-notifications-to", forwardingUsage)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		none := ""
		return connectStore(cmd.Context(), app, storeConnection{
			providerType: "google_play",
			project:      *project,
			fields: []field{
				{path: []string{"packageName"}, flag: "--package-name", given: packageName(), message: "Package name"},
				{path: []string{"serviceAccountKey"}, flag: "--service-account-key", given: serviceAccountKey(), kind: fileField,
					message: "Path of the service account's JSON key file"},
				{path: []string{"googleRealTimeDeveloperNotificationTopicName"}, flag: "--notifications-topic", given: topic(),
					message: "Pub/Sub topic of its notifications (optional)", fallback: &none},
				{path: []string{"googleRealTimeDeveloperNotificationForwardingUrl"}, flag: "--forward-notifications-to", given: forward(),
					message: "Forward Google's notifications to (optional)", fallback: &none},
			},
			defaults: map[string]any{},
			usage:    googlePlayUsage,
			mode:     mode,
		})
	}
	return cmd
}

const stripeUsage = "voidhash provider connect stripe --account-id <acct_...> [--live-secret-key <sk_live_...> --live-webhook-secret <whsec_...>] [--test-secret-key <sk_test_...> --test-webhook-secret <whsec_...>]"

func newConnectStripe(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stripe",
		Short: "Connect Stripe with your account id, API keys and webhook secrets.",
		Long: `Connect Stripe: your account id, and for live mode, test mode or both the API key and the signing secret of the webhook endpoint that points at Voidhash. Test mode alone suits a staging setup; its purchases never unlock production.

Without the webhook secrets it saves the rest and prints the address to point them at. In a terminal the keys are typed without echo, which keeps them out of your shell history; they are never printed.`,
		Example: `voidhash provider connect stripe
voidhash provider connect stripe --account-id acct_123 --test-secret-key sk_test_... --test-webhook-secret whsec_...`,
	}
	accountID := optionalFlag(cmd, "account-id", "Your Stripe account `id`, acct_...")
	liveSecretKey := optionalFlag(cmd, "live-secret-key", "A live secret or restricted `key`, sk_live_... or rk_live_...; leave out to connect test mode only")
	testSecretKey := optionalFlag(cmd, "test-secret-key", "A test secret or restricted `key`, sk_test_... or rk_test_...; leave out to connect live mode only")
	liveWebhookSecret := optionalFlag(cmd, "live-webhook-secret", "The signing `secret` of the live webhook endpoint pointing at Voidhash, whsec_...")
	testWebhookSecret := optionalFlag(cmd, "test-webhook-secret", "The signing `secret` of the test webhook endpoint pointing at Voidhash, whsec_...")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		return connectStore(cmd.Context(), app, storeConnection{
			providerType: "stripe",
			project:      *project,
			fields: []field{
				{path: []string{"accountId"}, flag: "--account-id", given: accountID(), message: "Stripe account id (acct_...)"},
				{path: []string{"live", "secretKey"}, flag: "--live-secret-key", given: liveSecretKey(), kind: secretField, optional: true,
					message: "Live secret key (sk_live_... or rk_live_...)"},
				{path: []string{"test", "secretKey"}, flag: "--test-secret-key", given: testSecretKey(), kind: secretField, optional: true,
					message: "Test secret key (sk_test_... or rk_test_...)"},
				{path: []string{"live", "webhookSecret"}, flag: "--live-webhook-secret", given: liveWebhookSecret(), kind: secretField, optional: true,
					message: "Live webhook signing secret (whsec_...)"},
				{path: []string{"test", "webhookSecret"}, flag: "--test-webhook-secret", given: testWebhookSecret(), kind: secretField, optional: true,
					message: "Test webhook signing secret (whsec_...)"},
			},
			defaults: map[string]any{},
			usage:    stripeUsage,
			// Live mode, test mode or both. The webhook endpoints point at an
			// address that names the provider, so their secrets can come in a
			// second run.
			modes: []credentialMode{
				{key: "live.secretKey", needs: []string{"live.webhookSecret"}},
				{key: "test.secretKey", needs: []string{"test.webhookSecret"}},
			},
			mode: mode,
		})
	}
	return cmd
}

const paymentSourceUsage = "voidhash provider connect payment-source --name <name> [--slug <slug>] [--endpoint <url>] [--test-endpoint <url>]"

func newConnectPaymentSource(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "payment-source",
		Short: "Add a payment source: payments taken outside the stores.",
		Long: `Add a payment source: payments taken outside the stores, such as another payment provider, bank transfers or vouchers, reported by your backend.

Each endpoint gets a signing secret, shown once: with --json or --quiet it goes to standard error.`,
		Example: `voidhash provider connect payment-source --name "Bank transfer"
voidhash provider connect payment-source --name Paddle --endpoint https://pay.example.com/voidhash`,
	}
	name := cmd.Flags().String("name", "", "What people see, such as Paddle or Bank transfer")
	slug := cmd.Flags().String("slug", "", "How webhooks, analytics and the API name it (default: made from the name); it cannot change")
	endpoint := cmd.Flags().String("endpoint", "", "The HTTPS endpoint `url` of its server's Voidhash provider handler, for product lists, history imports, refunds and cancellations")
	testEndpoint := cmd.Flags().String("test-endpoint", "", "Another endpoint `url` for test requests only, such as a staging server's; without it test requests go to --endpoint")
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
		sourceName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name, as people see it", Usage: paymentSourceUsage})
		if err != nil {
			return err
		}
		sourceSlug := *slug
		if sourceSlug == "" {
			sourceSlug = catalog.SlugFrom(sourceName)
			if app.IsInteractive() {
				sourceSlug, err = app.RequireText(ctx, "", cli.TextPrompt{
					What: "--slug", Message: "Slug, which cannot change", Usage: paymentSourceUsage, Initial: sourceSlug,
				})
				if err != nil {
					return err
				}
			}
		}
		// Each endpoint has its own signing secret.
		configuration := map[string]any{"slug": sourceSlug}
		signingSecret, testSigningSecret := "", ""
		if *endpoint != "" {
			signingSecret = newSigningSecret()
			configuration["endpoint"] = map[string]any{"url": *endpoint, "signingSecret": signingSecret}
		}
		if *testEndpoint != "" {
			testSigningSecret = newSigningSecret()
			configuration["testEndpoint"] = map[string]any{"url": *testEndpoint, "signingSecret": testSigningSecret}
		}
		created, err := cli.Fetch[provider](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProvidersCreateWithBody(ctx, projectID, catalog.JSON, catalog.Body(map[string]any{
				"type": "payment_source", "name": sourceName, "configuration": configuration,
			}))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"payment_provider_exists": fmt.Sprintf("This project already has a payment source %[1]s: 'voidhash provider view %[1]s' shows it.", sourceSlug),
			})
		}
		base := fmt.Sprintf("/api/v1/projects/%s/payment-providers/%s", projectID, created.Value.Id)
		lines := []string{
			fmt.Sprintf("Created payment source %s.", catalog.ProviderLabel(created.Value)),
			fmt.Sprintf("Its backend reports payments to PUT %[1]s/transactions/{id} and subscriptions to PUT %[1]s/subscriptions/{id}, with a secret key that may write purchases.", base),
		}
		var secrets []string
		if signingSecret != "" {
			secrets = append(secrets, "Signing secret, shown once: "+signingSecret)
			lines = append(lines, "Signing secret for its endpoint, shown once: "+signingSecret, fmt.Sprintf(
				"Give it to the source's server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash provider test %s'.", sourceSlug))
		} else if testSigningSecret == "" {
			lines = append(lines, fmt.Sprintf("Connect its server's endpoint later with 'voidhash provider edit %s --endpoint <url>'.", sourceSlug))
		}
		if testSigningSecret != "" {
			secrets = append(secrets, "Test endpoint signing secret, shown once: "+testSigningSecret)
			lines = append(lines, "Signing secret for its test endpoint, shown once: "+testSigningSecret, fmt.Sprintf(
				"Give it to the source's test (staging) server (for example as VOIDHASH_PROVIDER_SECRET), then run 'voidhash provider test %s'.", sourceSlug))
		}
		lines = append(lines, fmt.Sprintf("Next: map its product keys with 'voidhash provider map <product-key> <product> --provider %s'.", sourceSlug))
		if err := app.PrintItem(mode, created, strings.Join(lines, "\n")); err != nil {
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
