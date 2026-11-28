package provider

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// The payments of a payment source a person handles by hand: recording one
// that arrived outside its backend (a bank transfer), refunding a charge
// and canceling a subscription at the source. The source's own backend
// reports everything else through the API, so recording subscription states
// has no command ('voidhash api' reaches it for a one-off correction).

var sourceArg = cli.Arg{Name: "source", Help: "The payment source: its slug, name or id", Optional: true}

// sourceHints are the hints for the codes every payment source call can
// fail with.
func sourceHints(handle string, more map[string]string) map[string]string {
	hints := map[string]string{
		"payment_source_disabled":                fmt.Sprintf("Enable it first: 'voidhash provider edit %s --enable'.", handle),
		"payment_source_endpoint_not_configured": fmt.Sprintf("Connect its endpoint first: 'voidhash provider edit %s --endpoint <url>'.", handle),
		"payment_source_endpoint_unsupported":    fmt.Sprintf("Its server does not implement this; 'voidhash provider test %s' lists what it does.", handle),
	}
	for code, hint := range more {
		hints[code] = hint
	}
	return hints
}

// requireSource is the payment source a command names; a store it names is
// a usage error.
func requireSource(ctx context.Context, app *cli.App, projectID, input, usage string) (provider, error) {
	providers, err := catalog.ListProviders(ctx, app, projectID)
	if err != nil {
		return provider{}, err
	}
	var found provider
	if input != "" {
		found, err = cli.FindItem(catalog.ProviderKind, providers.Items, input)
	} else {
		sourceKind := catalog.ProviderKind
		sourceKind.Noun, sourceKind.CreateCommand = "payment source", "voidhash provider connect payment-source"
		found, err = cli.RequireItem(ctx, app, sourceKind, providers.Filter(catalog.IsSource).Items, "", usage)
	}
	if err != nil {
		return provider{}, err
	}
	if !catalog.IsSource(found) {
		return provider{}, cli.Usagef("%s is a store, not a payment source.", catalog.ProviderLabel(found)).
			WithHint("Its purchases come from the store; refunds and cancellations happen there.")
	}
	return found, nil
}

// Currencies whose minor unit is not a hundredth (ISO 4217).
var minorUnitExponents = map[string]int{
	"BIF": 0, "CLP": 0, "DJF": 0, "GNF": 0, "ISK": 0, "JPY": 0, "KMF": 0, "KRW": 0, "PYG": 0,
	"RWF": 0, "UGX": 0, "UYI": 0, "VND": 0, "VUV": 0, "XAF": 0, "XOF": 0, "XPF": 0,
	"BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3,
	"CLF": 4, "UYW": 4,
}

var amountPattern = regexp.MustCompile(`^(\d+)(?:[.,](\d*))?$`)

// toMinorUnits is an amount typed in major units (`49.00`, `49,5`) in the
// currency's minor units.
func toMinorUnits(amount, currency string) (int64, error) {
	exponent, known := minorUnitExponents[currency]
	if !known {
		exponent = 2
	}
	invalid := cli.Usagef("%s is not an amount of %s.", amount, currency).
		WithHint(fmt.Sprintf("Write it as people do, such as 49.00 (at most %d decimals).", exponent))
	match := amountPattern.FindStringSubmatch(strings.TrimSpace(amount))
	if match == nil || len(match[2]) > exponent {
		return 0, invalid
	}
	minor, err := strconv.ParseInt(match[1]+match[2]+strings.Repeat("0", exponent-len(match[2])), 10, 64)
	// The API takes amounts as JSON numbers, exact up to 2^53.
	if err != nil || minor > int64(math.Pow(2, 53))-1 {
		return 0, invalid
	}
	return minor, nil
}

func describeOutcome(transaction api.PaymentSourceTransaction) string {
	switch {
	case transaction.Status == "applied" && transaction.PurchaseId != nil:
		return "applied to purchase " + *transaction.PurchaseId
	case transaction.Status == "applied":
		return "applied"
	case transaction.PendingReason != nil && *transaction.PendingReason == "product_not_mapped":
		return "waiting until its product key is mapped ('voidhash provider map')"
	}
	return "waiting until the charge it refunds is recorded"
}

