// Package webhook holds `voidhash webhook`: the backend URLs a project's
// events are sent to, and how their deliveries went. A webhook is named by
// its id, name or URL.
//
// Voidhash sends in the background: `test` and `retry` wait a few seconds
// for the webhook's answer, and say where to read it when it takes longer.
package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

type (
	webhook    = api.WebhookJsonEncoding
	withSecret = api.WebhookWithSecretJsonEncoding
)

// New creates `voidhash webhook`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "webhook",
		Aliases: []string{"webhooks"},
		Short:   "The backend URLs your project's events are sent to.",
		Long:    "The backend URLs your project's events are sent to: create and change them, test them, and see and retry their deliveries.",
	}
	cmd.AddCommand(
		newList(app), newView(app), newCreate(app), newEdit(app), newEnable(app), newDisable(app),
		newDelete(app), newRotate(app), newTest(app), newDeliveries(app), newDelivery(app), newRetry(app),
	)
	return cmd
}

// eventTypes is every event a webhook can receive, in the order people
// choose them.
var eventTypes = []string{
	"purchase.completed",
	"purchase.refunded",
	"purchase.revoked",
	"subscription.created",
	"subscription.renewed",
	"subscription.product_changed",
	"subscription.cancelled",
	"subscription.expired",
	"person.deleted",
	"person.created",
	"person.updated",
}

// unsentEvents are events the API accepts but nothing sends yet.
var unsentEvents = []string{"person.created", "person.updated"}

var webhookKind = cli.ItemKind[webhook]{
	Noun:          "webhook",
	ID:            func(w webhook) string { return w.Id },
	Label:         func(w webhook) string { return w.Name + " (" + w.Url + ")" },
	ListCommand:   "voidhash webhook list",
	CreateCommand: "voidhash webhook create",
	Keys:          func(w webhook) []string { return []string{w.Url} },
	Names:         func(w webhook) []string { return []string{w.Name} },
}

var webhookArg = cli.Arg{Name: "webhook", Help: "The webhook's name, URL or id", Optional: true}

const environmentRule = "A production webhook receives the purchase events of production keys; a test webhook those of store sandbox and test purchases. Person events reach both."

const eventsHelp = `Events: purchase.completed, purchase.refunded, purchase.revoked, subscription.created, subscription.renewed, subscription.product_changed, subscription.cancelled, subscription.expired, person.deleted. purchase.*, subscription.* and person.* name a group, and all every event that is sent.`

// parseEvents returns the events inputs name: event types, `purchase.*`
// style groups, or `all`. It fails naming what is unknown, with the list to
// choose from.
func parseEvents(inputs []string) ([]string, error) {
	var chosen, unknown []string
	for _, input := range inputs {
		wanted := strings.TrimSpace(input)
		var matches []string
		for _, event := range eventTypes {
			switch {
			case wanted == "all" || wanted == "*":
				if !slices.Contains(unsentEvents, event) {
					matches = append(matches, event)
				}
			case strings.HasSuffix(wanted, ".*"):
				if strings.HasPrefix(event, strings.TrimSuffix(wanted, "*")) {
					matches = append(matches, event)
				}
			case event == wanted:
				matches = append(matches, event)
			}
		}
		if len(matches) == 0 {
			unknown = append(unknown, strconv.Quote(input))
		}
		for _, event := range matches {
			if !slices.Contains(chosen, event) {
				chosen = append(chosen, event)
			}
		}
	}
	if len(unknown) > 0 {
		return nil, cli.Usagef("Unknown event %s.", strings.Join(unknown, ", ")).
			WithHint("Choose from " + strings.Join(eventTypes, ", ") + "; purchase.*, subscription.* and person.* name a group, all every event.")
	}
	return chosen, nil
}

// chooseEvents asks which events to send, on a terminal, with selected
// chosen already.
func chooseEvents(ctx context.Context, app *cli.App, selected []string) ([]string, error) {
	labels := make([]string, len(eventTypes))
	var marked []int
	for index, event := range eventTypes {
		labels[index] = event
		if slices.Contains(unsentEvents, event) {
			labels[index] += " (not sent yet)"
		}
		if slices.Contains(selected, event) {
			marked = append(marked, index)
		}
	}
	indexes, err := cli.ChooseSeveral(ctx, app, "Which events should it receive? (purchase.* names a group, all every event that is sent)", labels, prompt.MultiSelectOptions{
		Selected: marked,
		Min:      1,
		Named: func(answer string) ([]int, bool) {
			events, err := parseEvents([]string{answer})
			if err != nil {
				return nil, false
			}
			named := make([]int, len(events))
			for position, event := range events {
				named[position] = slices.Index(eventTypes, event)
			}
			return named, true
		},
	})
	if err != nil {
		return nil, err
	}
	// The events as the API lists them, whatever order they were typed in.
	slices.Sort(indexes)
	events := make([]string, len(indexes))
	for position, index := range indexes {
		events[position] = eventTypes[index]
	}
	return events, nil
}

