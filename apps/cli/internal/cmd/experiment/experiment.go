// Package experiment holds `voidhash experiment`: A/B tests of paywalls and
// feature flags. An experiment splits end users between arms, each showing
// a paywall at its paywall locations, giving feature flags a value, or
// both. Metrics are fixed once it starts; arms are locked while it runs.
package experiment

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/flags"
)

// New creates `voidhash experiment`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "experiment",
		Aliases: []string{"experiments"},
		Short:   "A/B tests: set up arms, start, follow the results, and conclude.",
		Long: `A/B tests of paywalls and feature flags: set up arms, start, follow the results, and conclude with a winner.

An experiment splits end users between arms. Each arm shows a paywall at its paywall locations, gives feature flags a value, or both. What counts as a conversion is fixed once it starts, and the arms are locked while it runs.

Each arm keeps the build of its paywall deployed when the experiment started, whatever 'voidhash paywall deploy' deploys later; 'voidhash experiment deploy-arm' moves one arm to another build.`,
	}
	cmd.AddCommand(
		newList(app), newView(app), newCreate(app), newEdit(app),
		newStart(app), newPause(app), newResults(app), newDeployArm(app), newConclude(app),
		newArchive(app), newRestore(app),
	)
	return cmd
}

// experiment is an A/B test as the API sends it.
type experiment struct {
	ID                     string  `json:"id"`
	Name                   string  `json:"name"`
	Hypothesis             *string `json:"hypothesis"`
	Status                 string  `json:"status"`
	PrimaryMetricEventName *string `json:"primaryMetricEventName"`
	WinningVariantID       *string `json:"winningVariantId"`
	IsArchived             bool    `json:"isArchived"`
	StartedAt              *string `json:"startedAt"`
	// RolloutDifferences are where a concluded experiment's winner ran
	// another build than the one its location went on to show.
	RolloutDifferences []rolloutDifference `json:"rolloutDifferences"`
}

type rolloutDifference struct {
	PaywallLocationID string `json:"paywallLocationId"`
	Environment       string `json:"environment"`
	TestedBuildNumber int    `json:"testedBuildNumber"`
	ShownBuildNumber  int    `json:"shownBuildNumber"`
}

// armBuild is the build an arm keeps at a location in one environment,
// beside the paywall's deployed build. KeptBuildNumber is nil while the arm
// follows the deployed build: in a draft, or an experiment started before
// arms kept their build.
type armBuild struct {
	KeptBuildNumber     *int `json:"keptBuildNumber"`
	DeployedBuildNumber *int `json:"deployedBuildNumber"`
}

type placement struct {
	PaywallLocationID string `json:"paywallLocationId"`
	PaywallID         string `json:"paywallId"`
	// Builds is what the API reads back; it is never sent.
	Builds *struct {
		Production armBuild `json:"production"`
		Test       armBuild `json:"test"`
	} `json:"builds,omitempty"`
}

// keptBuildLabel is the build a placement keeps, in a few words: " keeping
// build #3", " keeping build #3 (test keys: #4)", or nothing while it
// follows the paywall's deployed build.
func keptBuildLabel(shown placement) string {
	if shown.Builds == nil {
		return ""
	}
	production, test := shown.Builds.Production.KeptBuildNumber, shown.Builds.Test.KeptBuildNumber
	label := func(number *int) string {
		if number == nil {
			return "deployed"
		}
		return fmt.Sprintf("#%d", *number)
	}
	switch {
	case production == nil && test == nil:
		return ""
	case production != nil && test != nil && *production == *test:
		return " keeping build " + label(production)
	}
	return fmt.Sprintf(" keeping build %s (test keys: %s)", label(production), label(test))
}

type flagValue struct {
	FeatureFlagID string  `json:"featureFlagId"`
	IsEnabled     bool    `json:"isEnabled"`
	VariantKey    *string `json:"variantKey,omitempty"`
}

