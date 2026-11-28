package experiment

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/flags"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

const metricUsage = "The `event` that counts as a conversion (default: " + defaultMetric + "); fixed once it starts"

// replaceArms sets exactly the arms of an experiment.
func replaceArms(ctx context.Context, app *cli.App, projectID, experimentID string, variants []newArm) error {
	body, err := json.Marshal(map[string]any{"variants": variants})
	if err != nil {
		return err
	}
	return cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ExperimentsReplaceVariantsWithBody(ctx, projectID, experimentID, "application/json", bytes.NewReader(body))
	})
}

// updateExperiment changes the fields of an experiment that were passed.
func updateExperiment(ctx context.Context, app *cli.App, projectID, experimentID string, changes map[string]any) (cli.Object[experiment], error) {
	body, err := json.Marshal(changes)
	if err != nil {
		return cli.Object[experiment]{}, err
	}
	return cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ExperimentsUpdateWithBody(ctx, projectID, experimentID, "application/json", bytes.NewReader(body))
	})
}

// newCreate creates `voidhash experiment create [--name] [--hypothesis] [--metric] [--arm]…`.
func newCreate(app *cli.App) *cobra.Command {
	const usage = "voidhash experiment create --name <name> " + armsUsage
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Set up an experiment as a draft, optionally with its arms.",
		Long: `Set up an experiment as a draft, optionally with its arms. Nothing changes for end users until it is started.

An arm shows a paywall at a paywall location (--arm NAME=PAYWALL with --location, or NAME=LOCATION:PAYWALL), gives feature flags a value (--flag KEY=VALUE,VALUE, one value per arm), or both. The first arm is the control unless --control names another.`,
		Example: `voidhash experiment create --name "Annual-first onboarding" --arm 'Control=monthly' --arm 'Annual first=annual' --location onboarding-end
voidhash experiment create --name "New checkout" --arm Control --arm 'New checkout' --flag 'new-checkout=off,on' --weights 80,20
voidhash experiment create --name "Pricing page" --hypothesis "Annual first lifts trials" --metric trial_started`,
	}
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "Its name, such as Annual-first onboarding")
	hypothesis := cmd.Flags().String("hypothesis", "", "What you expect to happen")
	metric := cmd.Flags().String("metric", "", metricUsage)
	given := addArmFlags(cmd)
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
		projectID := target.Project.Id
		experimentName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name", Usage: usage})
		if err != nil {
			return err
		}
		// Find the paywalls and flags first, so a typo creates nothing.
		var variants []newArm
		if given.given() {
			if variants, _, err = parseArms(ctx, app, projectID, given, nil); err != nil {
				return err
			}
		}
		created, err := cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsCreate(ctx, projectID, api.CreateExperimentBodyJsonEncoding{Name: experimentName})
		})
		if err != nil {
			return err
		}
		// The draft exists from here on: a later failure says so, and how to finish it.
		unfinished := func(err error) error {
			app.Warnf("Created %s (%s) as a draft, but setting it up failed; finish it with 'voidhash experiment edit %s'.",
				cli.Printable(created.Value.Name), created.Value.ID, created.Value.ID)
			return err
		}
		changes := map[string]any{}
		if *hypothesis != "" {
			changes["hypothesis"] = *hypothesis
		}
		if *metric != "" {
			changes["primaryMetricEventName"] = *metric
		}
		if len(changes) > 0 {
			if created, err = updateExperiment(ctx, app, projectID, created.Value.ID, changes); err != nil {
				return unfinished(err)
			}
		}
		if variants != nil {
			if err := replaceArms(ctx, app, projectID, created.Value.ID, variants); err != nil {
				return unfinished(err)
			}
		}
		id := created.Value.ID
		lines := []string{fmt.Sprintf("Created %s as a draft.", created.Value.Name), "Next:"}
		if variants == nil {
			lines = append(lines,
				fmt.Sprintf("  Give each arm a paywall: 'voidhash experiment edit %s %s'", id, armsUsage),
				fmt.Sprintf("  Or a value for a flag: 'voidhash experiment edit %s %s'", id, flagsUsage),
			)
		}
		lines = append(lines, fmt.Sprintf("  Start it: 'voidhash experiment start %s'", id))
		return app.PrintItem(mode, created, strings.Join(lines, "\n"))
	}
	return cmd
}

