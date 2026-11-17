// Package person holds `voidhash person`: the end users of the project's apps.
package person

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

// New creates `voidhash person`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "person",
		Aliases: []string{"persons"},
		Short:   "The people using your app: find them, see their access, edit and erase them.",
		Long: `The people using your app: find them, see what they bought and can use, explain their access, edit them, and erase their data.

A person is named by their email, their distinct id (the id your app identifies them by) or their id. Names and parts of an email cannot be searched. Prefix email:, distinct_id: or person_id: to say which one you mean.`,
	}
	cmd.AddCommand(newList(app), newFind(app), newView(app), newWhy(app), newEdit(app), newCreate(app), newErase(app))
	return cmd
}

var personArg = cli.Arg{Name: "person", Help: "The person's email, distinct id (the id your app identifies them by) or id", Optional: true}

func orDash(value *string) string {
	if value == nil {
		return "-"
	}
	return *value
}

// newList creates `voidhash person list [--limit <n>]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's newest persons.",
		Long:  "List the project's newest persons. A project can hold millions, so this shows the newest only; 'voidhash person find' looks one up.",
		Example: `voidhash person list
voidhash person list --limit 100 --json`,
	}
	limit := cmd.Flags().Int("limit", 20, "How many of the newest persons to show, at most 100")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
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
		persons, info, err := cli.FetchPage[paywalls.Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, target.Project.Id, &api.PersonsListParams{Limit: limit})
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(persons)
		case cli.Quiet:
			app.PrintIDs(persons)
			return nil
		}
		cli.PrintTable(app, []cli.Column[paywalls.Person]{
			{Header: "PERSON", Cell: paywalls.PersonName},
			{Header: "DISTINCT ID", Cell: func(person paywalls.Person) string { return person.DistinctId }},
			{Header: "IDENTIFIED", Cell: func(person paywalls.Person) string {
				if person.IsIdentified {
					return "yes"
				}
				return "no"
			}},
			{Header: "FIRST SEEN", Cell: func(person paywalls.Person) string {
				if person.CreatedAt == nil {
					return "-"
				}
				return app.FormatTimeAgo(*person.CreatedAt)
			}},
			{Header: "ID", Cell: func(person paywalls.Person) string { return person.Id }},
		}, persons.Items, "No persons yet. The SDK adds one when your app first runs.")
		if info.HasNextPage {
			app.Notef("Showing the %d newest. Find someone with 'voidhash person find <email or distinct id>'.", *limit)
		}
		return nil
	}
	return cmd
}

// newFind creates `voidhash person find <query>`.
func newFind(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "find",
		Short: "Find persons by their exact email, distinct id or id.",
		Long:  "Find persons by their exact email, distinct id or id. Names cannot be searched. Several persons can share an email; each is listed.",
		Example: `voidhash person find ada@example.com
voidhash person find distinct_id:user-42 -q`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "query", Help: "An exact email, distinct id or person id; prefix email:, distinct_id: or person_id: to say which"})
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
		_, matches, err := paywalls.PersonsMatching(ctx, app, target.Project.Id, args[0])
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(matches)
		case cli.Quiet:
			app.PrintIDs(matches)
			return nil
		}
		if len(matches.Items) == 0 {
			return paywalls.NoPerson(args[0])
		}
		cli.PrintTable(app, []cli.Column[paywalls.Person]{
			{Header: "PERSON", Cell: paywalls.PersonName},
			{Header: "DISTINCT ID", Cell: func(person paywalls.Person) string { return person.DistinctId }},
			{Header: "EMAIL", Cell: func(person paywalls.Person) string { return orDash(person.Email) }},
			{Header: "ID", Cell: func(person paywalls.Person) string { return person.Id }},
		}, matches.Items, "")
		// By its id: an end user chooses a distinct id, and this line is meant to be pasted.
		app.Notef("See one with 'voidhash person view %s'.", cli.Printable(matches.Items[0].Id))
		return nil
	}
	return cmd
}