// arm is one side of an experiment: what it shows or sets, and its share.
type arm struct {
	ID               string      `json:"id"`
	Name             string      `json:"name"`
	IsControl        bool        `json:"isControl"`
	WeightPercentage float64     `json:"weightPercentage"`
	Placements       []placement `json:"placements"`
	FlagValues       []flagValue `json:"flagValues"`
	// StoppedPlacements are locations the arm stopped showing a paywall at
	// while the experiment was paused, kept for the record; they serve nothing.
	StoppedPlacements []struct {
		PaywallLocationID string `json:"paywallLocationId"`
		PaywallID         string `json:"paywallId"`
	} `json:"stoppedPlacements"`
}

// place is a paywall or a paywall location, as far as naming one needs.
type place struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

var experimentKind = cli.ItemKind[experiment]{
	Noun:          "experiment",
	ID:            func(e experiment) string { return e.ID },
	Label:         func(e experiment) string { return e.Name },
	ListCommand:   "voidhash experiment list",
	CreateCommand: "voidhash experiment create",
	Names:         func(e experiment) []string { return []string{e.Name} },
}

var armKind = cli.ItemKind[arm]{
	Noun:        "arm",
	ID:          func(a arm) string { return a.ID },
	Label:       func(a arm) string { return a.Name },
	ListCommand: "voidhash experiment view <experiment>",
	Names: func(a arm) []string {
		if a.IsControl {
			return []string{a.Name, "control"}
		}
		return []string{a.Name}
	},
}

func placeKind(noun, listCommand string) cli.ItemKind[place] {
	return cli.ItemKind[place]{
		Noun:        noun,
		ID:          func(p place) string { return p.ID },
		Label:       func(p place) string { return p.Name + " (" + p.Slug + ")" },
		ListCommand: listCommand,
		Keys:        func(p place) []string { return []string{p.Slug} },
		Names:       func(p place) []string { return []string{p.Name} },
	}
}

var (
	locationKind = placeKind("paywall location", "voidhash location list")
	paywallKind  = placeKind("paywall", "voidhash paywall list")
)

var experimentArg = cli.Arg{Name: "experiment", Help: "The experiment's name or id", Optional: true}

// The event results count when an experiment names none.
const defaultMetric = "purchase_completed"

const (
	armsUsage  = "--arm 'Control=monthly' --arm 'Annual first=annual' --location onboarding-end"
	flagsUsage = "--arm Control --arm 'New checkout' --flag 'new-checkout=off,on'"
)

func listExperiments(ctx context.Context, app *cli.App, projectID string, archived bool, status string) (cli.List[experiment], error) {
	isArchived := api.ExperimentsListParamsIsArchived(strconv.FormatBool(archived))
	params := &api.ExperimentsListParams{IsArchived: &isArchived}
	if status != "" {
		params.Status = (*api.ExperimentStatus)(&status)
	}
	return cli.ListAll[experiment](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		params.Cursor, params.Limit = page.Cursor, page.Limit
		return c.ExperimentsList(ctx, projectID, params)
	})
}

