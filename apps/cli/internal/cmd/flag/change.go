package flag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/flags"
)

const createUsage = "voidhash flag create --key <key> [--type <type> --variant <value>…]"

// newCreate creates `voidhash flag create [--key] [--type] [--variant]… [--description] [--rollout]`.
func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a feature flag, off until you turn it on.",
		Long: `Create a feature flag, off until you turn it on. A boolean flag is on or off; a string, number or json flag hands out the values you give with --variant, split evenly.

--rollout turns it on in production right away for that share of end users.`,
		Example: `voidhash flag create --key new-checkout
voidhash flag create --key new-checkout --rollout 10%
voidhash flag create --key button-color --type string --variant red --variant blue
voidhash flag create --key limits --type json --variant '{"max":5}' --variant '{"max":10}'`,
	}
	key := cmd.Flags().String("key", "", "What your app asks for, such as new-checkout")
	flagType := cli.AddChoiceFlag(cmd, "type", "", []string{"boolean", "string", "number", "json"}, "",
		"Its type: boolean (on or off; the default), or string, number or json variants")
	variantValues := cli.AddStringsFlag(cmd, "variant", "", "A `value` the flag can hand out (not for boolean)")
	description := cmd.Flags().String("description", "", "What the flag is for")
	rollout := cmd.Flags().String("rollout", "", "Turn it on in production right away for this `share` of end users, such as 10%")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		// Everything typed is read before anything is asked or created.
		kind := *flagType
		if kind == "" {
			kind = "boolean"
		}
		if kind == "boolean" && len(*variantValues) > 0 {
			return cli.Usagef("A boolean flag is on or off; it has no variants.").
				WithHint("Pass --type string, number or json for variants.")
		}
		if kind != "boolean" && len(*variantValues) == 0 {
			return cli.Usagef("A %s flag needs the values it hands out.", kind).
				WithHint("Pass --variant for each, such as: " + createUsage)
		}
		var share *float64
		if *rollout != "" {
			parsed, err := parsePercent(*rollout)
			if err != nil {
				return err
			}
			share = &parsed
		}
		type newVariant struct {
			Value json.RawMessage `json:"value"`
		}
		request := struct {
			Key         string       `json:"key"`
			Type        string       `json:"type"`
			Description string       `json:"description,omitempty"`
			Variants    []newVariant `json:"variants,omitempty"`
		}{Type: kind, Description: *description}
		for _, input := range *variantValues {
			value, err := parseValue(kind, input)
			if err != nil {
				return err
			}
			request.Variants = append(request.Variants, newVariant{Value: value})
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		if request.Key, err = app.RequireText(ctx, *key, cli.TextPrompt{
			What: "--key", Message: "Key, as your app asks for it", Usage: createUsage,
		}); err != nil {
			return err
		}
		body, err := json.Marshal(request)
		if err != nil {
			return err
		}
		created, err := cli.Fetch[flags.Flag](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsCreateWithBody(ctx, projectID, "application/json", bytes.NewReader(body))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{"feature_flag_key_taken": keyTakenHint(request.Key)})
		}
		if share != nil {
			config := created.Value.Environments.Production
			config.IsEnabled = true
			config.Fallthrough.RolloutPercentage = *share
			turnedOn, err := setEnvironment(ctx, app, projectID, created.Value.ID, "production", config)
			if err != nil {
				// The flag exists; only turning it on failed.
				app.Warnf("Created %s (%s), but it could not be turned on, so it is off: 'voidhash flag enable %s --rollout %s' tries again.",
					cli.Printable(created.Value.Key), created.Value.ID, cli.Printable(created.Value.Key), flags.Percent(*share))
				return err
			}
			created = turnedOn
		}
		flag := created.Value
		lines := []string{fmt.Sprintf("Created %s: %s.", flag.Key, flagState(flag))}
		if !flag.Environments.Production.IsEnabled {
			lines = append(lines,
				"Next:",
				fmt.Sprintf("  Try it yourself first: 'voidhash flag override %s <your email> on'", flag.Key),
				fmt.Sprintf("  Turn it on for test builds only: 'voidhash flag enable %s --rollout 100%% --env test'", flag.Key),
				fmt.Sprintf("  Turn it on for some end users: 'voidhash flag enable %s --rollout 10%%'", flag.Key),
			)
		}
		return app.PrintItem(mode, created, strings.Join(lines, "\n"))
	}
	return cmd
}