// healthOf is how a webhook is doing, as a person says it.
func healthOf(w webhook) string {
	switch {
	case w.Status == "disabled":
		return "disabled"
	case w.Status == "failed":
		return fmt.Sprintf("stopped after %d failures", w.ConsecutiveFailures)
	case w.ConsecutiveFailures > 0:
		return fmt.Sprintf("failing (%d in a row)", w.ConsecutiveFailures)
	}
	return "delivering"
}

// turnedOffHint is what to do about a webhook that is sent nothing.
func turnedOffHint(w webhook) string {
	if w.Status == "failed" {
		return fmt.Sprintf("Voidhash stopped it after repeated failures. Fix the endpoint ('voidhash webhook deliveries %s --failed' shows how it answered), then 'voidhash webhook enable %s'.", w.Id, w.Id)
	}
	return fmt.Sprintf("Turn it on with 'voidhash webhook enable %s'.", w.Id)
}

func listWebhooks(ctx context.Context, app *cli.App, projectID string) (cli.List[webhook], error) {
	return cli.ListAll[webhook](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.WebhooksList(ctx, projectID, &api.WebhooksListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// found is the project a command acts on and the webhook its argument names.
type found struct {
	target   *cli.ProjectContext
	webhooks cli.List[webhook]
	webhook  cli.Object[webhook]
}

// requireWebhook resolves the project and the webhook input names, asked
// for on a terminal; usage shows how to pass it off one.
func requireWebhook(ctx context.Context, app *cli.App, project, input, usage string) (found, error) {
	target, err := app.ResolveProject(ctx, project)
	if err != nil {
		return found{}, err
	}
	webhooks, err := listWebhooks(ctx, app, target.Project.Id)
	if err != nil {
		return found{}, err
	}
	named, err := cli.RequireItem(ctx, app, webhookKind, webhooks.Items, input, usage)
	if err != nil {
		return found{}, err
	}
	index := slices.IndexFunc(webhooks.Items, func(w webhook) bool { return w.Id == named.Id })
	return found{target: target, webhooks: webhooks, webhook: webhooks.Object(index)}, nil
}

// update changes a webhook. Only the fields of changes are sent: a field
// left out keeps its value, and a null description removes the note.
func update(ctx context.Context, app *cli.App, projectID, webhookID string, changes map[string]any) (cli.Object[webhook], error) {
	body, err := json.Marshal(changes)
	if err != nil {
		return cli.Object[webhook]{}, err
	}
	return cli.Fetch[webhook](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.WebhooksUpdateWithBody(ctx, projectID, webhookID, "application/json", bytes.NewReader(body))
	})
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the project's webhooks and whether they deliver.",
		Example: "voidhash webhook list\nvoidhash webhook list --json",
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
		webhooks, err := listWebhooks(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(webhooks)
		case cli.Quiet:
			app.PrintIDs(webhooks)
			return nil
		}
		cli.PrintTable(app, []cli.Column[webhook]{
			{Header: "NAME", Cell: func(w webhook) string { return w.Name }},
			{Header: "URL", Cell: func(w webhook) string { return w.Url }},
			{Header: "ENVIRONMENT", Cell: func(w webhook) string { return string(w.Environment) }},
			{Header: "STATUS", Cell: healthOf},
			{Header: "LAST SUCCESS", Cell: func(w webhook) string {
				if w.LastSuccessAt == nil {
					return "-"
				}
				return app.FormatTimeAgo(*w.LastSuccessAt)
			}},
			{Header: "EVENTS", Cell: func(w webhook) string { return strconv.Itoa(len(w.Events)) }},
			{Header: "ID", Cell: func(w webhook) string { return w.Id }},
		}, webhooks.Items, "No webhooks yet. Send events to your backend with 'voidhash webhook create'.")
		for _, w := range webhooks.Items {
			if w.Status == "failed" {
				app.Notef("%s: %s", cli.Printable(w.Name), turnedOffHint(w))
			}
		}
		return nil
	}
	return cmd
}

// withRecentDeliveries is a webhook's JSON with its latest deliveries under
// `recentDeliveries`. Spliced rather than decoded, so the server's key order
// and any field newer than this CLI stay as they were sent.
func withRecentDeliveries(raw json.RawMessage, deliveries json.RawMessage) (json.RawMessage, error) {
	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err != nil {
		return nil, err
	}
	object := strings.TrimSuffix(compact.String(), "}")
	if object != "{" {
		object += ","
	}
	return json.RawMessage(object + `"recentDeliveries":` + string(deliveries) + "}"), nil
}

func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "view",
		Short:   "Show a webhook: its URL, events and health, and its latest deliveries with how it answered.",
		Example: "voidhash webhook view \"Orders backend\"\nvoidhash webhook view https://example.com/webhooks/voidhash --json",
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), "voidhash webhook view <webhook>")
		if err != nil {
			return err
		}
		w := at.webhook.Value
		if mode == cli.Quiet {
			app.PrintIDs(at.webhook)
			return nil
		}
		latest := 10
		recent, _, err := cli.FetchPage[delivery](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.WebhooksListDeliveries(ctx, at.target.Project.Id, w.Id, &api.WebhooksListDeliveriesParams{Limit: &latest})
		})
		if err != nil {
			return err
		}
		if mode == cli.JSON {
			raw, err := withRecentDeliveries(at.webhook.Raw, recent.RawJSON())
			if err != nil {
				return err
			}
			return app.PrintJSON(raw)
		}
		answers, err := answersOf(ctx, app, at.target.Project.Id, recent.Items)
		if err != nil {
			return err
		}
		lastSuccess := "never"
		if w.LastSuccessAt != nil {
			lastSuccess = app.FormatTimeAgo(*w.LastSuccessAt)
		}
		fields := []cli.Field{
			{Label: "Environment", Value: string(w.Environment)},
			{Label: "Status", Value: healthOf(w)},
			{Label: "Last success", Value: lastSuccess},
			{Label: "Events", Value: strings.Join(w.Events, "\n")},
		}
		if w.Description != nil {
			fields = append(fields, cli.Field{Label: "Description", Value: *w.Description})
		}
		fields = append(fields, cli.Field{Label: "ID", Value: w.Id})
		if settings, err := app.Config(); err == nil {
			if address, ok := cli.DashboardURL(settings.WebURL, at.target, "settings/webhooks/"+w.Id); ok {
				fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
			}
		}
		app.Println(cli.Printable(webhookKind.Label(w)))
		app.Println(cli.FormatFields(fields))
		app.Println("")
		cli.PrintTable(app, []cli.Column[delivery]{
			{Header: "TIME", Cell: func(d delivery) string { return app.FormatTimeAgo(d.EventOccurredAt) }},
			{Header: "EVENT", Cell: func(d delivery) string { return d.EventType }},
			{Header: "STATUS", Cell: func(d delivery) string { return deliveryState(app, d) }},
			{Header: "ANSWER", Cell: answers},
			{Header: "ID", Cell: func(d delivery) string { return d.Id }},
		}, recent.Items, fmt.Sprintf("No deliveries yet. Send a test event with 'voidhash webhook test %s'.", w.Id))
		if w.Status != "active" {
			app.Notef("%s", turnedOffHint(w))
		}
		return nil
	}
	return cmd
}

