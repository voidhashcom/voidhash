package webhook

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

// delivery is a delivery as both the listing and the single read return it;
// the listing leaves the attempts out.
type (
	delivery = api.WebhookDeliveryWithAttemptsJsonEncoding
	attempt  = api.WebhookDeliveryAttemptJsonEncoding
)

func isUnsuccessful(d delivery) bool { return d.Status == "failed" || d.Status == "exhausted" }

func isSettled(d delivery) bool { return d.Status != "pending" && d.Status != "in_progress" }

// describeAnswer is how the webhook answered one attempt: `HTTP 500 Internal
// Server Error` or the connection error, cut to width characters.
func describeAnswer(a attempt, width int) string {
	text := "no answer"
	switch {
	case a.StatusCode != nil:
		text = "HTTP " + strconv.Itoa(*a.StatusCode)
		if a.ResponseBody != nil {
			if body := strings.Join(strings.Fields(*a.ResponseBody), " "); body != "" {
				text += " " + body
			}
		}
	case a.ErrorMessage != nil:
		text = *a.ErrorMessage
	}
	if runes := []rune(text); len(runes) > width {
		return string(runes[:width-1]) + "…"
	}
	return text
}

// deliveryState is a delivery's status for a table: "retrying Oct 28, 2026,
// 2:05 PM", "gave up (5 attempts)".
func deliveryState(app *cli.App, d delivery) string {
	switch d.Status {
	case "succeeded":
		return "delivered"
	case "exhausted":
		return fmt.Sprintf("gave up (%d attempts)", d.AttemptCount)
	case "failed":
		if d.NextAttemptAt == nil {
			return fmt.Sprintf("failed (%d/%d)", d.AttemptCount, d.MaxAttempts)
		}
		return "retrying " + app.FormatDate(*d.NextAttemptAt)
	}
	return "sending"
}

func getDelivery(ctx context.Context, app *cli.App, projectID, id string) (cli.Object[delivery], error) {
	return cli.Fetch[delivery](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.WebhooksGetDelivery(ctx, projectID, id)
	})
}

// answersOf returns the latest attempt's answer of each unsuccessful
// delivery, by delivery: one read each, since listings leave attempts out.
func answersOf(ctx context.Context, app *cli.App, projectID string, deliveries []delivery) (func(d delivery) string, error) {
	unsuccessful := slices.DeleteFunc(slices.Clone(deliveries), func(d delivery) bool { return !isUnsuccessful(d) })
	read, err := cli.Each(ctx, unsuccessful, 4, func(ctx context.Context, one delivery) (cli.Object[delivery], error) {
		return getDelivery(ctx, app, projectID, one.Id)
	})
	if err != nil {
		return nil, err
	}
	answers := map[string]string{}
	for index, one := range unsuccessful {
		if attempts := read[index].Value.Attempts; len(attempts) > 0 {
			answers[one.Id] = describeAnswer(attempts[len(attempts)-1], 60)
		}
	}
	return func(d delivery) string {
		if answer, ok := answers[d.Id]; ok {
			return answer
		}
		return "-"
	}, nil
}

// answerWait is how many seconds `test` and `retry` wait for the webhook's
// answer.
const answerWait = 15

// awaitAnswer returns the delivery once its attempt has an answer, read once
// a second for up to [answerWait] seconds; then as it stands.
func awaitAnswer(ctx context.Context, app *cli.App, projectID, deliveryID string) (cli.Object[delivery], error) {
	for waited := 0; ; waited++ {
		read, err := getDelivery(ctx, app, projectID, deliveryID)
		if err != nil || isSettled(read.Value) || waited == answerWait {
			return read, err
		}
		if err := app.Sleep(ctx, time.Second); err != nil {
			return read, err
		}
	}
}

// newestPage reads the newest 100 deliveries of each webhook: the API
// filters neither by status nor across webhooks. more is whether any webhook
// has older ones.
func newestPage(ctx context.Context, app *cli.App, projectID string, webhooks []webhook) (deliveries cli.List[delivery], more bool, err error) {
	type newest struct {
		page cli.List[delivery]
		more bool
	}
	pages, err := cli.Each(ctx, webhooks, 4, func(ctx context.Context, one webhook) (newest, error) {
		limit := 100
		page, info, err := cli.FetchPage[delivery](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.WebhooksListDeliveries(ctx, projectID, one.Id, &api.WebhooksListDeliveriesParams{Limit: &limit})
		})
		return newest{page, info.HasNextPage}, err
	})
	if err != nil {
		return deliveries, false, err
	}
	for _, one := range pages {
		deliveries.Items = append(deliveries.Items, one.page.Items...)
		deliveries.Raw = append(deliveries.Raw, one.page.Raw...)
		more = more || one.more
	}
	return deliveries, more, nil
}

