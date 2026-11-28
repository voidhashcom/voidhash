package flag

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
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// newList creates `voidhash flag list [--archived]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's feature flags.",
		Long:  "List the project's feature flags with their state in production, whether test follows it, and their variants.",
		Example: `voidhash flag list
voidhash flag list --archived
voidhash flag list --json`,
	}
	archived := cmd.Flags().Bool("archived", false, "List archived flags instead")
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
		list, err := flags.List(ctx, app, target.Project.Id, *archived)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(list)
		case cli.Quiet:
			app.PrintIDs(list)
			return nil
		}
		// Only people see the variants, so only they wait for them.
		type row struct {
			flag     flags.Flag
			variants []variant
		}
		rows, err := cli.Each(ctx, list.Items, 8, func(ctx context.Context, flag flags.Flag) (row, error) {
			variants, err := variantsOf(ctx, app, target.Project.Id, flag)
			return row{flag: flag, variants: variants}, err
		})
		if err != nil {
			return err
		}
		columns := []cli.Column[row]{
			{Header: "KEY", Cell: func(r row) string { return r.flag.Key }},
			{Header: "TYPE", Cell: func(r row) string { return r.flag.Type }},
			{Header: "STATE", Cell: func(r row) string { return flagState(r.flag) }},
		}
		if !*archived {
			columns = append(columns, cli.Column[row]{Header: "TEST", Cell: func(r row) string { return testState(r.flag) }})
		}
		columns = append(columns,
			cli.Column[row]{Header: "VARIANTS", Cell: func(r row) string {
				if len(r.variants) == 0 {
					return "-"
				}
				return variantLabels(r.variants)
			}},
			cli.Column[row]{Header: "ID", Cell: func(r row) string { return r.flag.ID }},
		)
		empty := "No feature flags yet. Create one with 'voidhash flag create'."
		if *archived {
			empty = "No archived flags."
		}
		cli.PrintTable(app, columns, rows, empty)
		return nil
	}
	return cmd
}

