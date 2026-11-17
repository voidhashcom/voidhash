// Package events holds `voidhash events`: the events a project's apps send,
// listed, watched as they arrive, and the policy that decides which are
// stored.
package events

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash-go/api"
	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// New creates `voidhash events`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "events",
		Aliases: []string{"event"},
		Short:   "The events your apps send: list, watch and choose which are stored.",
		Long:    "The events your apps send: list the latest, watch them arrive, and choose which are stored.",
	}
	cmd.AddCommand(newList(app), newTail(app), newPolicy(app))
	return cmd
}

// maxScanned is how far back a search for one person's events looks; the
// API filters events by name only.
const maxScanned = 1_000

// event is the part of an event the commands read. Its properties stay as
// they were sent, because the order of their keys is the order they are
// shown in.
type event struct {
	ID                 string          `json:"id"`
	Name               string          `json:"name"`
	DistinctID         string          `json:"distinctId"`
	PreviousDistinctID *string         `json:"previousDistinctId"`
	PersonID           *string         `json:"personId"`
	Source             string          `json:"source"`
	ReceivedAt         string          `json:"receivedAt"`
	Properties         json.RawMessage `json:"properties"`
}

// eventFilter is --name and --person, which list and tail share.
type eventFilter struct {
	name   *string
	person *string
}

func addFilterFlags(cmd *cobra.Command) eventFilter {
	return eventFilter{
		name:   cmd.Flags().String("name", "", "Only events with this name, such as $pageview or purchase_completed"),
		person: cmd.Flags().String("person", "", "Only events of this person: a distinct id, person id or email"),
	}
}

// page reads one page of the newest events, after cursor.
func (f eventFilter) page(ctx context.Context, app *cli.App, projectID string, cursor *string) (cli.List[event], api.PageInfo, error) {
	limit := cli.PageSize
	params := &api.EventsListParams{Limit: &limit, Cursor: cursor}
	if *f.name != "" {
		params.Name = f.name
	}
	return cli.FetchPage[event](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.EventsList(ctx, projectID, params)
	})
}

// matcher says whether an event belongs to the person --person names. An
// email is looked up among the persons, since events carry ids only;
// anything else matches the event's distinct id, previous distinct id or
// person id.
func (f eventFilter) matcher(ctx context.Context, app *cli.App, projectID string) (func(event) bool, error) {
	wanted := strings.TrimSpace(*f.person)
	if wanted == "" {
		return func(event) bool { return true }, nil
	}
	if !strings.Contains(wanted, "@") {
		return func(item event) bool {
			return item.DistinctID == wanted ||
				(item.PreviousDistinctID != nil && *item.PreviousDistinctID == wanted) ||
				(item.PersonID != nil && *item.PersonID == wanted)
		}, nil
	}
	persons, err := cli.ListAll[api.PersonJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PersonsList(ctx, projectID, &api.PersonsListParams{Cursor: page.Cursor, Limit: page.Limit, Email: &wanted})
	})
	if err != nil {
		return nil, err
	}
	if len(persons.Items) == 0 {
		return nil, &cli.UserError{
			Message:  fmt.Sprintf("No person has the email %s.", wanted),
			Hint:     "Pass their distinct id instead, as your app identifies them.",
			ExitCode: cli.ExitNotFound,
		}
	}
	ids := map[string]bool{}
	for _, id := range persons.IDs() {
		ids[id] = true
	}
	return func(item event) bool { return item.PersonID != nil && ids[*item.PersonID] }, nil
}

func nextCursor(info api.PageInfo) *string {
	if !info.HasNextPage {
		return nil
	}
	return info.EndCursor
}

// newest reads up to limit of the newest events matches accepts, newest
// first, page by page. Without a person filter the first pages are the
// answer; with one, at most maxScanned events are read, and complete says
// whether that was enough.
func (f eventFilter) newest(ctx context.Context, app *cli.App, projectID string, matches func(event) bool, limit int) (found cli.List[event], complete bool, err error) {
	found = cli.List[event]{Items: []event{}, Raw: []json.RawMessage{}}
	var cursor *string
	for scanned := 0; ; {
		page, info, err := f.page(ctx, app, projectID, cursor)
		if err != nil {
			return found, false, err
		}
		for index, item := range page.Items {
			if matches(item) {
				found.Items = append(found.Items, item)
				found.Raw = append(found.Raw, page.Raw[index])
			}
		}
		scanned += len(page.Items)
		cursor = nextCursor(info)
		if len(found.Items) >= limit || cursor == nil {
			if len(found.Items) > limit {
				found.Items, found.Raw = found.Items[:limit], found.Raw[:limit]
			}
			return found, true, nil
		}
		if scanned >= maxScanned {
			return found, false, nil
		}
	}
}