func nameOf(webhooks []webhook, id string) string {
	for _, one := range webhooks {
		if one.Id == id {
			return one.Name
		}
	}
	return id
}

func newDeliveries(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "deliveries",
		Short: "List deliveries, newest first, across webhooks or of one, with how the webhook answered.",
		Long:  "List deliveries, newest first, across webhooks or of one, with how the webhook answered. --failed shows only failures. It reads the newest 100 deliveries of each webhook.",
		Example: `voidhash webhook deliveries
voidhash webhook deliveries "Orders backend" --failed
voidhash webhook deliveries --failed -q`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "webhook", Help: "Only this webhook's deliveries: its name, URL or id (default: all)", Optional: true})
	failed := cmd.Flags().Bool("failed", false, "Only deliveries that failed or gave up")
	limit := cmd.Flags().Int("limit", 20, "How many to show, newest first, at most 100")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if *limit < 1 || *limit > 100 {
			return cli.Usagef("--limit takes 1 to 100.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		webhooks, err := listWebhooks(ctx, app, projectID)
		if err != nil {
			return err
		}
		chosen := webhooks.Items
		if input := cli.ArgAt(args, 0); input != "" {
			one, err := cli.FindItem(webhookKind, webhooks.Items, input)
			if err != nil {
				return err
			}
			chosen = []webhook{one}
		}
		read, more, err := newestPage(ctx, app, projectID, chosen)
		if err != nil {
			return err
		}
		if *failed {
			read = read.Filter(isUnsuccessful)
		}
		// Newest first by when they were made, the listing's rows and their JSON together.
		order := make([]int, len(read.Items))
		for index := range order {
			order[index] = index
		}
		madeAt := func(index int) string {
			if created := read.Items[index].CreatedAt; created != nil {
				return *created
			}
			return read.Items[index].EventOccurredAt
		}
		slices.SortStableFunc(order, func(a, b int) int { return strings.Compare(madeAt(b), madeAt(a)) })
		var deliveries cli.List[delivery]
		for _, index := range order[:min(len(order), *limit)] {
			deliveries.Items = append(deliveries.Items, read.Items[index])
			deliveries.Raw = append(deliveries.Raw, read.Raw[index])
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(deliveries)
		case cli.Quiet:
			app.PrintIDs(deliveries)
			return nil
		}

		answers, err := answersOf(ctx, app, projectID, deliveries.Items)
		if err != nil {
			return err
		}
		columns := []cli.Column[delivery]{
			{Header: "TIME", Cell: func(d delivery) string { return app.FormatTimeAgo(d.EventOccurredAt) }},
		}
		if len(chosen) != 1 {
			columns = append(columns, cli.Column[delivery]{Header: "WEBHOOK", Cell: func(d delivery) string { return nameOf(webhooks.Items, d.WebhookId) }})
		}
		columns = append(columns,
			cli.Column[delivery]{Header: "EVENT", Cell: func(d delivery) string { return d.EventType }},
			cli.Column[delivery]{Header: "STATUS", Cell: func(d delivery) string { return deliveryState(app, d) }},
			cli.Column[delivery]{Header: "ANSWER", Cell: answers},
			cli.Column[delivery]{Header: "ID", Cell: func(d delivery) string { return d.Id }},
		)
		empty := "No deliveries yet."
		switch {
		case len(webhooks.Items) == 0:
			empty = "No webhooks yet. Create one with 'voidhash webhook create'."
		case *failed:
			empty = "No failed deliveries."
		}
		cli.PrintTable(app, columns, deliveries.Items, empty)
		if more {
			app.Notef("Read the newest 100 deliveries of each webhook; older ones are not shown.")
		}
		if slices.ContainsFunc(deliveries.Items, func(d delivery) bool { return d.Status == "exhausted" }) {
			app.Notef("Send the ones that gave up again with 'voidhash webhook retry <delivery>...'.")
		}
		return nil
	}
	return cmd
}