var timeLayouts = []string{time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02T15:04", "2006-01-02"}

// parseTime reads a date and time as ISO 8601; one without a zone is UTC.
func parseTime(text string) (time.Time, bool) {
	for _, layout := range timeLayouts {
		if parsed, err := time.Parse(layout, strings.TrimSpace(text)); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

const isoMillis = "2006-01-02T15:04:05.000Z"

const recordUsage = "voidhash provider record-payment <source> --amount <49.00> --currency <EUR> --product <key> --distinct-id <id>"

const currencyUsage = "ISO 4217 `code`, such as EUR"

func newRecordPayment(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "record-payment",
		Short: "Record a payment a payment source took by hand, or a refund of one.",
		Long: `Record a payment a payment source took by hand, such as a bank transfer that arrived, or with --refunds a refund of one, which asks first.

An id is recorded once: running it again with the same --id changes nothing. Correct a payment with a refund.`,
		Example: `voidhash provider record-payment bank-transfer --amount 49.00 --currency EUR --product pro-annual --distinct-id user-42
voidhash provider record-payment bank-transfer --amount 49.00 --currency EUR --refunds manual-1234 --yes`,
	}
	cli.SetArgs(cmd, sourceArg)
	amountText := cmd.Flags().String("amount", "", "The amount, tax included, as people write it: 49.00")
	currencyCode := cmd.Flags().String("currency", "", currencyUsage)
	productKey := cmd.Flags().String("product", "", "The source's product `key` it pays for")
	distinctID := cmd.Flags().String("distinct-id", "", "The buyer's distinct `id` in your app")
	customer := cmd.Flags().String("customer", "", "The source's `id` for the buyer, when there is no distinct id")
	refunds := cmd.Flags().String("refunds", "", "Record a refund of this charge `id` instead of a charge")
	id := cmd.Flags().String("id", "", "The transaction's id at the source (default: a new manual-... id)")
	at := cmd.Flags().String("at", "", "When it happened, as an ISO 8601 `time` (default: now)")
	isTest := cmd.Flags().Bool("test", false, "A test payment, such as a staging server's; it stays out of production revenue")
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
		source, err := requireSource(ctx, app, projectID, cli.ArgAt(args, 0), recordUsage)
		if err != nil {
			return err
		}
		if *amountText == "" {
			return cli.MissingInput("--amount", recordUsage)
		}
		if *currencyCode == "" {
			return cli.MissingInput("--currency", recordUsage)
		}
		currency := strings.ToUpper(strings.TrimSpace(*currencyCode))
		amount, err := toMinorUnits(*amountText, currency)
		if err != nil {
			return err
		}
		isRefund := *refunds != ""
		if !isRefund && *productKey == "" {
			return cli.MissingInput("--product", recordUsage)
		}
		if !isRefund && *distinctID == "" && *customer == "" {
			return cli.MissingInput("--distinct-id or --customer", recordUsage)
		}
		occurredAt := app.Now()
		if *at != "" {
			parsed, ok := parseTime(*at)
			if !ok {
				return cli.Usagef("--at %s is not a date and time.", *at).WithHint("Write it as ISO 8601, such as 2026-10-28T14:00:00Z.")
			}
			occurredAt = parsed
		}
		externalID := *id
		if externalID == "" {
			externalID = "manual-" + app.NewID()
		}
		money, label := cli.FormatMoney(amount, currency), catalog.ProviderLabel(source)
		if isRefund {
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
				"Record a refund of %s for charge %s at %s in %s? A refund of all that is left ends the buyer's access.",
				money, *refunds, label, target.Label())); err != nil {
				return err
			}
		}
		body := map[string]any{
			"type": "charge", "amount": amount, "currency": currency,
			"occurredAt": occurredAt.UTC().Format(isoMillis), "environment": "production",
		}
		if isRefund {
			body["type"], body["refundsTransactionId"] = "refund", *refunds
		}
		if *isTest {
			body["environment"] = "test"
		}
		if *productKey != "" {
			body["productKey"] = *productKey
		}
		if *distinctID != "" {
			body["distinctId"] = *distinctID
		}
		if *customer != "" {
			body["customer"] = map[string]any{"externalId": *customer}
		}
		recorded, err := cli.Fetch[api.PaymentSourceTransaction](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentSourcesUpsertTransactionWithBody(ctx, projectID, source.Id, externalID, catalog.JSON, catalog.Body(body))
		})
		if err != nil {
			return cli.APIError(err, sourceHints(catalog.ProviderHandle(source), map[string]string{
				"transaction_conflict": fmt.Sprintf("%[1]s was recorded with other details; correct it by recording a refund with --refunds %[1]s.", externalID),
			}))
		}
		what := "payment"
		if isRefund {
			what = "refund"
		}
		return app.PrintItem(mode, recorded, fmt.Sprintf("Recorded %s %s of %s at %s: %s.", what, externalID, money, label, describeOutcome(recorded.Value)))
	}
	return cmd
}

