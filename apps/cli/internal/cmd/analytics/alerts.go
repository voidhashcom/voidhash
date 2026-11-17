package analytics

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
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
}

// The trailing windows a rule can read, in hours.
var alertWindows = []int{1, 6, 24, 168}

func windowLabel(hours int) string {
	if hours == 168 {
		return "7 days"
	}
	return strconv.Itoa(hours) + " h"
}

// stateLabel is what the state column says, naming why a rule that cannot
// judge stays silent.
func stateLabel(item alert) string {
	if !item.IsEnabled {
		return "off"
	}
	return strings.ReplaceAll(string(item.State), "_", " ")
}

// valueLabel is what the rule read at its latest check: a count, or the
// share that failed or fell.
func valueLabel(item alert) string {
	if item.Value == nil {
		return "-"
	}
	value := float64(*item.Value)
	if item.Kind == "event_count" {
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
		Short: "Rules that tell owners and admins when events look broken.",
		Long:  "Rules that tell owners and admins when events look broken: an error that happens too often, too many failed attempts, or an event that stopped arriving. Each rule is checked every hour.",
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
			{Header: "EVENT", Cell: func(item alert) string { return item.EventName }},
			{Header: "WINDOW", Cell: func(item alert) string { return windowLabel(item.WindowHours) }},
			{Header: "STATE", Cell: stateLabel},
			{Header: "VALUE", Cell: valueLabel},
			{Header: "ID", Cell: func(item alert) string { return item.Id }},
		}, alerts.Items, "No alerts. 'voidhash analytics alerts create' adds one.")
		return nil
	}
	return cmd
}

const createUsage = "voidhash analytics alerts create --name <name> --kind <kind> --event <event> --window-hours <hours> --threshold <threshold>"

func newAlertsCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Add a rule that tells owners and admins when events look broken.",
		Long: `Add a rule that tells owners and admins when events look broken. What it watches is its kind:

  event_count    The event happened --threshold times in the window,
                 to at least --min-people people.
  failure_share  More than --threshold (0 to 1) of the attempts in the
                 window failed. An attempt is --event, the failure, or
                 --success-event.
  volume_drop    The event fell by --threshold (0 to 1) against the same
                 window in the weeks before.

It is first checked at the next quarter past the hour. On a terminal, what is not passed is asked for.`,
		Example: `voidhash analytics alerts create --name "Checkout errors" --kind event_count --event checkout_error --window-hours 1 --threshold 20
voidhash analytics alerts create --name "Payments failing" --kind failure_share --event payment_failed --success-event payment_succeeded --window-hours 6 --threshold 0.3
voidhash analytics alerts create --name "Signups dropped" --kind volume_drop --event signup --window-hours 24 --threshold 0.5`,
	}
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "What a person reads in the notice")
	kindValues := make([]string, len(alertKinds))
	for index, choice := range alertKinds {
		kindValues[index] = choice.Value
	}
	kind := cli.AddChoiceFlag(cmd, "kind", "", kindValues, "", "What it watches: too many of an event, too many failures among attempts, or an event that fell against earlier weeks")
	event := cmd.Flags().String("event", "", "The event to watch; for failure_share, the event of a failed attempt")
	successEvent := cmd.Flags().String("success-event", "", "For failure_share: the `event` of an attempt that worked")
	windowHours := cmd.Flags().Int("window-hours", 0, "The trailing window each hourly check reads, in `hours`: 1, 6, 24 or 168")
	threshold := cmd.Flags().Float64("threshold", 0, "For event_count, the count that fires it; for the others, a share from 0 to 1")
	minPeople := cmd.Flags().Int("min-people", 0, "For event_count: distinct `people` it must affect (default: 2). Use 1 when one person matters")
	asJSON := cmd.Flags().Bool("json", false, "Print the API object as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if cli.Changed(cmd, "window-hours") && !slices.Contains(alertWindows, *windowHours) {
			return cli.Usagef("--window-hours must be 1, 6, 24 or 168.")
		}
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
		eventQuestion := "Event to watch"
		if chosenKind == "failure_share" {
			eventQuestion = "Event of a failed attempt"
		}
		if body["eventName"], err = app.RequireText(ctx, strings.TrimSpace(*event), cli.TextPrompt{What: "--event", Message: eventQuestion, Usage: createUsage}); err != nil {
			return err
		}
		var passedWindow *int
		if cli.Changed(cmd, "window-hours") {
			passedWindow = windowHours
		}
		windows := make([]cli.Choice[int], len(alertWindows))
		for index, hours := range alertWindows {
			windows[index] = cli.Choice[int]{Title: windowLabel(hours), Value: hours}
		}
		if body["windowHours"], err = cli.RequireChoice(ctx, app, passedWindow, cli.ChoicePrompt[int]{What: "--window-hours", Message: "Which trailing window does each hourly check read?", Usage: createUsage, Choices: windows}); err != nil {
			return err
		}
		if cli.Changed(cmd, "threshold") {
			body["threshold"] = *threshold
		} else {
			question := "Share that fires it, from 0 to 1"
			if chosenKind == "event_count" {
				question = "Count that fires it"
			}
			typed, err := app.RequireText(ctx, "", cli.TextPrompt{What: "--threshold", Message: question, Usage: createUsage, Validate: func(answer string) (string, error) {
				if _, err := strconv.ParseFloat(answer, 64); err != nil {
					return "", errors.New("Type a number.")
				}
				return answer, nil
			}})
			if err != nil {
				return err
			}
			body["threshold"], _ = strconv.ParseFloat(typed, 64)
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
