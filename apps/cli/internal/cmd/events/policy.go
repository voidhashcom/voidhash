package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// policy is the ingest policy with each built-in event setting as the
// server sent it, so --json can print one.
type policy struct {
	BuiltinEvents       []json.RawMessage `json:"builtinEvents"`
	BlockedCustomEvents []string          `json:"blockedCustomEvents"`
}

type builtinSetting = api.BuiltinEventSettingJsonEncoding

var builtinKind = cli.ItemKind[builtinSetting]{
	Noun:        "built-in event",
	ID:          func(setting builtinSetting) string { return setting.Key },
	Label:       func(setting builtinSetting) string { return setting.Name + " (" + setting.Key + ")" },
	ListCommand: "voidhash events policy view",
	Keys:        func(setting builtinSetting) []string { return setting.EventNames },
	Names:       func(setting builtinSetting) []string { return []string{setting.Name} },
}

func fetchPolicy(cmd *cobra.Command, app *cli.App, projectID string) (cli.Object[policy], []builtinSetting, error) {
	ctx := cmd.Context()
	fetched, err := cli.Fetch[policy](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.IngestPolicyGet(ctx, projectID)
	})
	if err != nil {
		return fetched, nil, err
	}
	settings := make([]builtinSetting, len(fetched.Value.BuiltinEvents))
	for index, raw := range fetched.Value.BuiltinEvents {
		if err := json.Unmarshal(raw, &settings[index]); err != nil {
			return fetched, nil, cli.Failf("The Voidhash API sent an event policy the CLI could not read.")
		}
	}
	return fetched, settings, nil
}

// newPolicy creates `voidhash events policy`.
func newPolicy(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "policy",
		Short: "Which events the project stores.",
		Long:  "Which events the project stores: built-in events are stored once enabled, custom events unless blocked.",
	}
	cmd.AddCommand(newPolicyView(app), newSetBuiltin(app, true), newSetBuiltin(app, false), newSetCustom(app, true), newSetCustom(app, false))
	return cmd
}

// newPolicyView creates `voidhash events policy view`.
func newPolicyView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "view",
		Short:   "Show which built-in events are stored and which custom events are blocked.",
		Example: `voidhash events policy view`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		target, err := app.ResolveProject(cmd.Context(), *project)
		if err != nil {
			return err
		}
		fetched, settings, err := fetchPolicy(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(fetched)
		}
		app.Println("Built-in events (stored only when on):")
		cli.PrintTable(app, []cli.Column[builtinSetting]{
			{Header: "NAME", Cell: func(setting builtinSetting) string { return setting.Name }},
			{Header: "KEY", Cell: func(setting builtinSetting) string { return setting.Key }},
			{Header: "EVENTS", Cell: func(setting builtinSetting) string { return strings.Join(setting.EventNames, ", ") }},
			{Header: "STORED", Cell: func(setting builtinSetting) string {
				stored := "no"
				if setting.IsEnabled {
					stored = "yes"
				}
				if !setting.IsOverridden {
					stored += " (default)"
				}
				return stored
			}},
		}, settings, "No built-in event settings.")
		blocked := "none"
		if len(fetched.Value.BlockedCustomEvents) > 0 {
			blocked = cli.Printable(strings.Join(fetched.Value.BlockedCustomEvents, ", "))
		}
		app.Println("\nCustom events are stored unless blocked. Blocked: " + blocked)
		app.Notef("Change it with 'voidhash events policy enable|disable <built-in event>' or 'block|unblock <custom event>'.")
		return nil
	}
	return cmd
}