// stateChange is what enable, disable and rollout ask of an environment.
type stateChange struct {
	project, flag, env, usage string
	yes                       bool
	output                    *cli.OutputFlags
	// change says what the environment should be, given what it is.
	change func(ctx context.Context, config flags.Environment) (isEnabled bool, rolloutPercentage float64, err error)
}

// changeState changes an environment's switch or the share everyone else
// gets, keeping its overrides and rules. In production it confirms first
// when end users lose the flag: turning it off, or lowering the share.
func changeState(ctx context.Context, app *cli.App, options stateChange) error {
	mode, err := options.output.Mode()
	if err != nil {
		return err
	}
	target, err := app.ResolveProject(ctx, options.project)
	if err != nil {
		return err
	}
	projectID := target.Project.Id
	found, err := requireFlag(ctx, app, projectID, options.flag, options.usage)
	if err != nil {
		return err
	}
	flag := found.Value
	if flag.ExperimentID != nil {
		return managedByExperiment(flag, "Change it through the experiment: 'voidhash experiment view %s'.")
	}
	before := flag.In(options.env)
	wantEnabled, wantShare, err := options.change(ctx, before)
	if err != nil {
		return err
	}
	share := before.Fallthrough.RolloutPercentage
	// Production's end users are real ones; test's are whoever runs a build with a test key.
	if options.env == "production" && before.IsEnabled {
		alsoTest := ""
		if flag.Environments.Test == nil {
			alsoTest = " Test follows production, so it changes too."
		}
		question := ""
		switch {
		case !wantEnabled:
			question = fmt.Sprintf("Turn %s off in production in %s? Everyone who has it now loses it, overrides included.%s", flag.Key, target.Label(), alsoTest)
		case wantShare < share:
			question = fmt.Sprintf("Lower %s from %s to %s in production in %s? End users between the two lose it.%s",
				flag.Key, flags.Percent(share), flags.Percent(wantShare), target.Label(), alsoTest)
		}
		if question != "" {
			if err := app.ConfirmChange(ctx, options.yes, question); err != nil {
				return err
			}
		}
	}
	if before.IsEnabled == wantEnabled && share == wantShare {
		return app.PrintItem(mode, found, fmt.Sprintf("%s already is %s in %s; nothing changed.", flag.Key, environmentState(before), options.env))
	}
	config := before
	config.IsEnabled = wantEnabled
	config.Fallthrough.RolloutPercentage = wantShare
	updated, err := setEnvironment(ctx, app, projectID, flag.ID, options.env, config)
	if err != nil {
		return err
	}
	after := updated.Value.In(options.env)
	lines := []string{fmt.Sprintf("%s in %s: %s → %s.", updated.Value.Key, options.env, environmentState(before), environmentState(after))}
	if options.env == "test" && flag.Environments.Test == nil {
		lines = append(lines, testSplitsOff(flag))
	}
	if after.IsEnabled && after.Fallthrough.RolloutPercentage == 0 && len(after.Rules) == 0 {
		lines = append(lines, fmt.Sprintf("At 0%% only end users with an override get it: 'voidhash flag rollout %s 10%%%s'", updated.Value.Key, envSuffix(options.env)))
	}
	return app.PrintItem(mode, updated, strings.Join(lines, "\n"))
}

