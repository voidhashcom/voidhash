package analytics

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

type alert = api.AnalyticsAlertJsonEncoding

var alertKind = cli.ItemKind[alert]{
	Noun:          "alert",
	ID:            func(item alert) string { return item.Id },
	Label:         func(item alert) string { return item.Name },
	ListCommand:   "voidhash analytics alerts list",
	CreateCommand: "voidhash analytics alerts create",
	Names:         func(item alert) []string { return []string{item.Name} },
}

// What an alert watches, and what its threshold is.
var alertKinds = []cli.Choice[string]{
	{Title: "event_count: an event happened too many times", Value: "event_count"},
	{Title: "failure_share: too many attempts failed", Value: "failure_share"},
	{Title: "volume_drop: an event fell against earlier weeks", Value: "volume_drop"},
	{Title: "metric_threshold: a metric such as MRR is above or below a value", Value: "metric_threshold"},
	{Title: "metric_change: a metric such as revenue changed by a share", Value: "metric_change"},
}

// isMetricKind is whether a kind watches a built-in metric rather than an event.
func isMetricKind(kind string) bool { return kind == "metric_threshold" || kind == "metric_change" }

// The built-in metrics an alert can watch, as the metric query names them.
var alertMetrics = []cli.Choice[string]{
	{Title: "mrr: monthly recurring revenue, as it stands", Value: "mrr"},
	{Title: "revenue: what customers paid, refunds taken off", Value: "revenue"},
	{Title: "refunds: what went back to customers", Value: "refunds"},
	{Title: "new_mrr: MRR added by new subscribers", Value: "new_mrr"},
	{Title: "expansion_mrr: MRR added by upgrades", Value: "expansion_mrr"},
	{Title: "reactivation_mrr: MRR added by subscribers coming back", Value: "reactivation_mrr"},
	{Title: "contraction_mrr: MRR lost to downgrades", Value: "contraction_mrr"},
	{Title: "churned_mrr: MRR lost to subscribers leaving", Value: "churned_mrr"},
	{Title: "net_new_mrr: MRR gained less MRR lost", Value: "net_new_mrr"},
	{Title: "active_subscriptions: paid subscriptions, as they stand", Value: "active_subscriptions"},
	{Title: "new_subscriptions: paid subscriptions started", Value: "new_subscriptions"},
	{Title: "churned_subscriptions: subscriptions that ended", Value: "churned_subscriptions"},
	{Title: "paying_customers: people charged", Value: "paying_customers"},
	{Title: "active_trials: free trials, as they stand", Value: "active_trials"},
	{Title: "new_trials: free trials started", Value: "new_trials"},
	{Title: "trial_conversions: trials that became paid", Value: "trial_conversions"},
}

// The directions a metric alert fires in, by kind.
var alertDirections = map[string][]cli.Choice[string]{
	"metric_threshold": {
		{Title: "above: the metric is over the threshold", Value: "above"},
		{Title: "below: the metric is under the threshold", Value: "below"},
	},
	"metric_change": {
		{Title: "down: the metric fell by the share", Value: "down"},
		{Title: "up: the metric rose by the share", Value: "up"},
		{Title: "either: it moved by the share either way", Value: "either"},
	},
}

// The trailing windows an event rule can read, in hours, and a metric rule's.
var (
	alertWindows       = []int{1, 6, 24, 168}
	metricAlertWindows = []int{24, 168, 720}
)

// moneyMetrics are the metrics that measure money: their thresholds, values and
// baselines are minor units of the alert's currency on the wire.
var moneyMetrics = []string{"mrr", "revenue", "refunds", "new_mrr", "expansion_mrr", "reactivation_mrr", "contraction_mrr", "churned_mrr", "net_new_mrr"}

// balanceMetrics are read as they stand rather than over a window, so a
// threshold on one takes the 24-hour window alone.
var balanceMetrics = []string{"mrr", "active_subscriptions", "active_trials"}

