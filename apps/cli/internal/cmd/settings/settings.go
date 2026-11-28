// Package settings holds `voidhash settings`: a project's settings,
// explained, and changed one at a time.
package settings

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

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash settings`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "settings",
		Short: "The project's settings, explained: view them and change one.",
	}
	cmd.AddCommand(newView(app), newSet(app))
	return cmd
}

// all is every setting `settings view` shows, as the API returns them.
type all struct {
	project cli.Object[api.ProjectSettingsJsonEncoding]
	// sandbox is nil when the caller cannot read the sandbox.
	sandbox *cli.Object[api.SandboxSettingsJsonEncoding]
}

// read fetches the project's settings, and its sandbox settings when the
// caller may read them.
func read(ctx context.Context, app *cli.App, projectID string) (all, error) {
	project, err := cli.Fetch[api.ProjectSettingsJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ProjectsGetSettings(ctx, projectID)
	})
	if err != nil {
		return all{}, err
	}
	settings := all{project: project}
	sandbox, err := cli.Fetch[api.SandboxSettingsJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.SandboxGetSettings(ctx, projectID)
	})
	if ok, err := cli.IfPermitted(err); err != nil {
		return all{}, err
	} else if ok {
		settings.sandbox = &sandbox
	}
	return settings, nil
}

// json is the project's settings as the API sent them, with the sandbox
// settings under `sandbox` (null when they cannot be read).
func (s all) json() (json.RawMessage, error) {
	sandbox := json.RawMessage("null")
	if s.sandbox != nil {
		sandbox = s.sandbox.Raw
	}
	// Spliced rather than decoded, so the server's key order and any field
	// newer than this CLI stay as they were sent.
	var compact bytes.Buffer
	if err := json.Compact(&compact, s.project.Raw); err != nil {
		return nil, err
	}
	object := strings.TrimSuffix(compact.String(), "}")
	if object != "{" {
		object += ","
	}
	return json.RawMessage(object + `"sandbox":` + string(sandbox) + "}"), nil
}

func onOff(value bool) string {
	if value {
		return "on"
	}
	return "off"
}

var sharing = map[api.PaidAccessSharingMode]string{
	"shared":   "shared: both people keep access",
	"transfer": "transfer: access moves to the person who restored it",
	"disabled": "disabled: access stays with the person who bought it",
}

var conversions = map[api.AdsKeyConversion]string{
	"signup": "signup: cost per signup",
	"trial":  "trial: cost per trial started",
	"payer":  "payer: cost per paying customer",
}

// explained is a value with what it means, or the value alone when this CLI
// does not know it.
func explained[K ~string](labels map[K]string, value K) string {
	if label, ok := labels[value]; ok {
		return label
	}
	return string(value)
}

// setting is one setting `settings set` changes.
type setting struct {
	key string
	// choices are the words it takes; empty for a number of days.
	choices []string
	// maxDays is the most days it takes, from 1, when it has no choices.
	maxDays  int
	describe string
	// read is the current value; ok is false when the caller cannot read it.
	read func(s all) (value string, ok bool)
	// reachesProduction settings change what end users of production apps
	// get, so changing one asks first.
	reachesProduction bool
	// change is the request body that sets the value, and whether it goes to
	// the sandbox's settings rather than the project's.
	change    func(value string) map[string]any
	isSandbox bool
}

func (s setting) values() string {
	if len(s.choices) > 0 {
		return strings.Join(s.choices, "|")
	}
	return fmt.Sprintf("1-%d", s.maxDays)
}

var settings = []setting{
	{
		key:               "paid-access-sharing.production",
		choices:           []string{"shared", "transfer", "disabled"},
		describe:          "When someone restores a purchase another account made, in production apps",
		read:              func(s all) (string, bool) { return string(s.project.Value.PaidAccessSharing.Production), true },
		reachesProduction: true,
		change: func(value string) map[string]any {
			return map[string]any{"paidAccessSharing": map[string]any{"production": value}}
		},
	},
	{
		key:      "paid-access-sharing.sandbox",
		choices:  []string{"shared", "transfer", "disabled"},
		describe: "The same for store sandbox purchases (TestFlight, Play test tracks)",
		read:     func(s all) (string, bool) { return string(s.project.Value.PaidAccessSharing.Sandbox), true },
		change: func(value string) map[string]any {
			return map[string]any{"paidAccessSharing": map[string]any{"sandbox": value}}
		},
	},
	{
		key:               "store-sandbox-unlocks-production",
		choices:           []string{"on", "off"},
		describe:          "Whether store sandbox purchases (TestFlight, App Review, Play test tracks) unlock access in production apps. Test purchases, such as Stripe test mode's, never do",
		read:              func(s all) (string, bool) { return onOff(s.project.Value.StoreSandbox.IsUnlockingProduction), true },
		reachesProduction: true,
		change: func(value string) map[string]any {
			return map[string]any{"storeSandbox": map[string]any{"isUnlockingProduction": value == "on"}}
		},
	},
	{
		key:      "ads-key-conversion",
		choices:  []string{"signup", "trial", "payer"},
		describe: "The conversion ad spend is measured against; reports use it for past ranges too",
		read:     func(s all) (string, bool) { return string(s.project.Value.Ads.KeyConversion), true },
		change: func(value string) map[string]any {
			return map[string]any{"ads": map[string]any{"keyConversion": value}}
		},
	},
	{
		key:      "ads-attribution-window-days",
		maxDays:  90,
		describe: "Days before a signup a touch may come and still be credited with it: the last touch from an ad within the window, else the last other touch. Signups with neither are unattributed. Reports use it for past ranges too",
		read:     func(s all) (string, bool) { return strconv.Itoa(s.project.Value.Ads.AttributionWindowDays), true },
		change: func(value string) map[string]any {
			days, _ := strconv.Atoi(value)
			return map[string]any{"ads": map[string]any{"attributionWindowDays": days}}
		},
	},
	{
		key:      "sandbox-purchasing",
		choices:  []string{"on", "off"},
		describe: "Whether debug builds of your app in development mode can simulate purchases without a real store. They use the test publishable key, and the purchases are test ones",
		read: func(s all) (string, bool) {
			if s.sandbox == nil {
				return "", false
			}
			return onOff(s.sandbox.Value.IsPurchasingEnabled), true
		},
		change:    func(value string) map[string]any { return map[string]any{"isPurchasingEnabled": value == "on"} },
		isSandbox: true,
	},
}

// settingsList is every setting with the values it takes, one per line.
func settingsList() string {
	lines := make([]string, len(settings))
	for index, one := range settings {
		lines[index] = "  " + one.key + " " + one.values()
	}
	return strings.Join(lines, "\n")
}

func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "view",
		Short:   "Show the project's settings: restored purchases, store sandbox, simulated purchases and ads.",
		Example: "voidhash settings view\nvoidhash settings view --json",
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		current, err := read(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		if *asJSON {
			raw, err := current.json()
			if err != nil {
				return err
			}
			return app.PrintJSON(raw)
		}
		values := current.project.Value
		unlocks := "off: they unlock access only in apps using the test key"
		if values.StoreSandbox.IsUnlockingProduction {
			unlocks = "on: they unlock access in production apps too"
		}
		purchasing := "not shown: your role cannot read the sandbox"
		if current.sandbox != nil {
			purchasing = "off: debug builds cannot simulate purchases"
			if current.sandbox.Value.IsPurchasingEnabled {
				purchasing = "on: debug builds can simulate purchases; play store events with 'voidhash sandbox'"
			}
		}
		window := values.Ads.AttributionWindowDays
		days := "days"
		if window == 1 {
			days = "day"
		}
		app.Println(cli.PrintableLines(strings.Join([]string{
			"Settings of " + target.Label(),
			"",
			"Restored purchases: when someone restores a purchase another account of your app made",
			cli.FormatFields([]cli.Field{
				{Label: "paid-access-sharing.production", Value: explained(sharing, values.PaidAccessSharing.Production)},
				{Label: "paid-access-sharing.sandbox", Value: explained(sharing, values.PaidAccessSharing.Sandbox)},
			}),
			"",
			"Store sandbox: TestFlight, App Review and Play test track purchases (test purchases, such as Stripe test mode's, never unlock production)",
			cli.FormatFields([]cli.Field{{Label: "store-sandbox-unlocks-production", Value: unlocks}}),
			"",
			"Simulated purchases: debug builds in development mode buy without a real store, with the test publishable key, and record test purchases",
			cli.FormatFields([]cli.Field{{Label: "sandbox-purchasing", Value: purchasing}}),
			"",
			"Ads",
			cli.FormatFields([]cli.Field{
				{Label: "ads-key-conversion", Value: explained(conversions, values.Ads.KeyConversion)},
				{Label: "ads-attribution-window-days", Value: fmt.Sprintf("%d: a signup is credited to the last touch from an ad in the %d %s before it, else the last other touch", window, window, days)},
			}),
		}, "\n")))
		app.Notef("\nChange one with 'voidhash settings set <key> <value>'.")
		return nil
	}
	return cmd
}

func newSet(app *cli.App) *cobra.Command {
	keys := make([]string, len(settings))
	for index, one := range settings {
		keys[index] = one.key
	}
	cmd := &cobra.Command{
		Use:   "set",
		Short: "Change one setting.",
		Long: "Change one setting. Settings that change what production apps get ask first; --yes skips that. The settings and their values:\n\n" +
			settingsList(),
		Example: `voidhash settings set ads-key-conversion trial