// newEdit creates `voidhash experiment edit [experiment] [--name] [--hypothesis] [--metric] [--arm]…`.
func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Change an experiment's name, hypothesis, metrics or arms.",
		Long: `Change an experiment's name, description, hypothesis, metrics (while it is a draft) or arms (not while it runs).

--arm and --flag describe the arms whole and replace them: an arm kept by its name keeps its end users. Replacing the arms of an experiment that has started asks first; --yes skips that.`,
		Example: `voidhash experiment edit "Annual-first onboarding" --name "Annual first"
voidhash experiment edit exp_123 --arm 'Control=monthly' --arm 'Annual first=annual' --location onboarding-end
voidhash experiment edit exp_123 --arm Control --arm 'New checkout' --flag 'new-checkout=off,on'
voidhash experiment edit exp_123 --metric trial_started --secondary-metric purchase_completed`,
	}
	cli.SetArgs(cmd, experimentArg)
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "Its new name")
	description := cmd.Flags().String("description", "", "What it is for")
	hypothesis := cmd.Flags().String("hypothesis", "", "What you expect to happen")
	metric := cmd.Flags().String("metric", "", metricUsage)
	secondary := cli.AddStringsFlag(cmd, "secondary-metric", "", "Another `event` to track; fixed once it starts")
	given := addArmFlags(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		changes := map[string]any{}
		for flag, field := range map[string]struct {
			name  string
			value *string
		}{
			"name": {"name", name}, "description": {"description", description},
			"hypothesis": {"hypothesis", hypothesis}, "metric": {"primaryMetricEventName", metric},
		} {
			if cli.Changed(cmd, flag) {
				changes[field.name] = *field.value
			}
		}
		if len(*secondary) > 0 {
			changes["secondaryMetricEventNames"] = *secondary
		}
		// The arms are given whole, so a --flag comes with every --arm it gives a value.
		changesArms := given.given()
		if *given.weights != "" && len(*given.arm) == 0 {
			// Shares are read in the order of --arm; alone they would be dropped.
			return cli.Usagef("--weights sets the shares of the arms --arm describes, so it cannot be passed without them.").
				WithHint("Describe the arms whole, such as --arm 'Control=monthly' --arm 'Annual first=annual' --weights 60,40; 'voidhash experiment view <experiment>' shows them as they are.")
		}
		if len(changes) == 0 && !changesArms {
			return cli.Usagef("Nothing to change.").
				WithHint("Pass --name, --description, --hypothesis, --metric, --secondary-metric, or --arm with --location or --flag.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		object, err := requireExperiment(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash experiment edit <experiment> --name <name>")
		if err != nil {
			return err
		}
		found := object.Value
		changesMetrics := cli.Changed(cmd, "metric") || len(*secondary) > 0
		if changesMetrics && found.Status != "draft" {
			return cli.Failf("%s is %s, so what counts as a conversion is fixed.", found.Name, found.Status).
				WithHint("Changing it mid-test would make the results meaningless; create a new experiment to measure another event.")
		}
		if changesArms && found.Status == "running" {
			return cli.Failf("%s is running, so its arms are locked.", found.Name).
				WithHint(fmt.Sprintf("Pause it first: 'voidhash experiment pause %s'.", found.ID))
		}
		if changesArms && (found.Status == "concluded" || found.IsArchived) {
			if found.IsArchived {
				return cli.Failf("%s is archived, so its arms cannot change.", found.Name).
					WithHint(fmt.Sprintf("Restore it first: 'voidhash experiment restore %s'.", found.ID))
			}
			return cli.Failf("%s has concluded, so its arms can no longer change: they are the record of what it compared.", found.Name).
				WithHint("Create a new experiment to test other arms.")
		}
		var variants []newArm
		if changesArms {
			existing, err := armsOf(ctx, app, projectID, found.ID)
			if err != nil {
				return err
			}
			var removed []arm
			if variants, removed, err = parseArms(ctx, app, projectID, given, existing.Items); err != nil {
				return err
			}
			if found.Status != "draft" {
				moved := ""
				if len(removed) > 0 {
					names := make([]string, len(removed))
					for index, one := range removed {
						names[index] = one.Name
					}
					moved = fmt.Sprintf(" End users in %s move to another arm.", strings.Join(names, ", "))
				}
				if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Replace the arms of %s in %s, which is %s?%s Arms kept by name keep their end users.",
					found.Name, target.Label(), found.Status, moved)); err != nil {
					return err
				}
			}
		}
		updated := object
		if len(changes) > 0 {
			if updated, err = updateExperiment(ctx, app, projectID, found.ID, changes); err != nil {
				return err
			}
		}
		if changesArms {
			if err := replaceArms(ctx, app, projectID, found.ID, variants); err != nil {
				if len(changes) > 0 {
					app.Warnf("The other changes to %s were saved; only its arms were not replaced.", cli.Printable(found.Name))
				}
				return cli.APIError(err, map[string]string{
					"experiment_variants_locked": fmt.Sprintf("Pause it first: 'voidhash experiment pause %s'.", found.ID),
				})
			}
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("Updated %s.", updated.Value.Name))
	}
	return cmd
}