// toMinorUnits is an amount typed in major units of currency (5000 for
// 5,000.00) as the whole minor units the API holds money in, or an error when
// it has more decimals than the currency's minor unit.
func toMinorUnits(amount float64, currency string) (int64, error) {
	decimals := cli.CurrencyDecimals(currency)
	minor := amount * math.Pow10(decimals)
	if math.Abs(minor-math.Round(minor)) > 1e-6 {
		if decimals == 0 {
			return 0, fmt.Errorf("%s has no smaller unit: type a whole number", currency)
		}
		return 0, fmt.Errorf("%s takes at most %d decimals", currency, decimals)
	}
	return int64(math.Round(minor)), nil
}

func windowLabel(hours int) string {
	switch hours {
	case 168:
		return "7 days"
	case 720:
		return "30 days"
	}
	return strconv.Itoa(hours) + " h"
}

// parseAlertFilter reads a --filter: a dimension, `=` or `!=`, and values separated by commas,
// such as `store=apple-app-store`, `country!=US,CA` or `trait:plan=pro`.
func parseAlertFilter(text string) (map[string]any, error) {
	op, separator := "in", "="
	if strings.Contains(text, "!=") {
		op, separator = "not_in", "!="
	}
	name, list, found := strings.Cut(text, separator)
	name = strings.TrimSpace(name)
	var values []string
	for _, value := range strings.Split(list, ",") {
		if value = strings.TrimSpace(value); value != "" {
			values = append(values, value)
		}
	}
	if !found || name == "" || len(values) == 0 {
		return nil, cli.Usagef("--filter %q is not dimension=values or dimension!=values, such as store=apple-app-store or country!=US.", text)
	}
	dimension := map[string]any{"kind": name}
	if kind, key, keyed := strings.Cut(name, ":"); keyed {
		dimension = map[string]any{"kind": kind, "key": key}
		if kind == "group" {
			dimension = map[string]any{"kind": kind, "groupType": key}
		}
	}
	return map[string]any{"dimension": dimension, "op": op, "values": values}, nil
}

// watchesLabel is what a rule watches: its event, or its metric and how many filters narrow it.
func watchesLabel(item alert) string {
	if item.EventName != nil {
		return *item.EventName
	}
	label := string(item.Metric.Kind)
	if item.Metric.Basis != nil {
		label += " (" + strings.ReplaceAll(string(*item.Metric.Basis), "_", " ") + ")"
	}
	// A metric rule always holds filters; none listed means its stored ones no longer read.
	if item.Filters == nil {
		return label + ", filters unreadable"
	}
	switch len(item.Filters) {
	case 0:
		return label
	case 1:
		return label + ", 1 filter"
	}
	return label + ", " + strconv.Itoa(len(item.Filters)) + " filters"
}

// stateLabel is what the state column says, naming why a rule that cannot
// judge stays silent.
func stateLabel(item alert) string {
	if !item.IsEnabled {
		return "off"
	}
	return strings.ReplaceAll(string(item.State), "_", " ")
}

// valueLabel is what the rule read at its latest check: a count, the share
// that failed or fell, or money, which the API gives in minor units.
func valueLabel(item alert) string {
	if item.Value == nil {
		return "-"
	}
	value := float64(*item.Value)
	if item.Currency != nil {
		return reports.FormatMoney(value, *item.Currency)
	}
	if item.Kind == "event_count" || isMetricKind(string(item.Kind)) {
		return reports.FormatCount(value)
	}
	return reports.FormatRate(&value)
}

