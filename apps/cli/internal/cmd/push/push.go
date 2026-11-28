// Package push holds `voidhash push`: push notifications to the devices of
// a project's end users, and the push services they are sent through.
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

type (
	notification  = api.PushNotificationJsonEncoding
	delivery      = api.PushNotificationDeliveryJsonEncoding
	configuration = api.PushNotificationConfigurationJsonEncoding
)

// New creates `voidhash push`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "push",
		Short: "Push notifications to your users' devices: send one, see how it went, set up push services.",
	}
	cmd.AddCommand(newSend(app), newList(app), newDeliveries(app), newConfig(app))
	return cmd
}

var statusLabels = map[api.PushNotificationStatus]string{
	api.PushNotificationStatusPending:       "queued",
	api.PushNotificationStatusInProgress:    "sending",
	api.PushNotificationStatusSucceeded:     "delivered",
	api.PushNotificationStatusPartialFailed: "partly failed",
	api.PushNotificationStatusFailed:        "failed",
	api.PushNotificationStatusNoRecipients:  "no devices",
}

// serviceShort and serviceLabels name a push service, falling back to what
// the API calls one this CLI does not know.
func serviceShort(service api.PushNotificationProviderType) string {
	switch service {
	case api.PushNotificationProviderTypeApns:
		return "APNs"
	case api.PushNotificationProviderTypeFcm:
		return "FCM"
	}
	return string(service)
}

func serviceLabel(service api.PushNotificationProviderType) string {
	switch service {
	case api.PushNotificationProviderTypeApns:
		return "Apple Push Notification service"
	case api.PushNotificationProviderTypeFcm:
		return "Firebase Cloud Messaging"
	}
	return string(service)
}

const setHint = "Set up a push service first: 'voidhash push config set apns ...' or 'voidhash push config set fcm ...'."