func newDelivery(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delivery",
		Short:   "Show one delivery with every attempt and how the webhook answered each.",
		Example: "voidhash webhook delivery wh_del_123",
	}
	cli.SetArgs(cmd, cli.Arg{Name: "delivery", Help: "The delivery's id, as 'voidhash webhook deliveries' shows it", Optional: true})
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		id, err := app.RequireText(ctx, cli.ArgAt(args, 0), cli.TextPrompt{
			What: "the delivery", Message: "Delivery id", Usage: "voidhash webhook delivery <delivery>; 'voidhash webhook deliveries' shows their ids",
		})
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		read, err := getDelivery(ctx, app, projectID, id)
		if err != nil {
			return cli.APIError(err, map[string]string{
				"webhook_delivery_not_found": "'voidhash webhook deliveries' lists the deliveries of this project.",
			})
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(read)
		case cli.Quiet:
			app.PrintIDs(read)
			return nil
		}
		d := read.Value
		webhooks, err := listWebhooks(ctx, app, projectID)
		if err != nil {
			return err
		}
		to := d.WebhookId
		if index := slices.IndexFunc(webhooks.Items, func(w webhook) bool { return w.Id == d.WebhookId }); index >= 0 {
			to = webhookKind.Label(webhooks.Items[index])
		}
		fields := []cli.Field{
			{Label: "Status", Value: deliveryState(app, d)},
			{Label: "Happened", Value: fmt.Sprintf("%s (%s)", app.FormatDate(d.EventOccurredAt), app.FormatTimeAgo(d.EventOccurredAt))},
			{Label: "Attempts", Value: fmt.Sprintf("%d of %d", d.AttemptCount, d.MaxAttempts)},
			{Label: "ID", Value: d.Id},
		}
		if settings, err := app.Config(); err == nil {
			if address, ok := cli.DashboardURL(settings.WebURL, target, "settings/webhooks/"+d.WebhookId+"/"+d.Id); ok {
				fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
			}
		}
		app.Println(cli.Printable(d.EventType + " to " + to))
		app.Println(cli.FormatFields(fields))
		app.Println("")
		cli.PrintTable(app, []cli.Column[attempt]{
			{Header: "#", Cell: func(a attempt) string { return strconv.Itoa(a.AttemptNumber) }},
			{Header: "TIME", Cell: func(a attempt) string {
				if a.CreatedAt == nil {
					return "-"
				}
				return app.FormatDate(*a.CreatedAt)
			}},
			{Header: "RESULT", Cell: func(a attempt) string {
				if a.IsSuccessful {
					return "accepted"
				}
				return "failed"
			}},
			{Header: "DURATION", Cell: func(a attempt) string {
				if a.DurationMs == nil {
					return "-"
				}
				return fmt.Sprintf("%d ms", *a.DurationMs)
			}},
			{Header: "ANSWER", Cell: func(a attempt) string { return describeAnswer(a, 80) }},
		}, d.Attempts, "No attempt yet.")
		if d.Status == "exhausted" {
			app.Notef("Send it again with 'voidhash webhook retry %s'.", cli.Printable(d.Id))
		}
		return nil
	}
	return cmd
}