// newView creates `voidhash flag view [flag]`.
func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a flag: its variants, and who gets it in production and in test.",
		Long:  "Show a flag: its variants, and who gets it in production and in test, in the order that is decided: overrides, rules, then everyone else.",
		Example: `voidhash flag view new-checkout
voidhash flag view new-checkout --json`,
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
		found, err := requireFlag(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash flag view <flag>")
		if err != nil {
			return err
		}
		flag := found.Value
		if mode == cli.Quiet {
			app.PrintIDs(found)
			return nil
		}
		variants, err := listVariants(ctx, app, target.Project.Id, flag.ID)
		if err != nil {
			return err
		}
		if mode == cli.JSON {
			return app.PrintJSON(flags.WithField(found.Raw, "variants", variants.RawJSON()))
		}
		var fields []cli.Field
		if flag.IsArchived {
			fields = append(fields, cli.Field{Label: "State", Value: fmt.Sprintf("archived; bring it back with 'voidhash flag restore %s'", flag.Key)})
		}
		if flag.Description != nil && *flag.Description != "" {
			fields = append(fields, cli.Field{Label: "Description", Value: *flag.Description})
		}
		if len(variants.Items) > 0 {
			rows := make([][]string, len(variants.Items))
			for index, one := range variants.Items {
				rows[index] = []string{variantLabel(one), flags.Percent(one.WeightPercentage)}
			}
			fields = append(fields, cli.Field{Label: "Variants", Value: cli.FormatRows(rows)})
		}
		test := "follows production: apps using a test key get the same"
		if flag.Environments.Test != nil {
			test = describeEnvironment(*flag.Environments.Test, variants.Items)
		}
		fields = append(fields,
			cli.Field{Label: "Production", Value: describeEnvironment(flag.Environments.Production, variants.Items)},
			cli.Field{Label: "Test", Value: test},
		)
		if flag.ExperimentID != nil {
			fields = append(fields, cli.Field{Label: "Experiment", Value: *flag.ExperimentID + "; change it through the experiment"})
		}
		fields = append(fields, cli.Field{Label: "ID", Value: flag.ID})
		settings, err := app.Config()
		if err != nil {
			return err
		}
		if address, ok := cli.DashboardURL(settings.WebURL, target, "flags/"+flag.ID); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		app.Println(cli.Printable(fmt.Sprintf("%s (%s flag)", flag.Key, flag.Type)) + "\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}

// person is an end user as the API sends one, as far as an evaluation needs.
type person struct {
	ID         string  `json:"id"`
	DistinctID string  `json:"distinctId"`
	Email      *string `json:"email"`
	Name       *string `json:"name"`
}

func (p person) name() string {
	switch {
	case p.Name != nil:
		return *p.Name
	case p.Email != nil:
		return *p.Email
	default:
		return p.DistinctID
	}
}

// evaluation is what one flag gives an end user, and why.
type evaluation struct {
	FeatureFlagID string          `json:"featureFlagId"`
	Key           string          `json:"key"`
	IsEnabled     bool            `json:"isEnabled"`
	VariantKey    *string         `json:"variantKey"`
	Value         json.RawMessage `json:"value"`
	Reason        string          `json:"reason"`
	RuleID        *string         `json:"ruleId"`
}

// newEvaluate creates `voidhash flag evaluate [person] [--flag <key>]… [--env]`.
func newEvaluate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "evaluate",
		Short: "Show what one end user gets from each flag, and why.",
		Long: `Show what one end user gets from each flag and why, as their app would see it in production, or in test with --env test. Looking places them in no experiment.

Rules that ask about the app read --platform, --app-version, --os-version, --country and --locale; without them such a condition counts as not set.

With -q it prints the keys of the flags that are on for them.`,
		Example: `voidhash flag evaluate alice@example.com
voidhash flag evaluate device-1234 --flag new-checkout --env test
voidhash flag evaluate alice@example.com --platform ios --app-version 2.4.1 --country DE`,
	}
	cli.SetArgs(cmd, personArg)
	keys := cli.AddStringsFlag(cmd, "flag", "", "Only this flag, by `key`")
	platform := cmd.Flags().String("platform", "", "The platform their app runs on (ios, android or web), for rules that ask")
	appVersion := cmd.Flags().String("app-version", "", "Their app's `version`, such as 2.4.1, for rules that ask")
	osVersion := cmd.Flags().String("os-version", "", "Their operating system's `version`, such as 17.4, for rules that ask")
	country := cmd.Flags().String("country", "", "The two-letter country they are in, such as DE, for rules that ask")
	locale := cmd.Flags().String("locale", "", "Their locale, such as de-DE, for rules that ask")
	env := addEnvFlag(cmd)
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
		who, err := requireIdentity(ctx, app, cli.ArgAt(args, 0), "voidhash flag evaluate <person>")
		if err != nil {
			return err
		}
		// A known person is evaluated with all their identities, as their app would be.
		var persons cli.List[person]
		if who.Type == "distinct_id" || who.Type == "email" {
			persons, _, err = cli.FetchPage[person](ctx, app, func(c *api.Client) (*http.Response, error) {
				if who.Type == "email" {
					limit := 20
					return c.PersonsList(ctx, projectID, &api.PersonsListParams{Email: &who.Value, Limit: &limit})
				}
				return c.PersonsList(ctx, projectID, &api.PersonsListParams{DistinctId: &who.Value})
			})
			if err != nil {
				return err
			}
		}
		if len(persons.Items) > 1 {
			lines := []string{fmt.Sprintf("%s belongs to %d persons:", who.Value, len(persons.Items))}
			for _, one := range persons.Items {
				lines = append(lines, "  "+one.name()+"  "+one.ID)
			}
			return cli.Usagef("%s", strings.Join(lines, "\n")).WithHint("Name one by its person id, such as person_id:" + persons.Items[0].ID + ".")
		}
		request := map[string]any{"environment": *env, "isPreview": true}
		set := func(name, identityType string, known *string) {
			if known != nil {
				request[name] = *known
			} else if who.Type == identityType {
				request[name] = who.Value
			}
		}
		var known *person
		if len(persons.Items) == 1 {
			known = &persons.Items[0]
			set("personId", "person_id", &known.ID)
			set("distinctId", "distinct_id", &known.DistinctID)
			set("email", "email", known.Email)
		} else {
			set("personId", "person_id", nil)
			set("distinctId", "distinct_id", nil)
			set("email", "email", nil)
		}
		if who.Type == "external_id" {
			request["externalIds"] = []string{who.Value}
		}
		if len(*keys) > 0 {
			request["keys"] = *keys
		}
		// What their app would report, for rules with conditions on it.
		reported := map[string]string{}
		for name, value := range map[string]string{
			"platform": *platform, "appVersion": *appVersion, "osVersion": *osVersion, "country": *country, "locale": *locale,
		} {
			if value != "" {
				reported[name] = value
			}
		}
		if len(reported) > 0 {
			request["context"] = reported
		}
		body, err := json.Marshal(request)
		if err != nil {
			return err
		}
		result, err := cli.Fetch[struct {
			Flags []json.RawMessage `json:"flags"`
		}](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsEvaluateWithBody(ctx, projectID, "application/json", bytes.NewReader(body))
		})
		if err != nil {
			return err
		}
		if mode == cli.JSON {
			if result.Value.Flags == nil {
				return app.PrintJSON([]json.RawMessage{})
			}
			return app.PrintJSON(result.Value.Flags)
		}
		evaluations := make([]evaluation, len(result.Value.Flags))
		for index, raw := range result.Value.Flags {
			if err := json.Unmarshal(raw, &evaluations[index]); err != nil {
				return cli.Failf("The Voidhash API sent an answer the CLI could not read.")
			}
		}
		if mode == cli.Quiet {
			for _, one := range evaluations {
				if one.IsEnabled {
					app.Println(cli.Printable(one.Key))
				}
			}
			return nil
		}
		inUse, err := flags.List(ctx, app, projectID, false)
		if err != nil {
			return err
		}
		if known != nil {
			app.Notef("%s", cli.Printable(fmt.Sprintf("%s (%s)", known.name(), known.ID)))
		}
		cli.PrintTable(app, []cli.Column[evaluation]{
			{Header: "FLAG", Cell: func(one evaluation) string { return one.Key }},
			{Header: "GETS", Cell: func(one evaluation) string {
				switch {
				case !one.IsEnabled:
					return "off"
				case one.VariantKey == nil:
					return "on"
				default:
					return "on, " + formatValue(one.Value)
				}
			}},
			{Header: "WHY", Cell: func(one evaluation) string { return whyEvaluated(one, inUse.Items, *env) }},
		}, evaluations, "The project has no flags in use.")
		return nil
	}
	return cmd
}