// traitValue reads a trait value from the command line: a number, true,
// false or null as such; anything else as text.
func traitValue(text string) any {
	decoder := json.NewDecoder(strings.NewReader(text))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil || decoder.More() {
		return text
	}
	switch value.(type) {
	case json.Number, bool, nil:
		return value
	}
	return text
}

// parseAttributes reads key=value pairs as attributes, or fails naming the
// malformed one.
func parseAttributes(flag string, pairs []string) (map[string]any, error) {
	attributes := map[string]any{}
	for _, pair := range pairs {
		key, value, ok := strings.Cut(pair, "=")
		if !ok || key == "" {
			return nil, cli.Usagef("%s takes key=value; %q has no key.", flag, pair).
				WithHint("Such as: " + flag + " plan=pro")
		}
		attributes[key] = traitValue(value)
	}
	return attributes, nil
}

// newEdit creates `voidhash person edit <person> [--email] [--name] [--set key=value]… [--set-once key=value]…`.
func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Change a person's email, name or attributes.",
		Long:  "Change a person's email, name or attributes. Your app's SDK may overwrite them the next time it sets them: the newest write wins.",
		Example: `voidhash person edit user-42 --email ada@example.com
voidhash person edit ada@example.com --set plan=team --set seats=5 --set-once referrer=newsletter`,
	}
	cli.SetArgs(cmd, personArg)
	email := cmd.Flags().String("email", "", "Their new email")
	name := cmd.Flags().String("name", "", "Their new name")
	set := cli.AddStringsFlag(cmd, "set", "", "An attribute to set, as `key=value` (numbers, true, false and null as such)")
	setOnce := cli.AddStringsFlag(cmd, "set-once", "", "An attribute to set only when they have none yet, as `key=value`")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		body := map[string]any{}
		if cli.Changed(cmd, "email") {
			body["email"] = *email
		}
		if cli.Changed(cmd, "name") {
			body["name"] = *name
		}
		if len(*set) > 0 {
			if body["traits"], err = parseAttributes("--set", *set); err != nil {
				return err
			}
		}
		if len(*setOnce) > 0 {
			if body["setOnce"], err = parseAttributes("--set-once", *setOnce); err != nil {
				return err
			}
		}
		if len(body) == 0 {
			return cli.Usagef("Nothing to change.").WithHint("Pass --email, --name, --set key=value or --set-once key=value.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		found, err := paywalls.RequirePerson(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash person edit <person> --email <email>")
		if err != nil {
			return err
		}
		updated, err := cli.Fetch[paywalls.Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsUpdateWithBody(ctx, target.Project.Id, found.Value.Id, paywalls.JSONContentType, paywalls.JSONBody(body))
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, updated, strings.Join([]string{
			fmt.Sprintf("Updated %s.", paywalls.PersonKind.Label(updated.Value)),
			"Your app's SDK may overwrite these the next time it sets them: the newest write wins.",
		}, "\n"))
	}
	return cmd
}

// newCreate creates `voidhash person create --distinct-id <id> [--email] [--name]`.
func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Add a person before your app has seen them.",
		Long:  "Add a person before your app has seen them, by the distinct id it will identify them by. When someone already has that distinct id, nothing changes and they are printed.",
		Example: `voidhash person create --distinct-id user-100 --email new@example.com
voidhash person create --distinct-id user-100 -q`,
	}
	distinctID := cmd.Flags().String("distinct-id", "", "The `id` your app will identify them by, such as your user id")
	email := cmd.Flags().String("email", "", "Their email")
	name := cmd.Flags().String("name", "", "Their name")
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
		id, err := app.RequireText(ctx, *distinctID, cli.TextPrompt{
			What:    "--distinct-id",
			Message: "The id your app will identify them by",
			Usage:   "voidhash person create --distinct-id <id> [--email <email>]",
		})
		if err != nil {
			return err
		}
		existing, _, err := cli.FetchPage[paywalls.Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, target.Project.Id, &api.PersonsListParams{DistinctId: &id})
		})
		if err != nil {
			return err
		}
		if len(existing.Items) > 0 {
			known := existing.Object(0)
			return app.PrintItem(mode, known, fmt.Sprintf("%s already has the distinct id %s; nothing changed. Change them with 'voidhash person edit %s'.",
				paywalls.PersonKind.Label(known.Value), id, known.Value.Id))
		}
		body := map[string]any{"distinctId": id}
		if *email != "" {
			body["email"] = *email
		}
		if *name != "" {
			body["name"] = *name
		}
		created, err := cli.Fetch[paywalls.Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsCreateWithBody(ctx, target.Project.Id, paywalls.JSONContentType, paywalls.JSONBody(body))
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, created, fmt.Sprintf("Created %s. Your app reaches them when it identifies them as %s.",
			paywalls.PersonKind.Label(created.Value), created.Value.DistinctId))
	}
	return cmd
}