func listConfigurations(ctx context.Context, app *cli.App, projectID string) (cli.List[configuration], error) {
	return cli.ListAll[configuration](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PushNotificationConfigurationsList(ctx, projectID, &api.PushNotificationConfigurationsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

func newSend(app *cli.App) *cobra.Command {
	const usage = `voidhash push send --to <person> --title "<title>" --body "<body>"`
	cmd := &cobra.Command{
		Use:   "send",
		Short: "Send a push notification to people's devices.",
		Long:  "Send a push notification to every device the people named registered. Shows who it reaches and asks first; --yes skips that, --dry-run only shows.",
		Example: `voidhash push send --to ada@example.com --title "Welcome back" --body "Your trial ends tomorrow"
voidhash push send --to user-42 --to user-43 --title Hi --body Hello --data screen=offers --yes
voidhash push send --to user-42 --title Hi --body Hello --dry-run`,
	}
	to := cli.AddStringsFlag(cmd, "to", "", "A `person` to notify: their distinct id, email or id; repeat for each")
	title := cmd.Flags().String("title", "", "The notification's title")
	body := cmd.Flags().String("body", "", "The notification's `text`")
	data := cli.AddStringsFlag(cmd, "data", "", "Data for your app, as `key=value`; repeat for each")
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	dryRun := cli.AddDryRunFlag(cmd)
	output := cli.AddOutputFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if len(*to) == 0 {
			return cli.Usagef("Who should get it? Pass --to <person> for each person.").WithHint("Run it as: " + usage)
		}
		payloadData := map[string]string{}
		for _, pair := range *data {
			key, value, ok := strings.Cut(pair, "=")
			if !ok || key == "" {
				return cli.Usagef("--data takes key=value, not %s.", pair)
			}
			payloadData[key] = value
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id

		// Find everyone and check the push services first, so nothing is sent by halves.
		var persons []person
		seen := map[string]bool{}
		named, err := cli.Each(ctx, *to, 4, func(ctx context.Context, input string) (person, error) {
			return findPerson(ctx, app, projectID, input)
		})
		if err != nil {
			return err
		}
		for _, found := range named {
			if !seen[found.Id] {
				seen[found.Id] = true
				persons = append(persons, found)
			}
		}
		configurations, err := listConfigurations(ctx, app, projectID)
		if err != nil {
			return err
		}
		var services []string
		for _, one := range configurations.Items {
			if one.IsEnabled {
				services = append(services, serviceShort(one.Type))
			}
		}
		if len(services) == 0 {
			return cli.Failf("%s has no push service turned on, so nothing can be sent.", target.Label()).WithHint(setHint)
		}
		messageTitle, err := app.RequireText(ctx, *title, cli.TextPrompt{What: "--title", Message: "Title", Usage: usage})
		if err != nil {
			return err
		}
		messageBody, err := app.RequireText(ctx, *body, cli.TextPrompt{What: "--body", Message: "Text", Usage: usage})
		if err != nil {
			return err
		}

		ids, names := make([]string, len(persons)), make([]string, len(persons))
		for index, one := range persons {
			ids[index], names[index] = one.Id, personKind.Label(one)
		}
		audience := strings.Join(names, ", ")
		if len(persons) > 1 {
			audience = fmt.Sprintf("%d people (%s)", len(persons), audience)
		}
		summary := fmt.Sprintf("%q to %s, on every device they registered, through %s", messageTitle, audience, strings.Join(services, " and "))
		if *dryRun {
			app.Println(cli.Printable(fmt.Sprintf("Would send %s. Nothing was sent.", summary)))
			return nil
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Send %s? It cannot be taken back.", summary)); err != nil {
			return err
		}
		payload := map[string]any{"personIds": ids, "title": messageTitle, "body": messageBody}
		if len(payloadData) > 0 {
			payload["data"] = payloadData
		}
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		// One key for the send, so a request repeated after a lost answer notifies nobody twice.
		idempotencyKey := app.NewID()
		sent, err := cli.Fetch[api.AcceptedPushNotificationJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PushNotificationsCreateWithBody(ctx, projectID, &api.PushNotificationsCreateParams{IdempotencyKey: &idempotencyKey}, "application/json", bytes.NewReader(encoded))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"push_notifications_not_configured": setHint,
				"push_notifications_not_enabled":    "Push notifications are not enabled for this organization; contact Voidhash to turn them on.",
			})
		}
		id, devices := sent.Value.Id, sent.Value.DeviceCount
		if devices == 0 {
			return app.PrintItem(mode, sent, fmt.Sprintf("Sent %s, but none of their devices is registered for push, so it reaches nobody. Your app registers a device once its user allows notifications.", id))
		}
		plural := "s"
		if devices == 1 {
			plural = ""
		}
		return app.PrintItem(mode, sent, fmt.Sprintf("Sending to %d device%s (%s). Follow it with 'voidhash push deliveries %s'.", devices, plural, id, id))
	}
	return cmd
}

// titleOf is the title of a sent notification, when it is still kept.
func titleOf(n notification) string {
	if n.IsMessagePurged {
		return "(no longer kept)"
	}
	if title, ok := n.Message["title"].(string); ok {
		return title
	}
	return "-"
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the latest push notifications with how many devices each reached, failed or skipped.",
		Example: "voidhash push list\nvoidhash push list --limit 50 --json",
	}
	limit := cmd.Flags().Int("limit", 20, "How many of the latest to show, at most 100")
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
		count := min(max(*limit, 1), 100)
		notifications, _, err := cli.FetchPage[notification](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PushNotificationsList(ctx, target.Project.Id, &api.PushNotificationsListParams{Limit: &count})
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(notifications)
		case cli.Quiet:
			app.PrintIDs(notifications)
			return nil
		}
		skipped := false
		for _, one := range notifications.Items {
			skipped = skipped || one.SkippedCount > 0
		}
		cli.PrintTable(app, []cli.Column[notification]{
			{Header: "SENT", Cell: func(n notification) string { return app.FormatTimeAgo(n.CreatedAt) }},
			{Header: "TITLE", Cell: titleOf},
			{Header: "STATUS", Cell: func(n notification) string {
				if label, ok := statusLabels[n.Status]; ok {
					return label
				}
				return string(n.Status)
			}},
			{Header: "DEVICES", Cell: func(n notification) string { return strconv.Itoa(n.DeviceCount) }},
			{Header: "DELIVERED", Cell: func(n notification) string { return strconv.Itoa(n.SucceededCount) }},
			{Header: "FAILED", Cell: func(n notification) string { return strconv.Itoa(n.FailedCount) }},
			{Header: "SKIPPED", Cell: func(n notification) string { return strconv.Itoa(n.SkippedCount) }},
			{Header: "ID", Cell: func(n notification) string { return n.Id }},
		}, notifications.Items, "No push notifications sent yet. Send one with 'voidhash push send'.")
		if skipped {
			app.Notef("Skipped devices use a push service the project has not turned on; 'voidhash push config list' shows them.")
		}
		return nil
	}
	return cmd
}