func armsOf(ctx context.Context, app *cli.App, projectID, experimentID string) (cli.List[arm], error) {
	return cli.ListAll[arm](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ExperimentsListVariants(ctx, projectID, experimentID, &api.ExperimentsListVariantsParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// requireExperiment is the experiment a command names, in use or archived.
func requireExperiment(ctx context.Context, app *cli.App, projectID, input, usage string) (cli.Object[experiment], error) {
	inUse, err := listExperiments(ctx, app, projectID, false, "")
	if err != nil {
		return cli.Object[experiment]{}, err
	}
	archived, err := listExperiments(ctx, app, projectID, true, "")
	if err != nil {
		return cli.Object[experiment]{}, err
	}
	return flags.RequireObject(ctx, app, experimentKind, flags.Concat(inUse, archived), input, usage)
}

// places are the project's paywall locations and paywalls, to name
// placements by.
type places struct {
	locations []place
	paywalls  []place
}

func listPlaces(ctx context.Context, app *cli.App, projectID string) (places, error) {
	locations, err := cli.ListAll[place](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaywallLocationsList(ctx, projectID, &api.PaywallLocationsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return places{}, err
	}
	paywalls, err := cli.ListAll[place](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaywallsList(ctx, projectID, &api.PaywallsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	return places{locations: locations.Items, paywalls: paywalls.Items}, err
}

// slugOf is the slug of the place with id, or the id when it is not listed.
func slugOf(all []place, id string) string {
	for _, one := range all {
		if one.ID == id {
			return one.Slug
		}
	}
	return id
}

// keyOf is the key of the flag with id, or the id when it is not listed.
func keyOf(all []flags.Flag, id string) string {
	for _, one := range all {
		if one.ID == id {
			return one.Key
		}
	}
	return id
}

// armDoesLabel says what an arm does: the paywall it shows where, and the
// value it gives each flag ("new-checkout off", "headline on (short)").
func armDoesLabel(one arm, where places, inUse []flags.Flag) string {
	var parts []string
	for _, shown := range one.Placements {
		parts = append(parts, slugOf(where.paywalls, shown.PaywallID)+" at "+slugOf(where.locations, shown.PaywallLocationID)+keptBuildLabel(shown))
	}
	for _, value := range one.FlagValues {
		state := "off"
		if value.IsEnabled {
			state = "on"
			if value.VariantKey != nil {
				state += " (" + *value.VariantKey + ")"
			}
		}
		parts = append(parts, keyOf(inUse, value.FeatureFlagID)+" "+state)
	}
	for _, stopped := range one.StoppedPlacements {
		parts = append(parts, "stopped showing "+slugOf(where.paywalls, stopped.PaywallID)+" at "+slugOf(where.locations, stopped.PaywallLocationID))
	}
	if len(parts) == 0 {
		return "no paywall placed, no flag set"
	}
	return strings.Join(parts, ", ")
}

func statusLabel(app *cli.App, e experiment) string {
	switch {
	case e.Status == "running" && e.StartedAt != nil:
		return "running since " + app.FormatTimeAgo(*e.StartedAt)
	case e.Status == "paused":
		return "paused (everyone sees the control)"
	default:
		return e.Status
	}
}

func armShares(arms []arm) string {
	shares := make([]string, len(arms))
	for index, one := range arms {
		shares[index] = one.Name + " " + flags.Percent(one.WeightPercentage)
	}
	return strings.Join(shares, ", ")
}

// newList creates `voidhash experiment list [--status] [--archived]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's experiments with their status and arms.",
		Example: `voidhash experiment list
voidhash experiment list --status running
voidhash experiment list --archived --json`,
	}
	project := cli.AddProjectFlag(cmd)
	status := cli.AddChoiceFlag(cmd, "status", "", []string{"draft", "running", "paused", "concluded"}, "", "Only experiments in this status")
	archived := cmd.Flags().Bool("archived", false, "List archived experiments instead")
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
		experiments, err := listExperiments(ctx, app, target.Project.Id, *archived, *status)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(experiments)
		case cli.Quiet:
			app.PrintIDs(experiments)
			return nil
		}
		// Only people see the arms, so only they wait for them.
		type row struct {
			experiment experiment
			arms       []arm
		}
		rows, err := cli.Each(ctx, experiments.Items, 8, func(ctx context.Context, one experiment) (row, error) {
			arms, err := armsOf(ctx, app, target.Project.Id, one.ID)
			return row{experiment: one, arms: arms.Items}, err
		})
		if err != nil {
			return err
		}
		empty := "No experiments yet. Set one up with 'voidhash experiment create'."
		switch {
		case *archived:
			empty = "No archived experiments."
		case *status != "":
			empty = fmt.Sprintf("No %s experiments. 'voidhash experiment list' shows them all.", *status)
		}
		cli.PrintTable(app, []cli.Column[row]{
			{Header: "NAME", Cell: func(r row) string { return r.experiment.Name }},
			{Header: "STATUS", Cell: func(r row) string { return statusLabel(app, r.experiment) }},
			{Header: "ARMS", Cell: func(r row) string {
				if len(r.arms) == 0 {
					return "-"
				}
				return armShares(r.arms)
			}},
			{Header: "ID", Cell: func(r row) string { return r.experiment.ID }},
		}, rows, empty)
		return nil
	}
	return cmd
}

// newView creates `voidhash experiment view [experiment]`.
func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show an experiment: its status, metric and what each arm does.",
		Long:  "Show an experiment: its status, what counts as a conversion, the paywall each arm shows where and the value it gives each flag. With --json the experiment carries its arms as \"arms\".",
		Example: `voidhash experiment view "Annual-first onboarding"
voidhash experiment view exp_123 --json`,
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
		object, err := requireExperiment(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash experiment view <experiment>")
		if err != nil {
			return err
		}
		found := object.Value
		if mode == cli.Quiet {
			app.PrintIDs(object)
			return nil
		}
		arms, err := armsOf(ctx, app, projectID, found.ID)
		if err != nil {
			return err
		}
		if mode == cli.JSON {
			return app.PrintJSON(flags.WithField(object.Raw, "arms", arms.RawJSON()))
		}
		var where places
		var inUse []flags.Flag
		for _, one := range arms.Items {
			if len(one.Placements)+len(one.StoppedPlacements) > 0 && where.paywalls == nil {
				if where, err = listPlaces(ctx, app, projectID); err != nil {
					return err
				}
			}
			if len(one.FlagValues) > 0 && inUse == nil {
				list, err := flags.List(ctx, app, projectID, false)
				if err != nil {
					return err
				}
				inUse = list.Items
			}
		}
		next := "it cannot run again"
		switch found.Status {
		case "draft":
			next = fmt.Sprintf("start it with 'voidhash experiment start %s'", found.ID)
		case "running":
			next = fmt.Sprintf("'voidhash experiment results %s' shows how it is doing", found.ID)
		case "paused":
			next = fmt.Sprintf("resume it with 'voidhash experiment start %s'", found.ID)
		}
		status := statusLabel(app, found)
		if found.IsArchived {
			status += ", archived"
		}
		fields := []cli.Field{{Label: "Status", Value: status + "; " + next}}
		if found.Hypothesis != nil && *found.Hypothesis != "" {
			fields = append(fields, cli.Field{Label: "Hypothesis", Value: *found.Hypothesis})
		}
		conversion := defaultMetric + " (default)"
		if found.PrimaryMetricEventName != nil {
			conversion = *found.PrimaryMetricEventName
		}
		if found.Status != "draft" {
			conversion += ", fixed since it started"
		}
		fields = append(fields, cli.Field{Label: "Conversion", Value: conversion})
		rows := make([][]string, len(arms.Items))
		winner := ""
		for index, one := range arms.Items {
			name := one.Name
			if one.IsControl {
				name += " (control)"
			}
			rows[index] = []string{name, flags.Percent(one.WeightPercentage), armDoesLabel(one, where, inUse)}
			if found.WinningVariantID != nil && one.ID == *found.WinningVariantID {
				winner = one.Name
			}
		}
		if len(rows) == 0 {
			rows = [][]string{{"none yet"}}
		}
		fields = append(fields, cli.Field{Label: "Arms", Value: cli.FormatRows(rows)})
		if winner != "" {
			fields = append(fields, cli.Field{Label: "Winner", Value: winner})
		}
		if found.StartedAt != nil {
			fields = append(fields, cli.Field{Label: "Started", Value: app.FormatDate(*found.StartedAt)})
		}
		fields = append(fields, cli.Field{Label: "ID", Value: found.ID})
		settings, err := app.Config()
		if err != nil {
			return err
		}
		if address, ok := cli.DashboardURL(settings.WebURL, target, "experiments/"+found.ID); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		app.Println(cli.Printable(found.Name) + "\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}