// newSetBuiltin creates `voidhash events policy enable|disable [event]`.
func newSetBuiltin(app *cli.App, enable bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "disable",
		Short: "Stop storing a built-in event.",
		Long:  "Stop storing a built-in event. Events sent while it is off are dropped and cannot be recovered. Asks first; --yes skips that.",
		Example: `voidhash events policy disable '$screen'
voidhash events policy disable pageviews --yes`,
	}
	if enable {
		cmd.Use = "enable"
		cmd.Short = "Start storing a built-in event, such as $pageview."
		cmd.Long = ""
		cmd.Example = `voidhash events policy enable '$pageview'
voidhash events policy enable screens`
	}
	verb := cmd.Use
	cli.SetArgs(cmd, cli.Arg{Name: "event", Help: "A built-in event, such as $pageview, or its setting's key or name", Optional: true})
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		fetched, settings, err := fetchPolicy(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		setting, err := cli.RequireItem(ctx, app, builtinKind, settings, cli.ArgAt(args, 0), "voidhash events policy "+verb+" <event>")
		if err != nil {
			return err
		}
		events := strings.Join(setting.EventNames, ", ")
		if setting.IsEnabled == enable {
			if *asJSON {
				index := slices.IndexFunc(settings, func(candidate builtinSetting) bool { return candidate.Key == setting.Key })
				return app.PrintJSON(fetched.Value.BuiltinEvents[index])
			}
			state := "not stored"
			if enable {
				state = "stored"
			}
			app.Println(cli.Printable(fmt.Sprintf("%s is already %s; nothing changed.", builtinKind.Label(setting), state)))
			return nil
		}
		if !enable {
			question := fmt.Sprintf("Stop storing %s in %s? Events sent while it is off are dropped and cannot be recovered.", events, target.Label())
			if setting.Warning != nil {
				question += " " + *setting.Warning
			}
			if err := app.ConfirmChange(ctx, *yes, question); err != nil {
				return err
			}
		}
		updated, err := cli.Fetch[builtinSetting](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.IngestPolicyUpsertBuiltinEvent(ctx, target.Project.Id, setting.Key, api.UpsertBuiltinEventBodyJsonEncoding{IsEnabled: enable})
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(updated)
		}
		stored := strings.Join(updated.Value.EventNames, ", ")
		if enable {
			app.Println(cli.Printable(fmt.Sprintf("Now storing %s (%s).", stored, updated.Value.Name)))
		} else {
			app.Println(cli.Printable(fmt.Sprintf("Stopped storing %s (%s). Turn it back on with 'voidhash events policy enable %s'.", stored, updated.Value.Name, updated.Value.Key)))
		}
		return nil
	}
	return cmd
}

// customEventState is what block and unblock answer with.
type customEventState struct {
	EventName string `json:"eventName"`
	IsBlocked bool   `json:"isBlocked"`
}

// newSetCustom creates `voidhash events policy block|unblock [event]`.
func newSetCustom(app *cli.App, block bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "unblock",
		Short:   "Store a blocked custom event again.",
		Example: `voidhash events policy unblock debug_ping`,
	}
	builtinVerb := "enable"
	if block {
		cmd.Use = "block"
		cmd.Short = "Stop storing a custom event."
		cmd.Long = "Stop storing a custom event. Events sent while it is blocked are dropped and cannot be recovered. Asks first; --yes skips that."
		cmd.Example = `voidhash events policy block debug_ping
voidhash events policy block debug_ping --yes`
		builtinVerb = "disable"
	}
	verb := cmd.Use
	cli.SetArgs(cmd, cli.Arg{Name: "event", Help: "The custom event's name, such as button_clicked", Optional: true})
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		name, err := app.RequireText(ctx, strings.TrimSpace(cli.ArgAt(args, 0)), cli.TextPrompt{
			What:    "the custom event's name",
			Message: "Custom event name",
			Usage:   "voidhash events policy " + verb + " <event>",
		})
		if err != nil {
			return err
		}
		if strings.HasPrefix(name, "$") {
			return cli.Usagef("%s is a built-in event; it is turned on and off by its setting.", name).
				WithHint(fmt.Sprintf("Run 'voidhash events policy %s %s'.", builtinVerb, name))
		}
		fetched, _, err := fetchPolicy(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		if slices.Contains(fetched.Value.BlockedCustomEvents, name) == block {
			if *asJSON {
				return app.PrintJSON(customEventState{EventName: name, IsBlocked: block})
			}
			state := "stored"
			if block {
				state = "blocked"
			}
			app.Println(cli.Printable(fmt.Sprintf("%s is already %s; nothing changed.", name, state)))
			return nil
		}
		if block {
			question := fmt.Sprintf("Stop storing %s events in %s? Events sent while it is blocked are dropped and cannot be recovered.", name, target.Label())
			if err := app.ConfirmChange(ctx, *yes, question); err != nil {
				return err
			}
		}
		updated, err := cli.Fetch[customEventState](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.IngestPolicyUpsertCustomEvent(ctx, target.Project.Id, name, api.UpsertCustomEventBodyJsonEncoding{IsBlocked: block})
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(updated)
		}
		if block {
			app.Println(cli.Printable(fmt.Sprintf("Blocked %s: it is no longer stored. Undo with 'voidhash events policy unblock %s'.", updated.Value.EventName, updated.Value.EventName)))
		} else {
			app.Println(cli.Printable(fmt.Sprintf("Unblocked %s: it is stored again from now on.", updated.Value.EventName)))
		}
		return nil
	}
	return cmd
}