// whyEvaluated says why a flag came out as it did for an end user, with the
// share its rule or everyone else gets.
func whyEvaluated(one evaluation, inUse []flags.Flag, environment string) string {
	var config *flags.Environment
	for _, candidate := range inUse {
		if candidate.ID == one.FeatureFlagID {
			found := candidate.In(environment)
			config = &found
		}
	}
	within := func(share *float64) string {
		side := "outside"
		if one.IsEnabled {
			side = "inside"
		}
		if share == nil {
			return side + " the "
		}
		return side + " the " + flags.Percent(*share) + " "
	}
	switch one.Reason {
	case "disabled":
		return "off in " + environment
	case "override":
		return "an override fixes it"
	case "experiment":
		return "a running experiment sets it for their arm"
	case "rule":
		ruleID := ""
		if one.RuleID != nil {
			ruleID = *one.RuleID
		}
		var share *float64
		if config != nil {
			for _, rule := range config.Rules {
				if rule.ID == ruleID {
					share = &rule.Serve.RolloutPercentage
					break
				}
			}
		}
		if share != nil && *share == 0 {
			return "rule " + ruleID + " gives it to nobody"
		}
		return within(share) + "rule " + ruleID + " gives it to"
	case "default":
		switch {
		case config == nil:
			return within(nil) + "rollout"
		case len(config.Rules) == 0:
			return within(&config.Fallthrough.RolloutPercentage) + "rollout"
		default:
			return "no rule matches them; " + within(&config.Fallthrough.RolloutPercentage) + "everyone else gets"
		}
	case "no_identity":
		return "no identity to place them by"
	default:
		// A reason newer than this CLI: shown as the API names it.
		return one.Reason
	}
}