// newEnable creates `voidhash flag enable [flag] [--rollout] [--env]`.
func newEnable(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "enable",
		Short: "Turn a flag on, optionally for a share of end users.",
		Long:  "Turn a flag on in production, or in test with --env test, optionally for a share of end users. Its overrides and rules stay. Lowering the share of a flag that is already on in production asks first; --yes skips that.",
		Example: `voidhash flag enable new-checkout --rollout 10%
voidhash flag enable new-checkout --rollout 100% --env test`,
	}
	cli.SetArgs(cmd, flagArg)
	project := cli.AddProjectFlag(cmd)
	env := addEnvFlag(cmd)
	rollout := cmd.Flags().String("rollout", "", "The `share` of end users who get it, such as 25% (default: as it was)")
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		// A share that cannot be read fails before anything is looked up.
		var share *float64
		if *rollout != "" {
			parsed, err := parsePercent(*rollout)
			if err != nil {
				return err
			}
			share = &parsed
		}
		return changeState(cmd.Context(), app, stateChange{
			project: *project, flag: cli.ArgAt(args, 0), env: *env, yes: *yes, output: output,
			usage: "voidhash flag enable <flag> [--rollout 25%] [--env test]",
			change: func(_ context.Context, config flags.Environment) (bool, float64, error) {
				if share != nil {
					return true, *share, nil
				}
				return true, config.Fallthrough.RolloutPercentage, nil
			},
		})
	}
	return cmd
}

// newDisable creates `voidhash flag disable [flag] [--env] [--yes]`.
func newDisable(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "disable",
		Short: "Turn a flag off for everyone in an environment.",
		Long:  "Turn a flag off for everyone in an environment, overrides included. Its share, overrides and rules are kept for when it is turned on again. In production it asks first; --yes skips that.",
		Example: `voidhash flag disable new-checkout --yes
voidhash flag disable new-checkout --env test`,
	}
	cli.SetArgs(cmd, flagArg)
	project := cli.AddProjectFlag(cmd)
	env := addEnvFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		return changeState(cmd.Context(), app, stateChange{
			project: *project, flag: cli.ArgAt(args, 0), env: *env, yes: *yes, output: output,
			usage: "voidhash flag disable <flag> --yes",
			change: func(_ context.Context, config flags.Environment) (bool, float64, error) {
				return false, config.Fallthrough.RolloutPercentage, nil
			},
		})
	}
	return cmd
}

// newRollout creates `voidhash flag rollout [flag] [percent] [--env]`.
func newRollout(app *cli.App) *cobra.Command {
	const usage = "voidhash flag rollout <flag> <percent>"
	cmd := &cobra.Command{
		Use:   "rollout",
		Short: "Set the share of end users who get a flag.",
		Long:  "Set the share of the end users no rule matches who get a flag. Lowering it in production asks first; --yes skips that. A flag that is off stays off.",
		Example: `voidhash flag rollout new-checkout 50%
voidhash flag rollout new-checkout 10% --yes
voidhash flag rollout new-checkout 100% --env test`,
	}
	cli.SetArgs(cmd, flagArg, cli.Arg{Name: "percent", Help: "The share of end users who get it, such as 25%", Optional: true})
	project := cli.AddProjectFlag(cmd)
	env := addEnvFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		typed := cli.ArgAt(args, 1)
		if typed != "" {
			if _, err := parsePercent(typed); err != nil {
				return err
			}
		}
		return changeState(cmd.Context(), app, stateChange{
			project: *project, flag: cli.ArgAt(args, 0), env: *env, yes: *yes, output: output, usage: usage,
			change: func(ctx context.Context, config flags.Environment) (bool, float64, error) {
				input, err := app.RequireText(ctx, typed, cli.TextPrompt{
					What: "<percent>", Message: "Share of end users, such as 25%", Usage: usage,
					Initial: flags.Percent(config.Fallthrough.RolloutPercentage),
					Validate: func(answer string) (string, error) {
						_, err := parsePercent(answer)
						return answer, err
					},
				})
				if err != nil {
					return false, 0, err
				}
				share, err := parsePercent(input)
				return config.IsEnabled, share, err
			},
		})
	}
	return cmd
}