func newRetry(app *cli.App) *cobra.Command {
	const usage = "voidhash webhook retry <delivery>..."
	cmd := &cobra.Command{
		Use:   "retry",
		Short: "Send failed deliveries again now and show how the webhook answered.",
		Long:  "Send failed deliveries again now and show how the webhook answered. Without ids it asks which on a terminal. Exits with 1 unless all were delivered.",
		Example: `voidhash webhook retry wh_del_123 wh_del_456
voidhash webhook deliveries --failed -q | xargs voidhash webhook retry`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "delivery", Help: "The ids of the deliveries to send again", Optional: true, Variadic: true})
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
		webhooks, err := listWebhooks(ctx, app, projectID)
		if err != nil {
			return err
		}
		var ids []string
		for _, id := range args {
			if !slices.Contains(ids, id) {
				ids = append(ids, id)
			}
		}
		if len(ids) == 0 {
			if !app.IsInteractive() {
				return cli.MissingInput("the deliveries", usage)
			}
			active := webhooks.Filter(func(w webhook) bool { return w.Status == "active" })
			read, _, err := newestPage(ctx, app, projectID, active.Items)
			if err != nil {
				return err
			}
			failedOnes := read.Filter(isUnsuccessful).Items
			if len(failedOnes) == 0 {
				return &cli.UserError{
					Message:  "No failed deliveries to send again.",
					Hint:     "'voidhash webhook deliveries --failed' lists failures, also of webhooks that are off.",
					ExitCode: cli.ExitNotFound,
				}
			}
			labels := make([]string, len(failedOnes))
			var gaveUp []int
			for index, one := range failedOnes {
				labels[index] = fmt.Sprintf("%s to %s, %s (%s)", one.EventType, nameOf(webhooks.Items, one.WebhookId), app.FormatTimeAgo(one.EventOccurredAt), deliveryState(app, one))
				if one.Status == "exhausted" {
					gaveUp = append(gaveUp, index)
				}
			}
			indexes, err := cli.ChooseSeveral(ctx, app, "Which deliveries should be sent again?", labels, prompt.MultiSelectOptions{
				Selected: gaveUp, Min: 1, AllowAll: true,
				// Deliveries go by their number only.
				Prompt: "Numbers, separated by commas",
				Named:  func(string) ([]int, bool) { return nil, false },
			})
			if err != nil {
				return err
			}
			slices.Sort(indexes)
			for _, index := range indexes {
				ids = append(ids, failedOnes[index].Id)
			}
		}

		var lines []string
		var sent cli.List[delivery]
		undelivered := 0
		type retried struct {
			line      string
			result    *cli.Object[delivery]
			delivered bool
		}
		// Deliveries are independent of each other, so several are sent and
		// waited for together; the report keeps the order they were named in.
		outcomes, err := cli.Each(ctx, ids, 4, func(ctx context.Context, id string) (retried, error) {
			line, result, delivered, err := retryOne(ctx, app, projectID, webhooks.Items, id)
			return retried{line, result, delivered}, err
		})
		if err != nil {
			return err
		}
		for _, one := range outcomes {
			lines = append(lines, one.line)
			if one.result != nil {
				sent.Items = append(sent.Items, one.result.Value)
				sent.Raw = append(sent.Raw, one.result.Raw)
			}
			if !one.delivered {
				undelivered++
			}
		}
		switch mode {
		case cli.JSON:
			if err := app.PrintJSON(sent); err != nil {
				return err
			}
		case cli.Quiet:
			app.PrintIDs(sent)
		default:
			app.Println(cli.PrintableLines(strings.Join(lines, "\n")))
		}
		if undelivered > 0 {
			were := "deliveries were"
			if len(ids) == 1 {
				were = "delivery was"
			}
			return cli.Failf("%d of %d %s not delivered.", undelivered, len(ids), were).
				WithHint("Fix the endpoint first ('voidhash webhook test <webhook>' checks it); Voidhash keeps retrying those that failed again.")
		}
		return nil
	}
	return cmd
}

// retryOne sends one delivery again and waits for the answer. It returns
// the line that reports it, the delivery as it then stands (nil when it
// cannot be read), and whether it was delivered. A delivery that cannot be
// sent is reported, not an error, so it does not stop the others.
func retryOne(ctx context.Context, app *cli.App, projectID string, webhooks []webhook, id string) (line string, result *cli.Object[delivery], delivered bool, err error) {
	unsendable := func(err error) (string, *cli.Object[delivery], bool, error) {
		switch cli.APIErrorCode(err) {
		case "webhook_delivery_not_found":
			return id + ": no such delivery in this project", nil, false, nil
		case "webhook_delivery_not_retryable":
			return id + ": not sent; it succeeded or is still being sent", nil, false, nil
		}
		return "", nil, false, err
	}
	before, err := getDelivery(ctx, app, projectID, id)
	if err != nil {
		return unsendable(err)
	}
	if index := slices.IndexFunc(webhooks, func(w webhook) bool { return w.Id == before.Value.WebhookId }); index >= 0 && webhooks[index].Status != "active" {
		target := webhooks[index]
		return fmt.Sprintf("%s: not sent; %s is %s. %s", id, target.Name, healthOf(target), turnedOffHint(target)), &before, false, nil
	}
	if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.WebhooksRetryDelivery(ctx, projectID, id)
	}); err != nil {
		return unsendable(err)
	}
	after, err := awaitAnswer(ctx, app, projectID, id)
	if err != nil {
		return unsendable(err)
	}
	answer := ""
	if attempts := after.Value.Attempts; len(attempts) > 0 {
		answer = ": " + describeAnswer(attempts[len(attempts)-1], 60)
	}
	switch {
	case !isSettled(after.Value):
		return fmt.Sprintf("%s: sent, no answer yet ('voidhash webhook delivery %s')", id, id), &after, false, nil
	case after.Value.Status == "succeeded":
		return id + ": delivered" + answer, &after, true, nil
	}
	return id + ": failed again" + answer, &after, false, nil
}
