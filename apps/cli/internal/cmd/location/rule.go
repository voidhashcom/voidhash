package location

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// rule shows a paywall to everyone its conditions hold for. Position counts
// from 0 within the rule's environment.
type rule struct {
	ID          string      `json:"id"`
	Environment string      `json:"environment"`
	Position    int         `json:"position"`
	Name        *string     `json:"name"`
	PaywallID   string      `json:"paywallId"`
	Conditions  []condition `json:"conditions"`
}

// ruleBody is a rule as the API takes it back when an environment's rules
// are replaced.
type ruleBody struct {
	Conditions []condition `json:"conditions"`
	Name       *string     `json:"name"`
	PaywallID  string      `json:"paywallId"`
}

func bodyOf(existing rule) ruleBody {
	conditions := make([]condition, len(existing.Conditions))
	for index, asked := range existing.Conditions {
		if asked.Values == nil {
			asked.Values = []string{}
		}
		conditions[index] = asked
	}
	return ruleBody{Conditions: conditions, Name: existing.Name, PaywallID: existing.PaywallID}
}

func listRules(ctx context.Context, app *cli.App, projectID, locationID string) (cli.List[rule], error) {
	return cli.ListAll[rule](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaywallLocationsListRules(ctx, projectID, locationID, &api.PaywallLocationsListRulesParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// replaceRules saves rules as all the rules of the location in env.
func replaceRules(ctx context.Context, app *cli.App, projectID, locationID, env string, rules []ruleBody) (cli.Object[struct {
	Rules []rule `json:"rules"`
}], error) {
	return cli.Fetch[struct {
		Rules []rule `json:"rules"`
	}](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaywallLocationsReplaceRulesWithBody(ctx, projectID, locationID,
			&api.PaywallLocationsReplaceRulesParams{Environment: environmentOf(env)},
			paywalls.JSONContentType, paywalls.JSONBody(map[string]any{"rules": rules}))
	})
}

// describeRule is a rule as a line: "1. everyone whose country is DE or AT
// → Annual upsell (Germany)".
func describeRule(one rule, all []paywalls.Paywall) string {
	line := fmt.Sprintf("%d. everyone whose %s → %s", one.Position+1, describeConditions(one.Conditions), paywalls.PaywallName(all, one.PaywallID))
	if one.Environment == "test" {
		line += ", test keys only"
	}
	if one.Name != nil {
		line += " (" + *one.Name + ")"
	}
	return line
}

const ruleEnvUsage = "Whose apps the rule answers: production (the default), whose rules answer every app, or test, whose rules answer apps using a test key only and are read first there"

// newRule creates `voidhash location rule`.
func newRule(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "rule",
		Short: "Show another paywall at a location to the end users a rule matches.",
		Long:  "Show another paywall at a location to the end users a rule matches: add a rule with --when conditions, or remove one. Rules are read in order after pins, and the first that matches decides; 'voidhash location view' lists them.",
	}
	cmd.AddCommand(newRuleAdd(app), newRuleRemove(app))
	return cmd
}

// newRuleAdd creates `voidhash location rule add <location> <paywall> --when … [--name] [--first] [--env]`.
func newRuleAdd(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add",
		Short: "Show another paywall at a location to everyone its --when conditions hold for.",
		Long: `Show another paywall at a location to everyone its --when conditions hold for, in place of what the location shows everyone else; they are outside an experiment running there. Rules are read in order after pins, and the first that matches decides. With --env test, only apps using a test key are answered.

A condition is '<what> <how> [<values>]'. What is platform, app_version, os_version, country, locale or trait:<key>. How is in, not in, >=, <, is set or is not set. Values are separated by commas. Repeat --when; all conditions must hold.`,
		Example: `voidhash location rule add home annual --when 'country in DE,AT' --name Germany
voidhash location rule add home pro --when 'app_version >= 2.4' --when 'trait:beta is set' --first
voidhash location rule add home pro --when 'platform in ios' --env test`,
	}
	cli.SetArgs(cmd, locationArg, paywallArg)
	when := cli.AddStringsFlag(cmd, "when", "", "A `condition` the rule matches by, such as 'country in DE,AT' or 'trait:beta is set'; all of them must hold")
	name := cmd.Flags().String("name", "", "A name for the rule")
	first := cmd.Flags().Bool("first", false, "Read it before the location's other rules instead of after them")
	env := addEnvFlag(cmd, ruleEnvUsage)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		const usage = "voidhash location rule add <location> <paywall> --when <condition> [--env test]"
		conditions := make([]condition, len(*when))
		for index, typed := range *when {
			if conditions[index], err = parseCondition(typed); err != nil {
				return err
			}
		}
		if len(conditions) == 0 {
			return cli.Usagef("A rule needs at least one --when condition, or it matches nobody.").
				WithHint("Such as: " + strings.Replace(usage, "<condition>", "'country in DE,AT'", 1))
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		location := found.Value
		chosen, err := requireShowable(ctx, app, projectID, cli.ArgAt(args, 1), usage)
		if err != nil {
			return err
		}
		existing, err := listRules(ctx, app, projectID, location.ID)
		if err != nil {
			return err
		}
		added := ruleBody{Conditions: conditions, PaywallID: chosen.paywall.Id}
		if *name != "" {
			added.Name = name
		}
		rules := []ruleBody{}
		if *first {
			rules = append(rules, added)
		}
		for _, one := range existing.Items {
			if one.Environment == *env {
				rules = append(rules, bodyOf(one))
			}
		}
		if !*first {
			rules = append(rules, added)
		}
		saved, err := replaceRules(ctx, app, projectID, location.ID, *env, rules)
		if err != nil {
			return err
		}
		position, id := 1, ""
		if count := len(saved.Value.Rules); count > 0 {
			made := saved.Value.Rules[count-1]
			if *first {
				made = saved.Value.Rules[0]
			}
			position, id = made.Position+1, made.ID
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(saved)
		case cli.Quiet:
			if id != "" {
				app.Println(id)
			}
			return nil
		}
		lines := []string{fmt.Sprintf("%s now shows %s to everyone whose %s%s. It is rule %d of %d; the first rule that matches decides.",
			label(location), paywallLabel(chosen.paywall), describeConditions(conditions), testSuffix(*env, ", in apps using a test key"), position, len(saved.Value.Rules))}
		if location.Showing == nil && (*env != "test" || location.TestShowing == nil) {
			lines = append(lines, fmt.Sprintf("%s shows nothing, and a rule shows only where the location shows something: 'voidhash location show %s <paywall>'.",
				label(location), location.Slug))
		}
		lines = append(lines, fmt.Sprintf("  Undo it: 'voidhash location rule remove %s %d%s'", location.Slug, position, testSuffix(*env, " --env test")))
		app.Println(cli.PrintableLines(strings.Join(lines, "\n")))
		return nil
	}
	return cmd
}