// newStart creates `voidhash experiment start [experiment] [--yes]`.
func newStart(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "start",
		Short: "Start or resume an experiment.",
		Long:  "Start or resume an experiment at its paywall locations and on the flags it sets: end users who reach them are split between the arms. Asks first; --yes skips that.",
		Example: `voidhash experiment start "Annual-first onboarding"
voidhash experiment start exp_123 --yes`,
	}
	cli.SetArgs(cmd, experimentArg)
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
		object, err := requireExperiment(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash experiment start <experiment> --yes")
		if err != nil {
			return err
		}
		found := object.Value
		switch found.Status {
		case "running":
			return cli.Failf("%s is already running.", found.Name).
				WithHint(fmt.Sprintf("'voidhash experiment results %s' shows how it is doing.", found.ID))
		case "concluded":
			return cli.Failf("%s has concluded and cannot run again.", found.Name).
				WithHint("Set up a new one with 'voidhash experiment create'.")
		}
		arms, err := armsOf(ctx, app, projectID, found.ID)
		if err != nil {
			return err
		}
		var locationIDs, flagIDs []string
		add := func(ids []string, id string) []string {
			for _, known := range ids {
				if known == id {
					return ids
				}
			}
			return append(ids, id)
		}
		for _, one := range arms.Items {
			for _, shown := range one.Placements {
				locationIDs = add(locationIDs, shown.PaywallLocationID)
			}
			for _, value := range one.FlagValues {
				flagIDs = add(flagIDs, value.FeatureFlagID)
			}
		}
		if len(locationIDs) == 0 && len(flagIDs) == 0 {
			return cli.Failf("%s has no paywalls placed and sets no flag, so starting it would change nothing.", found.Name).
				WithHint(fmt.Sprintf("Give each arm a paywall: 'voidhash experiment edit %s %s', or a value for a flag: 'voidhash experiment edit %s %s'.",
					found.ID, armsUsage, found.ID, flagsUsage))
		}
		// Who is split: whoever reaches a location, and whoever's app reads a flag it sets.
		var reached []string
		if len(locationIDs) > 0 {
			where, err := listPlaces(ctx, app, projectID)
			if err != nil {
				return err
			}
			for index, id := range locationIDs {
				locationIDs[index] = slugOf(where.locations, id)
			}
			reached = append(reached, "at "+strings.Join(locationIDs, ", "))
		}
		if len(flagIDs) > 0 {
			inUse, err := flags.List(ctx, app, projectID, false)
			if err != nil {
				return err
			}
			for index, id := range flagIDs {
				flagIDs[index] = keyOf(inUse.Items, id)
			}
			reached = append(reached, "whose app reads "+strings.Join(flagIDs, ", "))
		}
		verb, done := "Start", "Started"
		if found.Status == "paused" {
			verb, done = "Resume", "Resumed"
		}
		// A test starting keeps each placed paywall's live build; a withdrawn one is not served.
		if found.Status == "draft" && len(locationIDs) > 0 {
			places, err := listPlaces(ctx, app, projectID)
			if err != nil {
				return err
			}
			warned := map[string]bool{}
			for _, one := range arms.Items {
				for _, shown := range one.Placements {
					if warned[shown.PaywallID] {
						continue
					}
					warned[shown.PaywallID] = true
					builds, err := paywalls.ListBuilds(ctx, app, projectID, shown.PaywallID)
					if err != nil {
						return err
					}
					if live, ok := paywalls.DeployedBuild(builds.Items); ok {
						if warning := paywalls.WithdrawnLiveWarning(live); warning != "" {
							app.Warnf("%s: %s", slugOf(places.paywalls, shown.PaywallID), warning)
						}
					}
				}
			}
		}
		split := make([]string, len(arms.Items))
		for index, one := range arms.Items {
			split[index] = flags.Percent(one.WeightPercentage) + " " + one.Name
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("%s %s in %s? End users %s are split %s.",
			verb, found.Name, target.Label(), strings.Join(reached, " or "), strings.Join(split, ", "))); err != nil {
			return err
		}
		started, err := cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsStart(ctx, projectID, found.ID)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"experiment_not_startable": "Deploy each placed paywall ('voidhash paywall deploy'), or conclude the other experiment at that location or on that flag.",
				"experiment_archived":      fmt.Sprintf("Restore it first: 'voidhash experiment restore %s'.", found.ID),
			})
		}
		return app.PrintItem(mode, started, fmt.Sprintf("%s %s. Follow it with 'voidhash experiment results %s'.", done, started.Value.Name, started.Value.ID))
	}
	return cmd
}