func newCreate(app *cli.App) *cobra.Command {
	const usage = "voidhash webhook create --name <name> --url <url> --event <event>... [--environment production|test]"
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a webhook and print its signing secret, shown only this once.",
		Long: "Create a webhook and print its signing secret, shown only this once. Asks for what is missing on a terminal.\n\n" +
			environmentRule + "\n\n" + eventsHelp,
		Example: `voidhash webhook create --name "Orders backend" --url https://example.com/webhooks/voidhash --event purchase.* --event subscription.renewed
voidhash webhook create --name Staging --url https://staging.example.com/hooks --event all --environment test`,
	}
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "What it is for, such as Orders backend")
	url := cmd.Flags().String("url", "", "The public URL Voidhash POSTs events to")
	event := cli.AddStringsFlag(cmd, "event", "", "An event to send, such as purchase.completed, a group such as subscription.*, or all; repeat for each")
	description := cmd.Flags().String("description", "", "A note for your team")
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "test"}, "",
		"Which purchase events it receives: production (default), or test for a staging backend")
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		// A misspelt event fails before anything is asked or requested.
		events, err := parseEvents(*event)
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		webhookName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name, such as Orders backend", Usage: usage})
		if err != nil {
			return err
		}
		webhookURL, err := app.RequireText(ctx, *url, cli.TextPrompt{What: "--url", Message: "URL to send events to", Usage: usage})
		if err != nil {
			return err
		}
		if len(events) == 0 {
			if !app.IsInteractive() {
				return cli.MissingInput("--event", usage)
			}
			if events, err = chooseEvents(ctx, app, nil); err != nil {
				return err
			}
		}
		body := map[string]any{"name": webhookName, "url": webhookURL, "events": events}
		if *description != "" {
			body["description"] = *description
		}
		if *environment != "" {
			body["environment"] = *environment
		}
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		created, err := cli.Fetch[withSecret](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.WebhooksCreateWithBody(ctx, target.Project.Id, "application/json", bytes.NewReader(encoded))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invalid_webhook_url": "Use a public URL. Voidhash does not call localhost or private networks; for local development, expose your server through a tunnel first.",
			})
		}
		w := created.Value
		whose := ""
		if w.Environment == "test" {
			whose = " of store sandbox and test purchases"
		}
		return app.PrintItem(mode, created, strings.Join([]string{
			fmt.Sprintf("Created %s webhook %s (%s) in %s, receiving %s%s.", w.Environment, w.Name, w.Url, target.Label(), strings.Join(w.Events, ", "), whose),
			"",
			"Signing secret (shown only now):",
			"  " + w.Secret,
			"",
			"Store it as a secret of your backend: it verifies each delivery's X-Webhook-Signature header.",
			fmt.Sprintf("Next: send a test event with 'voidhash webhook test %s'.", w.Id),
		}, "\n"))
	}
	return cmd
}