// newEdit creates `voidhash flag edit [flag] [--key] [--description]`.
func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Change a flag's key or description.",
		Long:  "Change a flag's key or description. A new key asks first, since apps asking for the old one stop getting the flag; --yes skips that.",
		Example: `voidhash flag edit new-checkout --description "The one-page checkout"
voidhash flag edit new-checkout --key checkout-v2 --yes`,
	}
	cli.SetArgs(cmd, flagArg)
	project := cli.AddProjectFlag(cmd)
	key := cmd.Flags().String("key", "", "Its new key")
	description := cmd.Flags().String("description", "", "What it is for; an empty string clears it")
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if !cli.Changed(cmd, "key") && !cli.Changed(cmd, "description") {
			return cli.Usagef("Nothing to change.").WithHint("Pass --key or --description.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		found, err := requireFlag(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash flag edit <flag> --key <key>")
		if err != nil {
			return err
		}
		flag := found.Value
		request := map[string]any{}
		newKey := flag.Key
		if cli.Changed(cmd, "key") && *key != flag.Key {
			newKey = *key
			request["key"] = newKey
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
				"Change the key of %s to %s? Apps asking for %s, including versions already released, stop getting it.", flag.Key, newKey, flag.Key)); err != nil {
				return err
			}
		}
		if cli.Changed(cmd, "description") {
			request["description"] = nil
			if *description != "" {
				request["description"] = *description
			}
		}
		body, err := json.Marshal(request)
		if err != nil {
			return err
		}
		updated, err := cli.Fetch[flags.Flag](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsUpdateWithBody(ctx, target.Project.Id, flag.ID, "application/json", bytes.NewReader(body))
		})
		if err != nil {
			experiment := ""
			if flag.ExperimentID != nil {
				experiment = *flag.ExperimentID
			}
			return cli.APIError(err, map[string]string{
				"feature_flag_key_taken":             keyTakenHint(newKey),
				"feature_flag_managed_by_experiment": fmt.Sprintf("Change it through its experiment: 'voidhash experiment view %s'.", experiment),
			})
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("Updated %s.", updated.Value.Key))
	}
	return cmd
}

// newVariantsSet creates `voidhash flag variants set [flag] [value]…`.
func newVariantsSet(app *cli.App) *cobra.Command {
	const usage = "voidhash flag variants set <flag> <value>…"
	cmd := &cobra.Command{
		Use:   "set",
		Short: "Set exactly the values a flag hands out.",
		Long:  "Set exactly the values a flag hands out, split evenly. A value you keep keeps its end users. Removing one asks first, since its end users move to the other variants; --yes skips that.",
		Example: `voidhash flag variants set button-color red blue green
voidhash flag variants set button-color red green --yes`,
	}
	cli.SetArgs(cmd, flagArg, cli.Arg{Name: "value", Help: "Every value the flag should hand out", Optional: true, Variadic: true})
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
		found, err := requireFlag(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		flag := found.Value
		if flag.Type == "boolean" {
			return cli.Usagef("%s is a boolean flag, which has no variants.", flag.Key).
				WithHint("Create a string, number or json flag for variants: 'voidhash flag create --type string'.")
		}
		if len(args) < 2 {
			return cli.Usagef("Missing the values.").WithHint("Run it as: " + usage)
		}
		current, err := listVariants(ctx, app, projectID, flag.ID)
		if err != nil {
			return err
		}
		// A variant whose value stays keeps its id, so its end users stay in it.
		kept := map[string]bool{}
		wanted := make([]map[string]any, 0, len(args)-1)
		for _, input := range args[1:] {
			value, err := parseValue(flag.Type, input)
			if err != nil {
				return err
			}
			entry := map[string]any{"value": value}
			for _, existing := range current.Items {
				if formatValue(existing.Value) == formatValue(value) {
					entry["id"], entry["label"] = existing.ID, existing.Label
					kept[existing.ID] = true
					break
				}
			}
			wanted = append(wanted, entry)
		}
		var removed []variant
		for _, existing := range current.Items {
			if !kept[existing.ID] {
				removed = append(removed, existing)
			}
		}
		if len(removed) > 0 {
			them := "them"
			if len(removed) == 1 {
				them = "it"
			}
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Remove %s from %s in %s? End users in %s move to the other variants.",
				variantLabels(removed), flag.Key, target.Label(), them)); err != nil {
				return err
			}
		}
		body, err := json.Marshal(map[string]any{"variants": wanted})
		if err != nil {
			return err
		}
		after, _, err := cli.FetchPage[variant](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsReplaceVariantsWithBody(ctx, projectID, flag.ID, "application/json", bytes.NewReader(body))
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(after)
		case cli.Quiet:
			app.PrintIDs(after)
			return nil
		}
		shares := make([]string, len(after.Items))
		for index, one := range after.Items {
			shares[index] = variantLabel(one) + " " + flags.Percent(one.WeightPercentage)
		}
		app.Println(cli.Printable(fmt.Sprintf("%s now hands out %s, split evenly.", flag.Key, strings.Join(shares, ", "))))
		return nil
	}
	return cmd
}