// newPause creates `voidhash experiment pause [experiment]`.
func newPause(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "pause",
		Short:   "Pause an experiment: everyone sees the control arm until it resumes.",
		Long:    "Pause a running experiment: everyone sees the control arm until 'voidhash experiment start' resumes it. End users keep their arms for when it does.",
		Example: `voidhash experiment pause "Annual-first onboarding"`,
	}
	cli.SetArgs(cmd, experimentArg)
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
		object, err := requireExperiment(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash experiment pause <experiment>")
		if err != nil {
			return err
		}
		paused, err := cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsPause(ctx, target.Project.Id, object.Value.ID)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{"experiment_not_running": "Only a running experiment can be paused."})
		}
		return app.PrintItem(mode, paused, fmt.Sprintf("Paused %s: everyone sees the control until 'voidhash experiment start %s'.", paused.Value.Name, paused.Value.ID))
	}
	return cmd
}

func getResults(ctx context.Context, app *cli.App, projectID, experimentID string) (cli.Object[results], error) {
	return cli.Fetch[results](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ExperimentsGetResults(ctx, projectID, experimentID)
	})
}

// newResults creates `voidhash experiment results [experiment]`.
func newResults(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "results",
		Short: "Show how each arm converts, with an honest verdict.",
		Long: `Show how each arm converts, with a verdict on each against the control that says when it is too early to tell, and when a difference is unlikely to be chance.

With --json it prints the results as the API measures them; with -q the ids of the arms.`,
		Example: `voidhash experiment results "Annual-first onboarding"
voidhash experiment results exp_123 --json`,
	}
	cli.SetArgs(cmd, experimentArg)
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
		object, err := requireExperiment(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash experiment results <experiment>")
		if err != nil {
			return err
		}
		found := object.Value
		arms, err := armsOf(ctx, app, projectID, found.ID)
		if err != nil {
			return err
		}
		measured, err := getResults(ctx, app, projectID, found.ID)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(measured)
		case cli.Quiet:
			app.PrintIDs(arms)
			return nil
		}
		app.Notef("%s", cli.Printable(fmt.Sprintf("%s, conversions counted as %s", found.Name, measured.Value.PrimaryMetricEventName)))
		count := func(pick func(armResult) int64) func(arm) string {
			return func(one arm) string {
				result, _ := measured.Value.of(one.ID)
				return fmt.Sprint(pick(result))
			}
		}
		cli.PrintTable(app, []cli.Column[arm]{
			{Header: "ARM", Cell: func(one arm) string {
				if one.IsControl {
					return one.Name + " (control)"
				}
				return one.Name
			}},
			{Header: "SHOWN", Cell: count(func(r armResult) int64 { return r.Exposures })},
			{Header: "CONVERTED", Cell: count(func(r armResult) int64 { return r.Conversions })},
			{Header: "RATE", Cell: func(one arm) string {
				if result, ok := measured.Value.of(one.ID); ok {
					return rate(result.ConversionRate)
				}
				return "-"
			}},
			{Header: "REVENUE", Cell: func(one arm) string {
				if result, ok := measured.Value.of(one.ID); ok {
					return cli.FormatMoney(result.Revenue, result.Currency)
				}
				return "-"
			}},
		}, arms.Items, "The experiment has no arms.")
		if lines := verdictLines(found, arms.Items, measured.Value); len(lines) > 0 {
			app.Println(cli.PrintableLines(strings.Join(lines, "\n")))
		}
		return nil
	}
	return cmd
}