func newEdit(app *cli.App) *cobra.Command {
	const usage = "voidhash webhook edit <webhook> [--name <name>] [--url <url>] [--event <event>]... [--description <text>] [--environment production|test] [--yes]"
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Change a webhook's name, URL, events, description or environment.",
		Long: "Change a webhook's name, URL, events, description or environment. Asks on a terminal when no flag is given. Moving a webhook to test asks first; --yes skips that.\n\n" +
			environmentRule + "\n\n" + eventsHelp,
		Example: `voidhash webhook edit "Orders backend" --url https://example.com/v2/webhooks
voidhash webhook edit "Orders backend" --event purchase.* --event subscription.*
voidhash webhook edit "Orders backend" --description ""`,
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "Its new name")
	url := cmd.Flags().String("url", "", "Its new URL")
	event := cli.AddStringsFlag(cmd, "event", "", "Every event it should receive from now on; repeat for each")
	description := cmd.Flags().String("description", "", `Its new note; "" removes it`)
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "test"}, "",
		"Which purchase events it receives from now on: production or test")
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		events, err := parseEvents(*event)
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		w := at.webhook.Value
		newName, newURL := *name, *url
		hasDescription := cli.Changed(cmd, "description")
		if newName == "" && newURL == "" && !hasDescription && *environment == "" && len(events) == 0 {
			if !app.IsInteractive() {
				return cli.Usagef("Nothing to change.").
					WithHint("Pass --name, --url, --event, --description or --environment: " + usage + ". To turn it off, 'voidhash webhook disable'.")
			}
			if newName, err = app.RequireText(ctx, "", cli.TextPrompt{Message: "Name", Initial: w.Name}); err != nil {
				return err
			}
			if newURL, err = app.RequireText(ctx, "", cli.TextPrompt{Message: "URL", Initial: w.Url}); err != nil {
				return err
			}
			if events, err = chooseEvents(ctx, app, w.Events); err != nil {
				return err
			}
		}

		// Only what differs is sent, and said.
		changes := map[string]any{}
		var said []string
		if newName != "" && newName != w.Name {
			changes["name"] = newName
		}
		if newURL != "" && newURL != w.Url {
			changes["url"] = newURL
		}
		if hasDescription {
			switch {
			case *description == "" && w.Description != nil:
				changes["description"] = nil
			case *description != "" && (w.Description == nil || *w.Description != *description):
				changes["description"] = *description
			}
		}
		if len(events) > 0 {
			same := len(events) == len(w.Events)
			for _, one := range events {
				same = same && slices.Contains(w.Events, one)
			}
			if !same {
				changes["events"] = events
			}
		}
		if *environment != "" && *environment != string(w.Environment) {
			changes["environment"] = *environment
		}
		if len(changes) == 0 {
			return app.PrintItem(mode, at.webhook, "Nothing changed.")
		}
		if changes["environment"] == "test" {
			question := fmt.Sprintf("Move %s to test? It stops receiving the events of production purchases and receives those of store sandbox and test purchases instead.", webhookKind.Label(w))
			if err := app.ConfirmChange(ctx, *yes, question); err != nil {
				return err
			}
		}
		updated, err := update(ctx, app, at.target.Project.Id, w.Id, changes)
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invalid_webhook_url": "Use a public URL. Voidhash does not call localhost or private networks.",
			})
		}
		said = append(said, fmt.Sprintf("Updated webhook %s.", webhookKind.Label(updated.Value)))
		if _, ok := changes["url"]; ok {
			said = append(said, fmt.Sprintf("Events go to the new URL from now on, retries of earlier ones too. Check it with 'voidhash webhook test %s'.", updated.Value.Id))
		}
		if _, ok := changes["events"]; ok {
			said = append(said, fmt.Sprintf("It receives %s.", strings.Join(events, ", ")))
		}
		if _, ok := changes["description"]; ok {
			if changes["description"] == nil {
				said = append(said, "Its note is removed.")
			} else {
				said = append(said, "Its note is changed.")
			}
		}
		switch changes["environment"] {
		case "test":
			said = append(said, "It receives the events of store sandbox and test purchases from now on, no longer production ones.")
		case "production":
			said = append(said, "It receives the events of production purchases from now on, no longer test ones.")
		}
		return app.PrintItem(mode, updated, strings.Join(said, "\n"))
	}
	return cmd
}