// shortValue is a property value for a table cell: short, on one line.
func shortValue(value json.RawMessage) string {
	var text string
	if err := json.Unmarshal(value, &text); err != nil {
		var compact bytes.Buffer
		if err := json.Compact(&compact, value); err != nil {
			return ""
		}
		text = compact.String()
	}
	if utf8.RuneCountInString(text) > 40 {
		return string([]rune(text)[:39]) + "…"
	}
	return text
}

// propertiesOf is the first few of an event's properties, as key=value.
func propertiesOf(item event) string {
	var shown []string
	total := 0
	for _, field := range reports.OrderedFields(item.Properties) {
		if strings.HasPrefix(field.Key, "$lib") {
			continue
		}
		total++
		if len(shown) < 3 {
			shown = append(shown, field.Key+"="+shortValue(field.Value))
		}
	}
	switch {
	case total == 0:
		return "-"
	case total > 3:
		return strings.Join(shown, " ") + " …"
	}
	return strings.Join(shown, " ")
}

// newList creates `voidhash events list [--name] [--person] [--limit]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's latest events, newest first.",
		Long: `List the project's latest events, newest first, optionally of one event name or one person.

A person is named by a distinct id, a person id or an email. The API filters events by name only, so a search for one person reads the latest 1,000 events and says when that was not all of them.`,
		Example: `voidhash events list
voidhash events list --name purchase_completed --limit 50
voidhash events list --person dana@example.com --json`,
	}
	filter := addFilterFlags(cmd)
	limit := cmd.Flags().Int("limit", 25, "How many events to show (default: 25)")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if *limit < 1 {
			return cli.Usagef("--limit must be at least 1.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		matches, err := filter.matcher(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		events, complete, err := filter.newest(ctx, app, target.Project.Id, matches, *limit)
		if err != nil {
			return err
		}
		if !complete {
			app.Warnf("Searched the latest %s events only; older events of this person are not shown.", reports.FormatCount(maxScanned))
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(events)
		case cli.Quiet:
			app.PrintIDs(events)
			return nil
		}
		empty := "No events yet. Events appear once an app with a Voidhash SDK sends them; 'voidhash analytics health' shows what is reporting."
		if *filter.name != "" || *filter.person != "" {
			empty = "No events match. 'voidhash events list' shows the latest of every kind."
		}
		cli.PrintTable(app, []cli.Column[event]{
			{Header: "RECEIVED", Cell: func(item event) string { return app.FormatTimeAgo(item.ReceivedAt) }},
			{Header: "EVENT", Cell: func(item event) string { return item.Name }},
			{Header: "PERSON", Cell: func(item event) string { return item.DistinctID }},
			{Header: "SOURCE", Cell: func(item event) string { return item.Source }},
			{Header: "PROPERTIES", Cell: propertiesOf},
		}, events.Items, empty)
		return nil
	}
	return cmd
}

// Widths of the columns `events tail` prints. Rows arrive one at a time, so
// the columns cannot be sized to their widest cell; a longer value pushes
// the rest of its row.
const (
	tailTimeWidth   = 8
	tailEventWidth  = 24
	tailPersonWidth = 20
	tailSourceWidth = 8
)

func tailRow(time, name, person, source, properties string) string {
	pad := func(text string, width int) string {
		return text + strings.Repeat(" ", max(0, width-utf8.RuneCountInString(text)))
	}
	return strings.TrimRight(strings.Join([]string{
		pad(time, tailTimeWidth), pad(name, tailEventWidth), pad(person, tailPersonWidth), pad(source, tailSourceWidth), properties,
	}, "  "), " ")
}

// receivedClock is when an event arrived as a clock time in the person's
// time zone.
func receivedClock(app *cli.App, iso string) string {
	parsed, err := time.Parse(time.RFC3339Nano, iso)
	if err != nil {
		return iso
	}
	return parsed.In(app.Location).Format("15:04:05")
}

// tailFailures is how many reads in a row may fail before `events tail`
// ends with the failure.
const tailFailures = 5