const refundUsage = "voidhash provider refund <source> --transaction <id>"

func newRefund(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "refund",
		Short: "Refund a charge at its payment source.",
		Long:  "Refund a charge at its payment source, which must implement refunds; Voidhash records the refund it answers with. Asks first; --yes skips that.",
		Example: `voidhash provider refund paddle --transaction txn_123
voidhash provider refund paddle --transaction txn_123 --amount 10.00 --currency EUR --reason "partial outage" --yes`,
	}
	cli.SetArgs(cmd, sourceArg)
	transaction := cmd.Flags().String("transaction", "", "The charge's `id` at the source")
	amountText := cmd.Flags().String("amount", "", "Refund only this much, such as 10.00, with --currency (default: all that is left)")
	currencyCode := cmd.Flags().String("currency", "", currencyUsage)
	reason := cmd.Flags().String("reason", "", "Why, passed to the source")
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
		source, err := requireSource(ctx, app, projectID, cli.ArgAt(args, 0), refundUsage)
		if err != nil {
			return err
		}
		if *transaction == "" {
			return cli.MissingInput("--transaction", refundUsage)
		}
		if *amountText != "" && *currencyCode == "" {
			return cli.Usagef("--amount needs --currency.")
		}
		label := catalog.ProviderLabel(source)
		body := map[string]any{}
		how, consequence := "everything left of", " and their access ends"
		if *amountText != "" {
			currency := strings.ToUpper(strings.TrimSpace(*currencyCode))
			amount, err := toMinorUnits(*amountText, currency)
			if err != nil {
				return err
			}
			body["amount"] = amount
			how, consequence = cli.FormatMoney(amount, currency)+" of", ""
		}
		if *reason != "" {
			body["reason"] = *reason
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Refund %s charge %s at %s in %s? The money goes back to the buyer%s.",
			how, *transaction, label, target.Label(), consequence)); err != nil {
			return err
		}
		refund, err := cli.Fetch[api.PaymentSourceTransaction](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentSourcesRefundTransactionWithBody(ctx, projectID, source.Id, *transaction, catalog.JSON, catalog.Body(body))
		})
		if err != nil {
			return cli.APIError(err, sourceHints(catalog.ProviderHandle(source), map[string]string{
				"transaction_not_found": fmt.Sprintf("%s has no recorded charge %s; check the id, the source's own.", label, *transaction),
			}))
		}
		return app.PrintItem(mode, refund, fmt.Sprintf("Refunded charge %s: refund %s %s.", *transaction, refund.Value.Id, describeOutcome(refund.Value)))
	}
	return cmd
}

const cancelUsage = "voidhash provider cancel-subscription <source> --subscription <id>"

func newCancelSubscription(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cancel-subscription",
		Short: "Cancel a subscription at its payment source.",
		Long:  "Cancel a subscription at its payment source, which must implement cancellations; Voidhash records the state it answers with. Asks first; --yes skips that.",
		Example: `voidhash provider cancel-subscription paddle --subscription sub_123
voidhash provider cancel-subscription paddle --subscription sub_123 --now --yes`,
	}
	cli.SetArgs(cmd, sourceArg)
	subscription := cmd.Flags().String("subscription", "", "The subscription's `id` at the source")
	now := cmd.Flags().Bool("now", false, "End access now instead of at the end of the paid period")
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
		source, err := requireSource(ctx, app, projectID, cli.ArgAt(args, 0), cancelUsage)
		if err != nil {
			return err
		}
		if *subscription == "" {
			return cli.MissingInput("--subscription", cancelUsage)
		}
		label := catalog.ProviderLabel(source)
		effect, outcome := "It stops renewing; access lasts to the end of the paid period.", "; access lasts to the end of the paid period"
		if *now {
			effect, outcome = "The subscriber loses access now.", "; access ended now"
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Cancel subscription %s at %s in %s? %s", *subscription, label, target.Label(), effect)); err != nil {
			return err
		}
		canceled, err := cli.Fetch[api.PaymentSourceSubscription](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentSourcesCancelSubscriptionWithBody(ctx, projectID, source.Id, *subscription, catalog.JSON,
				catalog.Body(map[string]any{"isImmediate": *now}))
		})
		if err != nil {
			return cli.APIError(err, sourceHints(catalog.ProviderHandle(source), nil))
		}
		return app.PrintItem(mode, canceled, fmt.Sprintf("Canceled subscription %s at %s%s.", *subscription, label, outcome))
	}
	return cmd
}