// newRuleRemove creates `voidhash location rule remove <location> <position> [--env]`.
func newRuleRemove(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "remove",
		Short: "Remove one of a location's rules by its number.",
		Long:  "Remove one of a location's rules by its number, in production or in test with --env test. 'voidhash location view' lists the rules of each with their numbers.",
		Example: `voidhash location rule remove home 1
voidhash location rule remove home 2 --env test`,
	}
	// With one argument it is the rule's number, and the location is asked for.
	cli.SetArgs(cmd, locationArg, cli.Arg{Name: "position", Help: "The rule's number, as 'voidhash location view' lists it, from 1"})
	env := addEnvFlag(cmd, ruleEnvUsage)
	project := cli.AddProjectFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		locationInput, position := "", args[len(args)-1]
		if len(args) == 2 {
			locationInput = args[0]
		}
		found, err := paywalls.RequireLocation(ctx, app, projectID, locationInput, "voidhash location rule remove <location> <position> [--env test]")
		if err != nil {
			return err
		}
		location := found.Value
		all, err := listRules(ctx, app, projectID, location.ID)
		if err != nil {
			return err
		}
		number, _ := strconv.Atoi(strings.TrimSpace(position))
		var removed *rule
		kept, count := []ruleBody{}, 0
		for _, one := range all.Items {
			if one.Environment != *env {
				continue
			}
			count++
			if removed == nil && one.Position == number-1 {
				removed = &one
				continue
			}
			kept = append(kept, bodyOf(one))
		}
		if removed == nil {
			return (&cli.UserError{
				Message:  fmt.Sprintf("%s has no %s rule %s; it has %d.", label(location), *env, position, count),
				ExitCode: cli.ExitNotFound,
			}).WithHint(fmt.Sprintf("'voidhash location view %s' lists its rules.", location.Slug))
		}
		if _, err := replaceRules(ctx, app, projectID, location.ID, *env, kept); err != nil {
			return err
		}
		app.Println(cli.Printable(fmt.Sprintf("Removed %s rule %d at %s (everyone whose %s); they see what the next rule that matches gives them, or what it shows everyone else.",
			*env, number, label(location), describeConditions(removed.Conditions))))
		return nil
	}
	return cmd
}