// newTail creates `voidhash events tail [--name] [--person] [--interval] [--count]`.
func newTail(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tail",
		Short: "Show events as they arrive, until Ctrl+C or --count of them.",
		Long: `Show events as they arrive, until Ctrl+C or --count of them. Good for checking an app's tracking while you use it.

It starts with the latest few events, then prints each new one once. With --count it prints only events that arrive after it started and exits once it has that many, so 'voidhash events tail --name purchase_completed --count 1' waits for one purchase.

With --json each event is one line of JSON.`,
		Example: `voidhash events tail
voidhash events tail --person user_42
voidhash events tail --name purchase_completed --count 1 --json`,
	}
	filter := addFilterFlags(cmd)
	interval := cmd.Flags().Int("interval", 2, "`Seconds` between checks for new events (default: 2)")
	count := cmd.Flags().Int("count", 0, "Stop after this many new events, such as 1 to wait for one")
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if *interval < 1 {
			return cli.Usagef("--interval must be at least 1 second.")
		}
		counted := cli.Changed(cmd, "count")
		if counted && *count < 1 {
			return cli.Usagef("--count must be at least 1.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		matches, err := filter.matcher(ctx, app, projectID)
		if err != nil {
			return err
		}
		print := func(item event, raw json.RawMessage) error {
			if *asJSON {
				// One event per line, so a reader can take them as they come.
				var line bytes.Buffer
				if err := json.Compact(&line, raw); err != nil {
					return err
				}
				app.Println(line.String())
				return nil
			}
			app.Println(cli.Printable(tailRow(receivedClock(app, item.ReceivedAt), item.Name, item.DistinctID, item.Source, propertiesOf(item))))
			return nil
		}

		first, _, err := filter.page(ctx, app, projectID, nil)
		if err != nil {
			return err
		}
		if !*asJSON {
			what := "events"
			if *filter.name != "" {
				what = cli.Printable(*filter.name) + " events"
			}
			if *filter.person != "" {
				what += " of " + cli.Printable(*filter.person)
			}
			app.Notef("Waiting for %s in %s; press Ctrl+C to stop.", what, target.Label())
			app.Println(app.Style().Bold(tailRow("RECEIVED", "EVENT", "PERSON", "SOURCE", "PROPERTIES")))
		}
		// Ids already seen, so an event is printed once however the pages shift.
		seen := map[string]bool{}
		var latest []int
		for index, item := range first.Items {
			seen[item.ID] = true
			if matches(item) && len(latest) < 5 {
				latest = append(latest, index)
			}
		}
		if !counted {
			for position := len(latest) - 1; position >= 0; position-- {
				if err := print(first.Items[latest[position]], first.Raw[latest[position]]); err != nil {
					return err
				}
			}
		}

		// unseen reads the events not seen yet, newest first: pages are read
		// until one holds an event that was seen, or ten of them.
		unseen := func() (cli.List[event], error) {
			fresh := cli.List[event]{}
			added := map[string]bool{}
			var cursor *string
			for pages := 1; ; pages++ {
				page, info, err := filter.page(ctx, app, projectID, cursor)
				if err != nil {
					return fresh, err
				}
				reachedSeen := false
				for index, item := range page.Items {
					switch {
					case seen[item.ID]:
						reachedSeen = true
					case !added[item.ID]:
						// Pages shift while new events arrive; one can repeat.
						added[item.ID] = true
						fresh.Items = append(fresh.Items, item)
						fresh.Raw = append(fresh.Raw, page.Raw[index])
					}
				}
				cursor = nextCursor(info)
				if reachedSeen || cursor == nil || pages >= 10 {
					return fresh, nil
				}
			}
		}
		printed, failures := 0, 0
		for {
			// Ctrl+C ends the wait, and the run, here.
			if err := app.Sleep(ctx, time.Duration(*interval)*time.Second); err != nil {
				return err
			}
			fresh, err := unseen()
			if err != nil {
				// A server error or a dropped connection usually passes: the
				// tail waits it out, and gives up when it does not.
				status := voidhash.StatusCode(err)
				if failures++; ctx.Err() != nil || !cli.IsAPIError(err) || (status != 0 && status < 500) || failures == tailFailures {
					return err
				}
				if failures == 1 {
					why := "the API did not answer"
					var described *cli.UserError
					if errors.As(cli.APIError(err, nil), &described) {
						why = strings.TrimSuffix(strings.SplitN(described.Message, "\n", 2)[0], ".")
					}
					app.Notef("%s", app.ErrStyle().Dim(cli.Printable(fmt.Sprintf("Could not read new events (%s); trying again every %d seconds.", why, *interval))))
				}
				continue
			}
			failures = 0
			for _, item := range fresh.Items {
				seen[item.ID] = true
			}
			for index := len(fresh.Items) - 1; index >= 0; index-- {
				if !matches(fresh.Items[index]) {
					continue
				}
				if err := print(fresh.Items[index], fresh.Raw[index]); err != nil {
					return err
				}
				printed++
				if counted && printed >= *count {
					return nil
				}
			}
		}
	}
	return cmd
}