voidhash settings set paid-access-sharing.production shared --yes`,
	}
	cli.SetArgs(cmd,
		cli.Arg{Name: "key", Help: "The setting: " + strings.Join(keys, ", "), Optional: true},
		cli.Arg{Name: "value", Help: "Its new value", Optional: true},
	)
	cmd.ValidArgsFunction = func(_ *cobra.Command, args []string, _ string) ([]string, cobra.ShellCompDirective) {
		switch len(args) {
		case 0:
			return keys, cobra.ShellCompDirectiveNoFileComp
		case 1:
			for _, one := range settings {
				if one.key == args[0] {
					return one.choices, cobra.ShellCompDirectiveNoFileComp
				}
			}
		}
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		const usage = "voidhash settings set <key> <value>"
		var passedKey *string
		if key := cli.ArgAt(args, 0); key != "" {
			passedKey = &key
		}
		keyChoices := make([]cli.Choice[string], len(keys))
		for index, key := range keys {
			keyChoices[index] = cli.Choice[string]{Title: key, Value: key}
		}
		name, err := cli.RequireChoice(ctx, app, passedKey, cli.ChoicePrompt[string]{
			What: "the setting", Message: "Which setting?", Usage: usage, Choices: keyChoices,
		})
		if err != nil {
			return err
		}
		index := slices.IndexFunc(settings, func(one setting) bool { return one.key == name })
		if index < 0 {
			return cli.Usagef("There is no setting %s. The settings are:\n%s", name, settingsList())
		}
		chosen := settings[index]

		valueUsage := fmt.Sprintf("voidhash settings set %s <%s>", name, chosen.values())
		wanted := cli.ArgAt(args, 1)
		if len(chosen.choices) > 0 {
			var passedValue *string
			if wanted != "" {
				passedValue = &wanted
			}
			valueChoices := make([]cli.Choice[string], len(chosen.choices))
			for index, choice := range chosen.choices {
				valueChoices[index] = cli.Choice[string]{Title: choice, Value: choice}
			}
			wanted, err = cli.RequireChoice(ctx, app, passedValue, cli.ChoicePrompt[string]{
				What: "the value", Message: chosen.describe, Usage: valueUsage, Choices: valueChoices,
			})
			if err != nil {
				return err
			}
			if !slices.Contains(chosen.choices, wanted) {
				return cli.Usagef("%s is one of %s, not %s.", name, strings.Join(chosen.choices, ", "), wanted)
			}
		} else {
			days := func(answer string) (string, error) {
				number, err := strconv.Atoi(answer)
				if err != nil || number < 1 || number > chosen.maxDays || strings.TrimLeft(answer, "0123456789") != "" {
					return "", cli.Usagef("%s is a whole number of days from 1 to %d, not %s.", name, chosen.maxDays, answer)
				}
				return strconv.Itoa(number), nil
			}
			wanted, err = app.RequireText(ctx, wanted, cli.TextPrompt{
				What: "the value", Message: chosen.describe, Usage: valueUsage, Validate: days,
			})
			if err != nil {
				return err
			}
			// A value passed as an argument was not validated by the prompt.
			if wanted, err = days(wanted); err != nil {
				return err
			}
		}

		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		current, err := read(ctx, app, projectID)
		if err != nil {
			return err
		}
		printJSON := func(s all) error {
			raw, err := s.json()
			if err != nil {
				return err
			}
			return app.PrintJSON(raw)
		}
		before, known := chosen.read(current)
		if !known {
			before = "?"
		}
		if known && before == wanted {
			if *asJSON {
				return printJSON(current)
			}
			app.Println(fmt.Sprintf("%s is already %s; nothing changed.", name, wanted))
			return nil
		}
		if chosen.reachesProduction {
			question := fmt.Sprintf("Change %s of %s from %s to %s? It changes what end users of your production apps get from their next purchase or restore.", name, target.Label(), before, wanted)
			if err := app.ConfirmChange(ctx, *yes, question); err != nil {
				return err
			}
		}
		body, err := json.Marshal(chosen.change(wanted))
		if err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			if chosen.isSandbox {
				return c.SandboxUpdateSettingsWithBody(ctx, projectID, "application/json", bytes.NewReader(body))
			}
			return c.ProjectsUpdateSettingsWithBody(ctx, projectID, "application/json", bytes.NewReader(body))
		}); err != nil {
			return err
		}
		if *asJSON {
			changed, err := read(ctx, app, projectID)
			if err != nil {
				return err
			}
			return printJSON(changed)
		}
		app.Println(fmt.Sprintf("%s: %s → %s. %s.", name, before, wanted, chosen.describe))
		return nil
	}
	return cmd
}