var pushKind = cli.ItemKind[notification]{
	Noun:        "push notification",
	ID:          func(n notification) string { return n.Id },
	Label:       func(n notification) string { return titleOf(n) + " (" + n.Id + ")" },
	ListCommand: "voidhash push list",
}

func newDeliveries(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "deliveries",
		Short:   "Show how a push notification reached each device, and why deliveries failed.",
		Long:    "Show how a push notification reached each device, and why deliveries failed. Without an id it asks which of the latest, on a terminal.",
		Example: "voidhash push deliveries push_123\nvoidhash push deliveries push_123 --failed",
	}
	cli.SetArgs(cmd, cli.Arg{Name: "push", Help: "The push notification's id, as 'voidhash push list' shows", Optional: true})
	failed := cmd.Flags().Bool("failed", false, "Only deliveries that failed or gave up")
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
		pushID := cli.ArgAt(args, 0)
		if pushID == "" {
			if !app.IsInteractive() {
				return cli.Usagef("Missing the push notification.").
					WithHint("Run it as: voidhash push deliveries <push>; 'voidhash push list' shows their ids.")
			}
			latest := 20
			recent, _, err := cli.FetchPage[notification](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PushNotificationsList(ctx, projectID, &api.PushNotificationsListParams{Limit: &latest})
			})
			if err != nil {
				return err
			}
			chosen, err := cli.ChooseItem(ctx, app, pushKind, recent.Items, "")
			if err != nil {
				return err
			}
			pushID = chosen.Id
		}
		// The API filters by one status at a time: failures are two listings.
		statuses := []*api.PushNotificationDeliveryStatus{nil}
		if *failed {
			gaveUp, failedOnce := api.PushNotificationDeliveryStatusExhausted, api.PushNotificationDeliveryStatusFailed
			statuses = []*api.PushNotificationDeliveryStatus{&failedOnce, &gaveUp}
		}
		listings, err := cli.Each(ctx, statuses, 2, func(ctx context.Context, status *api.PushNotificationDeliveryStatus) (cli.List[delivery], error) {
			return cli.ListAll[delivery](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.PushNotificationsListDeliveries(ctx, projectID, pushID, &api.PushNotificationsListDeliveriesParams{Cursor: page.Cursor, Limit: page.Limit, Status: status})
			})
		})
		if err != nil {
			return err
		}
		var deliveries cli.List[delivery]
		for _, listed := range listings {
			deliveries.Items = append(deliveries.Items, listed.Items...)
			deliveries.Raw = append(deliveries.Raw, listed.Raw...)
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(deliveries)
		case cli.Quiet:
			app.PrintIDs(deliveries)
			return nil
		}
		empty := "It reached no devices."
		if *failed {
			empty = "No delivery failed."
		}
		cli.PrintTable(app, []cli.Column[delivery]{
			{Header: "PERSON", Cell: func(d delivery) string { return d.PersonId }},
			{Header: "SERVICE", Cell: func(d delivery) string { return serviceShort(d.Provider) }},
			{Header: "STATUS", Cell: func(d delivery) string {
				if d.Status == api.PushNotificationDeliveryStatusExhausted {
					return "gave up"
				}
				return string(d.Status)
			}},
			{Header: "ATTEMPTS", Cell: func(d delivery) string { return fmt.Sprintf("%d/%d", d.AttemptCount, d.MaxAttempts) }},
			{Header: "ERROR", Cell: func(d delivery) string {
				if d.LastError == nil {
					return "-"
				}
				return *d.LastError
			}},
			{Header: "ID", Cell: func(d delivery) string { return d.Id }},
		}, deliveries.Items, empty)
		return nil
	}
	return cmd
}