// newFollow creates `voidhash flag follow [flag] [--yes]`.
func newFollow(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "follow",
		Short:   "Make a flag's test follow production again.",
		Long:    "Drop test's own configuration of a flag, so apps using a test key get production's answers again. Asks first; --yes skips that.",
		Example: "voidhash flag follow new-checkout --yes",
	}
	cli.SetArgs(cmd, flagArg)
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
		found, err := requireFlag(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash flag follow <flag> --yes")
		if err != nil {
			return err
		}
		flag := found.Value
		test := flag.Environments.Test
		if test == nil {
			return app.PrintItem(mode, found, fmt.Sprintf("%s's test already follows production; nothing changed.", flag.Key))
		}
		production := environmentState(flag.Environments.Production)
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
			"Make %s's test follow production again in %s? Test's own configuration (%s, %s) is dropped, and apps using a test key get production's answers (%s).",
			flag.Key, target.Label(), environmentState(*test), plural(len(test.Overrides), "override"), production)); err != nil {
			return err
		}
		if err := clearTest(ctx, app, projectID, flag.ID); err != nil {
			experiment := ""
			if flag.ExperimentID != nil {
				experiment = *flag.ExperimentID
			}
			return cli.APIError(err, map[string]string{
				"feature_flag_managed_by_experiment": fmt.Sprintf("An experiment's flag has one configuration: 'voidhash experiment view %s'.", experiment),
			})
		}
		return printFlagAfter(ctx, app, mode, projectID, found, fmt.Sprintf("%s: test follows production again (%s).", flag.Key, production))
	}
	return cmd
}

func clearTest(ctx context.Context, app *cli.App, projectID, flagID string) error {
	return cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.FeatureFlagsClearEnvironment(ctx, projectID, flagID, api.FeatureFlagEnvironmentName("test"))
	})
}

// printFlagAfter prints a flag after a change whose answer was not the flag
// itself. --json reads it again, so scripts get it as the API has it now.
func printFlagAfter(ctx context.Context, app *cli.App, mode cli.OutputMode, projectID string, before cli.Object[flags.Flag], human string) error {
	if mode != cli.JSON {
		return app.PrintItem(mode, before, human)
	}
	after, err := getFlag(ctx, app, projectID, before.Value.ID)
	if err != nil {
		return err
	}
	return app.PrintJSON(after)
}