// newConclude creates `voidhash experiment conclude [experiment] [--winner <arm>] [--yes]`.
func newConclude(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "conclude",
		Short: "End an experiment for good with a winner.",
		Long: `End an experiment for good with a winner: its paywalls show to everyone at its locations, and the flags it set give its values to everyone their own rules and overrides don't name. It can never run again. Shows the results and asks first; --yes skips the question.

Each location then shows its paywall's deployed build, as everywhere else the paywall is shown. When the winner ran another build (one was deployed while the experiment ran), the question says so. --roll-out tested deploys the build the winner ran first instead, which changes the paywall everywhere it is shown in that environment.`,
		Example: `voidhash experiment conclude "Annual-first onboarding" --winner "Annual first"
voidhash experiment conclude exp_123 --winner control --yes
voidhash experiment conclude exp_123 --winner "Annual first" --roll-out tested`,
	}
	cli.SetArgs(cmd, experimentArg)
	winner := cmd.Flags().String("winner", "", "The winning `arm` by name (default: the control)")
	rollOut := cli.AddChoiceFlag(cmd, "roll-out", "", []string{"live", "tested"}, "live", "Which build the locations show afterwards: the paywall's deployed build (live) or the build the winner ran, deployed first (tested)")
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
		object, err := requireExperiment(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash experiment conclude <experiment> --winner <arm> --yes")
		if err != nil {
			return err
		}
		found := object.Value
		arms, err := armsOf(ctx, app, projectID, found.ID)
		if err != nil {
			return err
		}
		var chosen arm
		if *winner != "" {
			if chosen, err = cli.FindItem(armKind, arms.Items, *winner); err != nil {
				return err
			}
		} else {
			hasControl := false
			for _, one := range arms.Items {
				if one.IsControl && !hasControl {
					chosen, hasControl = one, true
				}
			}
			if !hasControl {
				return cli.Usagef("%s has no control arm, so the winner must be named.", found.Name).
					WithHint(fmt.Sprintf("Pass --winner <arm>; 'voidhash experiment view %s' lists the arms.", found.ID))
			}
		}
		// The verdict is shown before the question; a conclusion does not depend on reading it.
		verdict := []string{"Results could not be read."}
		if measured, err := getResults(ctx, app, projectID, found.ID); err == nil {
			verdict = verdictLines(found, arms.Items, measured.Value)
		} else if ctx.Err() != nil {
			return ctx.Err()
		}
		if len(verdict) > 0 {
			app.Notef("%s", cli.PrintableLines(strings.Join(verdict, "\n")))
		}
		builds := rolloutLines(arms.Items, chosen, *rollOut)
		if len(builds) > 0 {
			app.Notef("%s", cli.PrintableLines(strings.Join(builds, "\n")))
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
			"Conclude %s in %s with %s as the winner? Its paywalls show to everyone at its locations, the flags it set give its values to everyone their own rules and overrides don't name, and it can never run again.",
			found.Name, target.Label(), chosen.Name)); err != nil {
			return err
		}
		body := api.ConcludeExperimentBodyJsonEncoding{WinningVariantId: &chosen.ID}
		if *rollOut == "tested" {
			tested := api.TestedBuild
			body.RollOut = &tested
		}
		concluded, err := cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsConclude(ctx, projectID, found.ID, body)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"experiment_not_started":        fmt.Sprintf("A draft has nothing to conclude; archive it: 'voidhash experiment archive %s'.", found.ID),
				"experiment_build_not_deployed": "The experiment still runs. Conclude without --roll-out tested to show the deployed build instead.",
			})
		}
		message := fmt.Sprintf("Concluded %s: %s won.", concluded.Value.Name, chosen.Name)
		for _, difference := range concluded.Value.RolloutDifferences {
			keys := ""
			if difference.Environment == "test" {
				keys = " for test keys"
			}
			message += fmt.Sprintf("\nThe arm ran build #%d%s; its location shows the deployed build #%d.", difference.TestedBuildNumber, keys, difference.ShownBuildNumber)
		}
		return app.PrintItem(mode, concluded, message)
	}
	return cmd
}