// A project has at most 25 alerts, so the listing is short.
func listAlerts(cmd *cobra.Command, app *cli.App, projectID string) (cli.List[alert], error) {
	ctx := cmd.Context()
	return cli.ListAll[alert](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.AnalyticsAlertsList(ctx, projectID, &api.AnalyticsAlertsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// newAlerts creates `voidhash analytics alerts`.
func newAlerts(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "alerts",
		Short: "Rules that tell owners and admins when events or money look wrong.",
		Long:  "Rules that tell owners and admins when events or money look wrong: an error that happens too often, too many failed attempts, an event that stopped arriving, or a metric such as MRR, revenue or trials crossing a value or moving by a share. Each rule is checked every hour.",
	}
	cmd.AddCommand(newAlertsList(app), newAlertsCreate(app), newAlertsSetEnabled(app, true), newAlertsSetEnabled(app, false), newAlertsDelete(app))
	return cmd
}

func newAlertsList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the project's alerts and how each stood at its latest check.",
		Example: `voidhash analytics alerts list`,
	}
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(cmd.Context(), *project)
		if err != nil {
			return err
		}
		alerts, err := listAlerts(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(alerts)
		case cli.Quiet:
			app.PrintIDs(alerts)
			return nil
		}
		cli.PrintTable(app, []cli.Column[alert]{
			{Header: "NAME", Cell: func(item alert) string { return item.Name }},
			{Header: "KIND", Cell: func(item alert) string { return string(item.Kind) }},
			{Header: "WATCHES", Cell: watchesLabel},
			{Header: "WINDOW", Cell: func(item alert) string { return windowLabel(item.WindowHours) }},
			{Header: "STATE", Cell: stateLabel},
			{Header: "VALUE", Cell: valueLabel},
			{Header: "ID", Cell: func(item alert) string { return item.Id }},
		}, alerts.Items, "No alerts. 'voidhash analytics alerts create' adds one.")
		// Why a rule cannot be measured is too long for its column.
		for _, item := range alerts.Items {
			if item.IsEnabled && item.State == "cannot_measure" && item.Problem != nil {
				app.Println(cli.Printable(fmt.Sprintf("%s cannot be measured: %s", item.Name, *item.Problem)))
			}
		}
		return nil
	}
	return cmd
}

const createUsage = "voidhash analytics alerts create --name <name> --kind <kind> (--event <event> | --metric <metric> --direction <direction>) --window-hours <hours> --threshold <threshold>"

// reportingCurrency is the currency the organization of target reports money
// in, which a money threshold is typed in unless --currency names another:
// USD until one is chosen.
func reportingCurrency(cmd *cobra.Command, app *cli.App, target *cli.ProjectContext) (string, error) {
	ctx := cmd.Context()
	unknown := &cli.UserError{
		Message:  "The organization's reporting currency could not be read, so the threshold's currency is unknown.",
		Hint:     "Name it with --currency, such as --currency EUR.",
		ExitCode: cli.ExitUsage,
	}
	if target.Organization == nil {
		return "", unknown
	}
	settings, err := cli.Fetch[api.OrganizationSettingsJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.OrganizationsGetSettings(ctx, target.Organization.Id)
	})
	if err != nil {
		unknown.Cause = err
		return "", unknown
	}
	if settings.Value.ReportingCurrency == nil {
		return "USD", nil
	}
	return *settings.Value.ReportingCurrency, nil
}

func newAlertsCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Add a rule that tells owners and admins when events or money look wrong.",
		Long: `Add a rule that tells owners and admins when events or money look wrong. What it watches is its kind:

  event_count       The event happened --threshold times in the window,
                    to at least --min-people people.
  failure_share     More than --threshold (0 to 1) of the attempts in the
                    window failed. An attempt is --event, the failure, or
                    --success-event.
  volume_drop       The event fell by --threshold (0 to 1) against the same
                    window in the weeks before.
  metric_threshold  The --metric over the window is --direction above or
                    below --threshold: money as you write it (5000 for
                    5,000.00) in --currency, the organization's reporting
                    currency unless named, which the alert keeps; counts as
                    whole numbers. MRR and active subscriptions or trials are
                    read as they stand, with --window-hours 24.
  metric_change     The --metric moved by --threshold (0.1 for 10%),
                    --direction up, down or either, against the window
                    before; a day of a flow such as revenue against the
                    same day a week earlier.

A metric alert's window is 24, 168 or 720 hours, and --filter narrows it,
as dimension=values or dimension!=values: store=apple-app-store,
country!=US,CA, trait:plan=pro. It is first checked at the next quarter past
the hour. On a terminal, what is not passed is asked for.`,
		Example: `voidhash analytics alerts create --name "Checkout errors" --kind event_count --event checkout_error --window-hours 1 --threshold 20
voidhash analytics alerts create --name "Payments failing" --kind failure_share --event payment_failed --success-event payment_succeeded --window-hours 6 --threshold 0.3
voidhash analytics alerts create --name "Signups dropped" --kind volume_drop --event signup --window-hours 24 --threshold 0.5
voidhash analytics alerts create --name "App Store MRR falling" --kind metric_change --metric mrr --filter store=apple-app-store --direction down --window-hours 720 --threshold 0.1
voidhash analytics alerts create --name "Refunds abroad" --kind metric_threshold --metric refunds --filter country!=US --direction above --window-hours 168 --threshold 500`,
	}
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "What a person reads in the notice")
	kindValues := make([]string, len(alertKinds))
	for index, choice := range alertKinds {
		kindValues[index] = choice.Value
	}
	kind := cli.AddChoiceFlag(cmd, "kind", "", kindValues, "", "What it watches: too many of an event, too many failures among attempts, an event that fell against earlier weeks, a metric past a value, or a metric that moved")
	event := cmd.Flags().String("event", "", "The event to watch; for failure_share, the event of a failed attempt")
	successEvent := cmd.Flags().String("success-event", "", "For failure_share: the `event` of an attempt that worked")
	metricValues := make([]string, len(alertMetrics))
	for index, choice := range alertMetrics {
		metricValues[index] = choice.Value
	}
	metric := cli.AddChoiceFlag(cmd, "metric", "", metricValues, "", "For a metric alert: the built-in metric to watch")
	basis := cli.AddChoiceFlag(cmd, "basis", "", []string{"gross", "net_of_tax", "proceeds"}, "", "For a money metric: what its amounts count (default: the metric's own)")
	filters := cmd.Flags().StringArray("filter", nil, "For a metric alert: narrows it, as `dimension=values` or dimension!=values; repeat for more")
	direction := cli.AddChoiceFlag(cmd, "direction", "", []string{"above", "below", "up", "down", "either"}, "", "For a metric alert: above or below for metric_threshold, up, down or either for metric_change")
	currency := cmd.Flags().String("currency", "", "For a money metric: the ISO 4217 `code` its threshold is in, such as EUR (default: the organization's reporting currency)")
	windowHours := cmd.Flags().Int("window-hours", 0, "The trailing window each hourly check reads, in `hours`: 1, 6, 24 or 168 for an event, 24, 168 or 720 for a metric")
	threshold := cmd.Flags().Float64("threshold", 0, "For event_count, the count that fires it; for failure_share and volume_drop, a share from 0 to 1; for metric_threshold, the metric's value, money as written (5000 for 5,000.00); for metric_change, a share such as 0.1")
	minPeople := cmd.Flags().Int("min-people", 0, "For event_count: distinct `people` it must affect (default: 2). Use 1 when one person matters")
	asJSON := cmd.Flags().Bool("json", false, "Print the API object as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if cli.Changed(cmd, "min-people") && *minPeople < 1 {
			return cli.Usagef("--min-people must be at least 1.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		body := reports.Body{}
		if body["name"], err = app.RequireText(ctx, strings.TrimSpace(*name), cli.TextPrompt{What: "--name", Message: "Alert name, as the notice reads", Usage: createUsage}); err != nil {
			return err
		}
		var passedKind *string
		if *kind != "" {
			passedKind = kind
		}
		chosenKind, err := cli.RequireChoice(ctx, app, passedKind, cli.ChoicePrompt[string]{What: "--kind", Message: "What does it watch?", Usage: createUsage, Choices: alertKinds})
		if err != nil {
			return err
		}
		body["kind"] = chosenKind
		windowChoices := alertWindows
		// The currency a money threshold is typed in, once it is known to be one.
		moneyCurrency := ""
		if isMetricKind(chosenKind) {
			windowChoices = metricAlertWindows
			if *event != "" || *successEvent != "" || cli.Changed(cmd, "min-people") {
				return cli.Usagef("--event, --success-event and --min-people are for event alerts; a %s alert watches --metric.", chosenKind)
			}
			if cli.Changed(cmd, "window-hours") && !slices.Contains(windowChoices, *windowHours) {
				return cli.Usagef("--window-hours of a metric alert must be 24, 168 or 720.")
			}
			directions := alertDirections[chosenKind]
			if *direction != "" && !slices.ContainsFunc(directions, func(choice cli.Choice[string]) bool { return choice.Value == *direction }) {
				if chosenKind == "metric_threshold" {
					return cli.Usagef("--direction of a metric_threshold alert is above or below.")
				}
				return cli.Usagef("--direction of a metric_change alert is up, down or either.")
			}
			parsed := make([]map[string]any, 0, len(*filters))
			for _, text := range *filters {
				filter, err := parseAlertFilter(text)
				if err != nil {
					return err
				}
				parsed = append(parsed, filter)
			}
			var passedMetric *string
			if *metric != "" {
				passedMetric = metric
			}
			chosenMetric, err := cli.RequireChoice(ctx, app, passedMetric, cli.ChoicePrompt[string]{What: "--metric", Message: "Which metric does it watch?", Usage: createUsage, Choices: alertMetrics})
			if err != nil {
				return err
			}
			isMoney := slices.Contains(moneyMetrics, chosenMetric)
			if *currency != "" && !isMoney {
				return cli.Usagef("--currency is for money metrics; %s counts.", chosenMetric)
			}
			if chosenKind == "metric_threshold" && slices.Contains(balanceMetrics, chosenMetric) {
				// A balance is read as it stands at each check, so its threshold takes one window.
				if cli.Changed(cmd, "window-hours") && *windowHours != 24 {
					return cli.Usagef("%s is read as it stands at each check, so a metric_threshold alert on it takes --window-hours 24.", chosenMetric)
				}
				windowChoices = []int{24}
			}
			if isMoney {
				if *currency != "" {
					body["currency"] = strings.ToUpper(*currency)
				}
				if chosenKind == "metric_threshold" {
					moneyCurrency = strings.ToUpper(*currency)
					if moneyCurrency == "" {
						if moneyCurrency, err = reportingCurrency(cmd, app, target); err != nil {
							return err
						}
					}
					// The threshold is converted with this currency, so the alert must hold it.
					body["currency"] = moneyCurrency
				}
			}
			watched := map[string]any{"kind": chosenMetric}
			if *basis != "" {
				watched["basis"] = *basis
			}
			body["metric"] = watched
			if len(parsed) > 0 {
				body["filters"] = parsed
			}
			var passedDirection *string
			if *direction != "" {
				passedDirection = direction
			}
			if body["direction"], err = cli.RequireChoice(ctx, app, passedDirection, cli.ChoicePrompt[string]{What: "--direction", Message: "Which way does it fire?", Usage: createUsage, Choices: directions}); err != nil {
				return err
			}
		} else {
			if *metric != "" || *basis != "" || len(*filters) > 0 || *direction != "" || *currency != "" {
				return cli.Usagef("--metric, --basis, --filter, --direction and --currency are for metric_threshold and metric_change alerts.")
			}
			if cli.Changed(cmd, "window-hours") && !slices.Contains(windowChoices, *windowHours) {
				return cli.Usagef("--window-hours must be 1, 6, 24 or 168.")
			}
			eventQuestion := "Event to watch"
			if chosenKind == "failure_share" {
				eventQuestion = "Event of a failed attempt"
			}
			if body["eventName"], err = app.RequireText(ctx, strings.TrimSpace(*event), cli.TextPrompt{What: "--event", Message: eventQuestion, Usage: createUsage}); err != nil {
				return err
			}
		}
		var passedWindow *int
		if cli.Changed(cmd, "window-hours") {
			passedWindow = windowHours
		} else if len(windowChoices) == 1 {
			passedWindow = &windowChoices[0]
		}
		windows := make([]cli.Choice[int], len(windowChoices))
		for index, hours := range windowChoices {
			windows[index] = cli.Choice[int]{Title: windowLabel(hours), Value: hours}
		}
		if body["windowHours"], err = cli.RequireChoice(ctx, app, passedWindow, cli.ChoicePrompt[int]{What: "--window-hours", Message: "Which trailing window does each hourly check read?", Usage: createUsage, Choices: windows}); err != nil {
			return err
		}
		value := *threshold
		if !cli.Changed(cmd, "threshold") {
			question := "Share that fires it, from 0 to 1"
			switch {
			case chosenKind == "event_count":
				question = "Count that fires it"
			case moneyCurrency != "":
				question = "Value that fires it, in " + moneyCurrency + " (5000 for 5,000.00)"
			case chosenKind == "metric_threshold":
				question = "Count that fires it"
			case chosenKind == "metric_change":
				question = "Change that fires it, as a share such as 0.1 for 10%"
			}
			typed, err := app.RequireText(ctx, "", cli.TextPrompt{What: "--threshold", Message: question, Usage: createUsage, Validate: func(answer string) (string, error) {
				typed, err := strconv.ParseFloat(answer, 64)
				if err != nil {
					return "", errors.New("Type a number.")
				}
				if moneyCurrency != "" {
					if _, err := toMinorUnits(typed, moneyCurrency); err != nil {
						return "", errors.New(strings.ToUpper(err.Error()[:1]) + err.Error()[1:] + ".")
					}
				}
				return answer, nil
			}})
			if err != nil {
				return err
			}
			value, _ = strconv.ParseFloat(typed, 64)
		}
		body["threshold"] = value
		if moneyCurrency != "" {
			// People write money in major units; the API holds minor ones.
			minor, err := toMinorUnits(value, moneyCurrency)
			if err != nil {
				return cli.Usagef("--threshold: %v.", err)
			}
			body["threshold"] = minor
		}
		if cli.Changed(cmd, "min-people") {
			body["minPeople"] = *minPeople
		}
		body.Text("successEventName", strings.TrimSpace(*successEvent))

		created, err := cli.Fetch[alert](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsAlertsCreateWithBody(ctx, target.Project.Id, reports.ContentType, body.Reader())
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(created)
		}
		app.Println(cli.Printable(fmt.Sprintf("Created %s (%s). It is first checked at the next quarter past the hour.", created.Value.Name, created.Value.Id)))
		return nil
	}
	return cmd
}