func newEnable(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "enable",
		Short:   "Turn a webhook on again, also one Voidhash stopped after repeated failures.",
		Example: `voidhash webhook enable "Orders backend"`,
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), "voidhash webhook enable <webhook>")
		if err != nil {
			return err
		}
		w := at.webhook.Value
		if w.Status == "active" {
			return app.PrintItem(mode, at.webhook, webhookKind.Label(w)+" is already on.")
		}
		updated, err := update(ctx, app, at.target.Project.Id, w.Id, map[string]any{"status": "active"})
		if err != nil {
			return err
		}
		human := fmt.Sprintf("Turned on %s; deliveries waiting for it are sent now.", webhookKind.Label(updated.Value))
		if w.Status == "failed" {
			human += fmt.Sprintf("\nIts failure count is cleared. Deliveries that gave up are not resent: 'voidhash webhook deliveries %s --failed', then 'voidhash webhook retry'.", w.Id)
		}
		return app.PrintItem(mode, updated, human)
	}
	return cmd
}

func newDisable(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "disable",
		Short:   "Stop sending events to a webhook without deleting it.",
		Long:    "Stop sending events to a webhook without deleting it. Events that happen while it is off are never sent to it. Asks first; --yes skips that.",
		Example: "voidhash webhook disable \"Orders backend\"\nvoidhash webhook disable wh_ep_123 --yes",
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), "voidhash webhook disable <webhook> --yes")
		if err != nil {
			return err
		}
		w := at.webhook.Value
		if w.Status == "disabled" {
			return app.PrintItem(mode, at.webhook, webhookKind.Label(w)+" is already off.")
		}
		question := fmt.Sprintf("Turn off %s? Events that happen while it is off are never sent to it, not even after it is turned on again.", webhookKind.Label(w))
		if err := app.ConfirmChange(ctx, *yes, question); err != nil {
			return err
		}
		updated, err := update(ctx, app, at.target.Project.Id, w.Id, map[string]any{"status": "disabled"})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("Turned off %s. Turn it on with 'voidhash webhook enable %s'.", webhookKind.Label(updated.Value), updated.Value.Id))
	}
	return cmd
}

func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a webhook and its delivery history.",
		Long:    "Delete a webhook and its delivery history. Asks first; --yes skips that. 'voidhash webhook disable' pauses one instead.",
		Example: "voidhash webhook delete \"Orders backend\"\nvoidhash webhook delete wh_ep_123 --yes",
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), "voidhash webhook delete <webhook> --yes")
		if err != nil {
			return err
		}
		label := webhookKind.Label(at.webhook.Value)
		question := fmt.Sprintf("Delete webhook %s from %s, with its delivery history? It stops receiving events. This cannot be undone.", label, at.target.Label())
		if err := app.ConfirmChange(ctx, *yes, question); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.WebhooksDelete(ctx, at.target.Project.Id, at.webhook.Value.Id)
		}); err != nil {
			return err
		}
		return app.PrintItem(mode, at.webhook, "Deleted webhook "+label+".")
	}
	return cmd
}