// newArchive creates `voidhash experiment archive [experiment]`.
func newArchive(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "archive",
		Short:   "Archive a draft or concluded experiment.",
		Long:    "Archive a draft or concluded experiment, so it leaves the list. 'voidhash experiment restore' brings it back.",
		Example: `voidhash experiment archive "Annual-first onboarding"`,
	}
	cli.SetArgs(cmd, experimentArg)
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
		inUse, err := listExperiments(ctx, app, target.Project.Id, false, "")
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, experimentKind, inUse.Items, cli.ArgAt(args, 0), "voidhash experiment archive <experiment>")
		if err != nil {
			return err
		}
		archived, err := cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsArchive(ctx, target.Project.Id, found.ID)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"experiment_in_progress": fmt.Sprintf("Conclude it first: 'voidhash experiment conclude %s'.", found.ID),
			})
		}
		return app.PrintItem(mode, archived, fmt.Sprintf("Archived %s. Bring it back with 'voidhash experiment restore %s'.", archived.Value.Name, archived.Value.ID))
	}
	return cmd
}

// newRestore creates `voidhash experiment restore [experiment]`.
func newRestore(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "restore",
		Short:   "Bring back an archived experiment.",
		Example: `voidhash experiment restore "Annual-first onboarding"`,
	}
	cli.SetArgs(cmd, experimentArg)
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
		archived, err := listExperiments(ctx, app, target.Project.Id, true, "")
		if err != nil {
			return err
		}
		kind := experimentKind
		kind.ListCommand, kind.CreateCommand = "voidhash experiment list --archived", ""
		found, err := cli.RequireItem(ctx, app, kind, archived.Items, cli.ArgAt(args, 0), "voidhash experiment restore <experiment>")
		if err != nil {
			return err
		}
		restored, err := cli.Fetch[experiment](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsUnarchive(ctx, target.Project.Id, found.ID)
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, restored, fmt.Sprintf("Restored %s (%s).", restored.Value.Name, restored.Value.Status))
	}
	return cmd
}

// rolloutLines says, for each location of the winner (the control's where the
// winner has none) and environment where the build the arm ran is not the
// paywall's deployed build, which build the location shows afterwards.
func rolloutLines(arms []arm, winner arm, rollOut string) []string {
	var control arm
	for _, one := range arms {
		if one.IsControl {
			control = one
		}
	}
	placed := append([]placement{}, winner.Placements...)
	for _, shown := range control.Placements {
		taken := false
		for _, kept := range placed {
			taken = taken || kept.PaywallLocationID == shown.PaywallLocationID
		}
		if !taken {
			placed = append(placed, shown)
		}
	}
	var lines []string
	for _, shown := range placed {
		if shown.Builds == nil {
			continue
		}
		for _, environment := range []struct {
			name   string
			builds armBuild
		}{{"production", shown.Builds.Production}, {"test", shown.Builds.Test}} {
			kept, deployed := environment.builds.KeptBuildNumber, environment.builds.DeployedBuildNumber
			if kept == nil || (deployed != nil && *deployed == *kept) {
				continue
			}
			deployedLabel := "no build"
			if deployed != nil {
				deployedLabel = fmt.Sprintf("build #%d", *deployed)
			}
			if rollOut == "tested" {
				lines = append(lines, fmt.Sprintf("The arm ran build #%d at %s in %s, but %s is deployed: build #%d is deployed to %s first, so every location showing the paywall there shows it too.",
					*kept, shown.PaywallLocationID, environment.name, deployedLabel, *kept, environment.name))
				continue
			}
			lines = append(lines, fmt.Sprintf("The arm ran build #%d at %s in %s, but %s is deployed, which the location shows afterwards, as everywhere else the paywall is shown. --roll-out tested deploys build #%d first instead.",
				*kept, shown.PaywallLocationID, environment.name, deployedLabel, *kept))
		}
	}
	return lines
}