// newPromote creates `voidhash flag promote [flag] [--yes]`.
func newPromote(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "promote",
		Short:   "Apply a flag's test configuration to production.",
		Long:    "Apply a flag's test configuration (its switch, share, overrides and rules) to production, then let test follow production again. Asks first; --yes skips that.",
		Example: "voidhash flag promote new-checkout --yes",
	}
	cli.SetArgs(cmd, flagArg)
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
		found, err := requireFlag(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash flag promote <flag> --yes")
		if err != nil {
			return err
		}
		flag := found.Value
		test := flag.Environments.Test
		if test == nil {
			return app.PrintItem(mode, found, fmt.Sprintf("%s's test follows production, so there is nothing to apply.", flag.Key))
		}
		production := flag.Environments.Production
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
			"Apply %s's test configuration to production in %s? Production goes from %s to %s, and test's %s and %s replace production's. Test then follows production.",
			flag.Key, target.Label(), environmentState(production), environmentState(*test),
			plural(len(test.Overrides), "override"), plural(len(test.Rules), "rule"))); err != nil {
			return err
		}
		applied, err := setEnvironment(ctx, app, projectID, flag.ID, "production", *test)
		if err != nil {
			experiment := ""
			if flag.ExperimentID != nil {
				experiment = *flag.ExperimentID
			}
			return cli.APIError(err, map[string]string{
				"feature_flag_managed_by_experiment": fmt.Sprintf("An experiment's flag changes through it: 'voidhash experiment view %s'.", experiment),
			})
		}
		if err := clearTest(ctx, app, projectID, flag.ID); err != nil {
			// Production has changed; say what is left to do rather than only that it failed.
			app.Warnf("Production now has test's configuration, but test still has its own: 'voidhash flag follow %s --yes' finishes it.", cli.Printable(flag.Key))
			return err
		}
		return printFlagAfter(ctx, app, mode, projectID, applied, fmt.Sprintf("%s in production: %s → %s. Test follows production again.",
			flag.Key, environmentState(production), environmentState(applied.Value.Environments.Production)))
	}
	return cmd
}

// newArchive creates `voidhash flag archive [flag] [--yes]`.
func newArchive(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "archive",
		Short:   "Archive a flag you no longer use.",
		Long:    "Archive a flag you no longer use: apps stop receiving it. Asks first when it is on; --yes skips that. 'voidhash flag restore' brings it back as it was.",
		Example: "voidhash flag archive old-banner",
	}
	cli.SetArgs(cmd, flagArg)
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
		inUse, err := flags.List(ctx, app, target.Project.Id, false)
		if err != nil {
			return err
		}
		flag, err := cli.RequireItem(ctx, app, flags.Kind, inUse.Items, cli.ArgAt(args, 0), "voidhash flag archive <flag> --yes")
		if err != nil {
			return err
		}
		test := flag.Environments.Test
		if flag.Environments.Production.IsEnabled || (test != nil && test.IsEnabled) {
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
				"Archive %s in %s? It is %s in production and test %s; apps stop receiving it, so everyone who has it loses it.",
				flag.Key, target.Label(), flagState(flag), testState(flag))); err != nil {
				return err
			}
		}
		archived, err := cli.Fetch[flags.Flag](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsArchive(ctx, target.Project.Id, flag.ID)
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, archived, fmt.Sprintf("Archived %s. Bring it back with 'voidhash flag restore %s'.", archived.Value.Key, archived.Value.Key))
	}
	return cmd
}

// newRestore creates `voidhash flag restore [flag]`.
func newRestore(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "restore",
		Short:   "Bring back an archived flag as it was.",
		Example: "voidhash flag restore old-banner",
	}
	cli.SetArgs(cmd, flagArg)
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
		archived, err := flags.List(ctx, app, target.Project.Id, true)
		if err != nil {
			return err
		}
		kind := flags.Kind
		kind.ListCommand, kind.CreateCommand = "voidhash flag list --archived", ""
		flag, err := cli.RequireItem(ctx, app, kind, archived.Items, cli.ArgAt(args, 0), "voidhash flag restore <flag>")
		if err != nil {
			return err
		}
		restored, err := cli.Fetch[flags.Flag](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsUnarchive(ctx, target.Project.Id, flag.ID)
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, restored, fmt.Sprintf("Restored %s: %s.", restored.Value.Key, flagState(restored.Value)))
	}
	return cmd
}