// erasure is a request to erase a person's personal data.
type erasure struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func (e erasure) isFinished() bool { return e.Status == "completed" || e.Status == "failed" }

// How long `person erase` waits for the erasure before leaving it to finish
// in the background.
const erasureWaitSeconds = 60

// newErase creates `voidhash person erase <person> [--yes] [--no-wait]`.
func newErase(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "erase",
		Short: "Erase a person's personal data for good, for a data deletion request.",
		Long: `Erase a person's personal data for good, for a data deletion request. Their profile, attributes, distinct ids and the personal data in their events are erased; their purchases and access stay, anonymized.

Asks you to type their email (or their distinct id when they have no email); --yes skips that. The erasure runs in the background: the command waits up to a minute for it, and --no-wait returns once it is requested.`,
		Example: `voidhash person erase ada@example.com
voidhash person erase person_123 --yes --no-wait --json`,
	}
	cli.SetArgs(cmd, personArg)
	yes := cli.AddYesFlag(cmd)
	wait := cmd.Flags().Bool("wait", true, "Wait for the erasure to finish")
	_ = cmd.Flags().MarkHidden("wait")
	noWait := cmd.Flags().Bool("no-wait", false, "Return once the erasure is requested, without waiting for it to finish")
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
		found, err := paywalls.RequirePerson(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash person erase <person> --yes")
		if err != nil {
			return err
		}
		label := paywalls.PersonKind.Label(found.Value)
		identifier := found.Value.DistinctId
		if found.Value.Email != nil {
			identifier = *found.Value.Email
		}
		if err := app.ConfirmByTypingName(ctx, *yes, fmt.Sprintf("Erase the personal data of %s in %s? Their profile, attributes, distinct ids and the personal data in their events are erased for good; their purchases and access stay, anonymized.",
			label, target.Label()), identifier); err != nil {
			return err
		}
		current, err := cli.Fetch[erasure](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsCreateErasureWithBody(ctx, target.Project.Id, paywalls.JSONContentType, paywalls.JSONBody(map[string]any{"personId": found.Value.Id}))
		})
		if err != nil {
			return err
		}
		// The erasure runs in the background; most finish within seconds.
		if *wait && !*noWait {
			for attempt := 0; attempt < erasureWaitSeconds && !current.Value.isFinished(); attempt++ {
				if err := app.Sleep(ctx, time.Second); err != nil {
					return err
				}
				id := current.Value.ID
				if current, err = cli.Fetch[erasure](ctx, app, func(c *api.Client) (*http.Response, error) {
					return c.PersonsGetErasure(ctx, target.Project.Id, id)
				}); err != nil {
					return err
				}
			}
		}
		switch current.Value.Status {
		case "failed":
			return cli.Failf("The erasure of %s failed.", label).
				WithHint(fmt.Sprintf("Run 'voidhash person erase %s' again to retry it.", found.Value.Id))
		case "completed":
			return app.PrintItem(mode, current, fmt.Sprintf("Erased the personal data of %s.", label))
		}
		return app.PrintItem(mode, current, fmt.Sprintf("Requested the erasure of %s (%s); it finishes in the background.", label, current.Value.ID))
	}
	return cmd
}

// encodeJSON is value as JSON, for a member of a combined --json result.
func encodeJSON(value any) json.RawMessage {
	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		panic(err)
	}
	return bytes.TrimSpace(out.Bytes())
}