// newDeployArm creates `voidhash experiment deploy-arm [experiment] --arm <arm> [--location <location>] [--build <number|id>] [--env production|test] [--yes]`.
func newDeployArm(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "deploy-arm",
		Short: "Move one arm of a running experiment to another build of its paywall.",
		Long: `Move one arm of a running or paused experiment to another build of the paywall it shows at a location, such as a build that fixes a crash: the arm's end users get it on their next visit. Every arm keeps the build its paywall had deployed when the experiment started, and 'voidhash paywall deploy' never changes it; this is how one changes.

The build must be a ready build of the same paywall deployed to that environment before; without --build, the paywall's deployed build. Without --env, both environments. Results go on counting everyone in the arm, and the move is recorded with it. Asks first; --yes skips the question. Needs permission to publish paywalls.`,
		Example: `voidhash experiment deploy-arm "Annual-first onboarding" --arm "Annual first"
voidhash experiment deploy-arm exp_123 --arm control --location onboarding-end --build 4 --env production --yes`,
	}
	cli.SetArgs(cmd, experimentArg)
	armName := cmd.Flags().String("arm", "", "The `arm` by name, or control")
	location := cmd.Flags().String("location", "", "The `location` the arm shows the paywall at (needed when it shows one at several)")
	buildFlag := cmd.Flags().String("build", "", "The build `number` or id (default: the paywall's deployed build)")
	env := cli.AddChoiceFlag(cmd, "env", "", []string{"production", "test"}, "", "Change this environment only (default: both)")
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		usage := "voidhash experiment deploy-arm <experiment> --arm <arm> [--build <number>]"
		if *armName == "" {
			return cli.Usagef("Name the arm to deploy a build to with --arm.").WithHint(usage)
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		object, err := requireExperiment(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		found := object.Value
		arms, err := armsOf(ctx, app, projectID, found.ID)
		if err != nil {
			return err
		}
		chosen, err := cli.FindItem(armKind, arms.Items, *armName)
		if err != nil {
			return err
		}
		where, err := listPlaces(ctx, app, projectID)
		if err != nil {
			return err
		}
		var shown []placement
		for _, one := range chosen.Placements {
			if *location == "" || *location == one.PaywallLocationID || *location == slugOf(where.locations, one.PaywallLocationID) {
				shown = append(shown, one)
			}
		}
		if len(shown) != 1 {
			return cli.Usagef("%s shows a paywall at %d of the locations named; name one with --location.", chosen.Name, len(shown)).
				WithHint(fmt.Sprintf("'voidhash experiment view %s' lists where each arm shows what.", found.ID))
		}
		placed := shown[0]
		builds, err := cli.ListAll[paywalls.Build](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaywallsListBuilds(ctx, projectID, placed.PaywallID, &api.PaywallsListBuildsParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		paywallName := slugOf(where.paywalls, placed.PaywallID)
		index := -1
		if *buildFlag != "" {
			index = paywalls.FindBuild(builds.Items, *buildFlag)
		} else {
			for candidate, one := range builds.Items {
				if index < 0 && (*env == "test" && one.IsDeployedInTest || *env == "production" && one.IsDeployed || *env == "" && one.IsDeployed && one.IsDeployedInTest) {
					index = candidate
				}
			}
		}
		if index < 0 {
			return &cli.UserError{
				Message:  fmt.Sprintf("%s has no such build to deploy to %s.", paywallName, chosen.Name),
				Hint:     fmt.Sprintf("'voidhash paywall view %s' lists its recent builds; name one with --build.", paywallName),
				ExitCode: cli.ExitNotFound,
			}
		}
		build := builds.Items[index]
		in := "production and test"
		if *env != "" {
			in = *env
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Deploy %s of %s to %s of %s at %s, in %s? The arm's end users see it on their next visit; the paywall's other locations and arms are unchanged.",
			paywalls.BuildLabel(build.Number), paywallName, chosen.Name, found.Name, slugOf(where.locations, placed.PaywallLocationID), in)); err != nil {
			return err
		}
		body := api.ExperimentsDeployVariantJSONRequestBody{PaywallLocationId: placed.PaywallLocationID, BuildId: build.ID}
		if *env != "" {
			environment := api.PaywallLocationEnvironment(*env)
			body.Environment = &environment
		}
		deployed, err := cli.Fetch[arm](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ExperimentsDeployVariant(ctx, projectID, found.ID, chosen.ID, body)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invalid_build":           fmt.Sprintf("Deploy the build to that environment first ('voidhash paywall deploy %s --build %d'), or name another with --build.", paywallName, build.Number),
				"experiment_not_started":  fmt.Sprintf("A draft keeps no build; its arms keep the builds deployed when it starts: 'voidhash experiment start %s'.", found.ID),
				"paywall_build_withdrawn": fmt.Sprintf("Restore it first ('voidhash paywall restore %s --build %d'), or name another with --build.", paywallName, build.Number),
			})
		}
		return app.PrintItem(mode, deployed, fmt.Sprintf("Deployed %s to %s at %s in %s. Results go on counting everyone in the arm.",
			paywalls.BuildLabel(build.Number), chosen.Name, slugOf(where.locations, placed.PaywallLocationID), in))
	}
	return cmd
}