func newRotate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "rotate",
		Short:   "Replace a webhook's signing secret and print the new one, shown only this once.",
		Long:    "Replace a webhook's signing secret and print the new one, shown only this once. The old one stops working at once. Asks first; --yes skips that.",
		Example: "voidhash webhook rotate \"Orders backend\"\nvoidhash webhook rotate wh_ep_123 --yes --json",
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), "voidhash webhook rotate <webhook> --yes")
		if err != nil {
			return err
		}
		label := webhookKind.Label(at.webhook.Value)
		question := fmt.Sprintf("Replace the signing secret of %s? The current secret stops working at once: your backend rejects deliveries until it verifies with the new one.", label)
		if err := app.ConfirmChange(ctx, *yes, question); err != nil {
			return err
		}
		rotated, err := cli.Fetch[withSecret](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.WebhooksRotate(ctx, at.target.Project.Id, at.webhook.Value.Id)
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, rotated, strings.Join([]string{
			fmt.Sprintf("Replaced the signing secret of %s (%s).", rotated.Value.Name, rotated.Value.Url),
			"",
			"New signing secret (shown only now):",
			"  " + rotated.Value.Secret,
			"",
			"Update the secret your backend verifies X-Webhook-Signature with and deploy it;",
			"Voidhash retries what fails meanwhile.",
			fmt.Sprintf("Then check it with 'voidhash webhook test %s'.", rotated.Value.Id),
		}, "\n"))
	}
	return cmd
}

func newTest(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "test",
		Short:   "Send a signed test event to a webhook and show how it answered.",
		Long:    fmt.Sprintf("Send a signed test event to a webhook and show how it answered, waiting up to %d seconds. Exits with 1 when it did not accept it.", answerWait),
		Example: `voidhash webhook test "Orders backend"`,
	}
	cli.SetArgs(cmd, webhookArg)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		at, err := requireWebhook(ctx, app, *project, cli.ArgAt(args, 0), "voidhash webhook test <webhook>")
		if err != nil {
			return err
		}
		w, projectID := at.webhook.Value, at.target.Project.Id
		if w.Status != "active" {
			return cli.Failf("%s is %s, so it is sent nothing.", webhookKind.Label(w), healthOf(w)).WithHint(turnedOffHint(w))
		}
		sent, err := cli.Fetch[delivery](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.WebhooksTest(ctx, projectID, w.Id)
		})
		if err != nil {
			return err
		}
		if mode == cli.Human {
			app.Notef("Sent a test event to %s...", cli.Printable(w.Url))
		}
		answered, err := awaitAnswer(ctx, app, projectID, sent.Value.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(answered)
		case cli.Quiet:
			app.PrintIDs(answered)
			return nil
		}
		d := answered.Value
		if !isSettled(d) || len(d.Attempts) == 0 {
			return cli.Failf("%s has not answered after %d seconds.", w.Name, answerWait).
				WithHint(fmt.Sprintf("See how it answers with 'voidhash webhook delivery %s'.", d.Id))
		}
		last := d.Attempts[len(d.Attempts)-1]
		took := ""
		if last.DurationMs != nil {
			took = fmt.Sprintf(" in %d ms", *last.DurationMs)
		}
		if last.IsSuccessful {
			status := "-"
			if last.StatusCode != nil {
				status = strconv.Itoa(*last.StatusCode)
			}
			app.Println(cli.Printable(fmt.Sprintf("%s answered HTTP %s%s: it is reachable and accepts deliveries.", w.Name, status, took)))
			return nil
		}
		hint := "Voidhash retries it like any delivery; fix the endpoint and test again."
		if last.StatusCode != nil && (*last.StatusCode == 401 || *last.StatusCode == 403) {
			hint = fmt.Sprintf("Your backend probably verifies the signature with another secret. 'voidhash webhook rotate %s' gives a new one to store there.", w.Id)
		}
		return cli.Failf("%s answered %s%s.", w.Name, describeAnswer(last, 200), took).WithHint(hint)
	}
	return cmd
}