var alertArg = cli.Arg{Name: "alert", Help: "The alert's name or id", Optional: true}

// newAlertsSetEnabled creates `voidhash analytics alerts enable|disable`,
// which turn an alert on or off; turning it on starts it over.
func newAlertsSetEnabled(app *cli.App, enable bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "disable",
		Short:   "Turn an alert off without deleting it.",
		Example: `voidhash analytics alerts disable "Checkout errors"`,
	}
	if enable {
		cmd.Use = "enable"
		cmd.Short = "Turn an alert back on."
		cmd.Long = "Turn an alert back on. It starts over at its next check."
		cmd.Example = `voidhash analytics alerts enable "Checkout errors"`
	}
	verb := cmd.Use
	cli.SetArgs(cmd, alertArg)
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the API object as JSON, for scripts")
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		alerts, err := listAlerts(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, alertKind, alerts.Items, cli.ArgAt(args, 0), "voidhash analytics alerts "+verb+" <alert>")
		if err != nil {
			return err
		}
		updated, err := cli.Fetch[alert](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsAlertsUpdateWithBody(ctx, target.Project.Id, found.Id, reports.ContentType, reports.Body{"isEnabled": enable}.Reader())
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(updated)
		}
		state := "off"
		if enable {
			state = "on; it starts over at its next check"
		}
		app.Println(cli.Printable(fmt.Sprintf("%s is %s.", updated.Value.Name, state)))
		return nil
	}
	return cmd
}

func newAlertsDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete an alert.",
		Long:  "Delete an alert. Asks first; --yes skips that. 'voidhash analytics alerts disable' turns it off and keeps it.",
		Example: `voidhash analytics alerts delete "Checkout errors"
voidhash analytics alerts delete "Checkout errors" --yes`,
	}
	cli.SetArgs(cmd, alertArg)
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		alerts, err := listAlerts(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, alertKind, alerts.Items, cli.ArgAt(args, 0), "voidhash analytics alerts delete <alert> --yes")
		if err != nil {
			return err
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete alert %s from %s? Nobody is told if its problem happens again.", found.Name, target.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsAlertsDelete(ctx, target.Project.Id, found.Id)
		}); err != nil {
			return err
		}
		app.Println(cli.Printable(fmt.Sprintf("Deleted %s.", found.Name)))
		return nil
	}
	return cmd
}
