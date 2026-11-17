package flag

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/flags"
)

// newOverride creates `voidhash flag override [flag] [person] [on|off|variant|clear] [--env]`.
func newOverride(app *cli.App) *cobra.Command {
	const usage = "voidhash flag override <flag> <person> on|off|<variant>|clear"
	cmd := &cobra.Command{
		Use:   "override",
		Short: "Fix a flag for one end user, whatever its rules say.",
		Long: `Fix a flag for one end user (on, off or a variant) in production, or in test with --env test, whatever its rules and rollout say. 'clear' lets the flag decide for them again.

A flag that is off in an environment stays off there for everyone, overrides included.

With -q it prints the flag's id, since an override has none of its own. With --json it prints the override, or the flag after 'clear'.`,
		Example: `voidhash flag override new-checkout alice@example.com on
voidhash flag override button-color device-1234 blue --env test --note QA
voidhash flag override new-checkout alice@example.com clear`,
	}
	cli.SetArgs(cmd, flagArg, personArg,
		cli.Arg{Name: "setting", Help: "on, off, a variant (its value, label or id), or clear", Optional: true})
	note := cmd.Flags().String("note", "", "Why, such as QA")
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
		found, err := requireFlag(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		flag := found.Value
		if flag.ExperimentID != nil && *env == "test" {
			return cli.Usagef("%s assigns the arms of experiment %s.", flag.Key, *flag.ExperimentID).
				WithHint("An experiment has one configuration, which test follows; leave out --env.")
		}
		who, err := requireIdentity(ctx, app, cli.ArgAt(args, 1), usage)
		if err != nil {
			return err
		}
		variants, err := variantsOf(ctx, app, projectID, flag)
		if err != nil {
			return err
		}
		choices := []cli.Choice[string]{{Title: "On", Value: "on"}, {Title: "Off", Value: "off"}}
		for _, one := range variants {
			choices = append(choices, cli.Choice[string]{Title: "On, " + variantLabel(one), Value: one.ID})
		}
		choices = append(choices, cli.Choice[string]{Title: "Clear the override", Value: "clear"})
		var typed *string
		if setting := strings.TrimSpace(cli.ArgAt(args, 2)); setting != "" {
			typed = &setting
		}
		chosen, err := cli.RequireChoice(ctx, app, typed, cli.ChoicePrompt[string]{
			What: "what they get (<setting>)", Message: fmt.Sprintf("What should %s get in %s?", who.Value, *env),
			Usage: usage, Choices: choices,
		})
		if err != nil {
			return err
		}
		environment := api.FeatureFlagEnvironmentName(*env)
		if chosen == "clear" {
			if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.FeatureFlagsRemoveOverride(ctx, projectID, flag.ID, who.segment(), &api.FeatureFlagsRemoveOverrideParams{Environment: &environment})
			}); err != nil {
				return cli.APIError(err, map[string]string{
					"feature_flag_override_not_found": fmt.Sprintf("'voidhash flag view %s' lists its overrides in each environment.", flag.Key),
				})
			}
			return printFlagAfter(ctx, app, mode, projectID, found, fmt.Sprintf(
				"Cleared the %s override of %s on %s; the flag decides for them again there.", *env, who.label(), flag.Key))
		}
		served := findVariant(variants, chosen)
		if chosen != "on" && chosen != "off" && served == nil {
			hint := "A boolean flag takes on, off or clear."
			if len(variants) > 0 {
				hint = "Its variants: " + variantLabels(variants) + "."
			}
			return cli.Usagef("%q is not on, off, clear or one of %s's variants.", chosen, flag.Key).WithHint(hint)
		}
		request := map[string]any{"isEnabled": chosen != "off", "variantKey": nil, "note": nil}
		if served != nil {
			request["variantKey"] = served.Key
		}
		if *note != "" {
			request["note"] = *note
		}
		body, err := json.Marshal(request)
		if err != nil {
			return err
		}
		override, err := cli.Fetch[flags.Override](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeatureFlagsUpsertOverrideWithBody(ctx, projectID, flag.ID, who.segment(),
				&api.FeatureFlagsUpsertOverrideParams{Environment: &environment}, "application/json", bytes.NewReader(body))
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(override)
		case cli.Quiet:
			// An override has no id of its own: the flag's names where it lives.
			app.Println(flag.ID)
			return nil
		}
		gets := chosen
		if served != nil {
			gets = "on, " + variantLabel(*served)
		}
		lines := []string{fmt.Sprintf("%s now always gets %s %s in %s, whatever its rules and rollout say.", who.label(), flag.Key, gets, *env)}
		if !flag.In(*env).IsEnabled {
			lines = append(lines, fmt.Sprintf("%s is off in %s, so it stays off for them too until 'voidhash flag enable %s%s'.", flag.Key, *env, flag.Key, envSuffix(*env)))
		}
		if *env == "test" && flag.Environments.Test == nil {
			lines = append(lines, testSplitsOff(flag))
		}
		app.Println(cli.PrintableLines(strings.Join(lines, "\n")))
		return nil
	}
	return cmd
}

const ruleAddUsage = "voidhash flag rule add <flag> [<person>…] [--when <condition>]… --rollout <percent> [--variant <variant>] [--name <name>]"

// newRuleAdd creates `voidhash flag rule add [flag] [person]… --rollout <percent>`.
func newRuleAdd(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "add",
		Short: "Add a rule: who it matches, and the share of them who get the flag.",
		Long: `Add a rule: who it matches, and the share of them who get the flag. It matches the end users it names, and with --when everyone all its conditions hold for (their country, platform, app version, a trait).

A condition is written '<what> <how> [<values>]': what is platform, app_version, os_version, country, locale or trait:<key>; how is in, not in, >=, <, is set or is not set; values are separated by commas.

Rules are read in order after overrides; the first matching an end user decides.`,
		Example: `voidhash flag rule add new-checkout alice@example.com device-1234 --rollout 100% --name "Beta testers"
voidhash flag rule add new-checkout --when 'country in DE,AT' --when 'app_version >= 2.4' --rollout 50%
voidhash flag rule add button-color --when 'trait:plan in pro' --rollout 100% --variant blue --first
voidhash flag rule add new-checkout --when 'trait:beta is set' --rollout 100% --env test`,
	}
	cli.SetArgs(cmd, flagArg, cli.Arg{
		Name:     "person",
		Help:     "The end users the rule names: emails, distinct ids or person ids; prefix email:, distinct_id:, person_id: or external_id: to say which",
		Optional: true, Variadic: true,
	})
	when := cli.AddStringsFlag(cmd, "when", "", "A `condition` the rule also matches everyone by, such as 'country in DE,AT' or 'trait:beta is set'; all must hold")
	rollout := cmd.Flags().String("rollout", "", "The `share` of them who get the flag, such as 100%; 0% keeps them out")
	variantInput := cmd.Flags().String("variant", "", "The variant they get (its value, label or id); left out, they are split across the variants")
	name := cmd.Flags().String("name", "", "A name for the rule, such as Beta testers")
	id := cmd.Flags().String("id", "", "The rule's id (default: made from the name)")
	first := cmd.Flags().Bool("first", false, "Read it before the other rules, not after them")
	env := addEnvFlag(cmd)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		// Everything typed is read before anything is looked up.
		conditions := make([]flags.Condition, len(*when))
		for index, input := range *when {
			if conditions[index], err = parseCondition(input); err != nil {
				return err
			}
		}
		if *rollout != "" {
			if _, err := parsePercent(*rollout); err != nil {
				return err
			}
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		found, err := requireFlag(ctx, app, projectID, cli.ArgAt(args, 0), ruleAddUsage)
		if err != nil {
			return err
		}
		flag := found.Value
		if flag.ExperimentID != nil {
			return managedByExperiment(flag, "Change who is in it through the experiment: 'voidhash experiment view %s'.")
		}
		var named []identity
		if len(args) > 1 {
			for _, input := range args[1:] {
				named = append(named, parseIdentity(input))
			}
		} else if len(conditions) == 0 {
			// A rule by conditions alone names nobody, so nobody is asked for.
			who, err := requireIdentity(ctx, app, "", ruleAddUsage)
			if err != nil {
				return err
			}
			named = append(named, who)
		}
		typedShare, err := app.RequireText(ctx, *rollout, cli.TextPrompt{
			What: "--rollout", Message: "Share of them who get it, such as 100%", Usage: ruleAddUsage, Initial: "100%",
			Validate: func(answer string) (string, error) {
				_, err := parsePercent(answer)
				return answer, err
			},
		})
		if err != nil {
			return err
		}
		share, err := parsePercent(typedShare)
		if err != nil {
			return err
		}
		variants, err := variantsOf(ctx, app, projectID, flag)
		if err != nil {
			return err
		}
		serve := flags.Serve{RolloutPercentage: share}
		if *variantInput != "" {
			served := findVariant(variants, *variantInput)
			if served == nil {
				hint := "A boolean flag has no variants; leave out --variant."
				if len(variants) > 0 {
					hint = "Its variants: " + variantLabels(variants) + "."
				}
				return cli.Usagef("%q is not one of %s's variants.", *variantInput, flag.Key).WithHint(hint)
			}
			serve.VariantKey = &served.Key
		}
		before := flag.In(*env)
		taken := func(candidate string) bool {
			for _, rule := range before.Rules {
				if rule.ID == candidate {
					return true
				}
			}
			return false
		}
		if *id != "" && taken(*id) {
			return cli.Usagef("%s already has a rule %s in %s.", flag.Key, *id, *env).
				WithHint(fmt.Sprintf("Choose another --id, or remove it first: 'voidhash flag rule remove %s %s%s'.", flag.Key, *id, envSuffix(*env)))
		}
		base := *id
		if base == "" {
			base = ruleIDFor(*name, len(before.Rules)+1)
		}
		// A second rule of the same name takes a number.
		ruleID := base
		for number := 2; taken(ruleID) && number <= len(before.Rules)+2; number++ {
			ruleID = fmt.Sprintf("%s-%d", base, number)
		}
		rule := flags.Rule{ID: ruleID, Identities: []flags.Identity{}, Conditions: conditions, Serve: serve}
		if *name != "" {
			rule.Name = name
		}
		seen := map[identity]bool{}
		for _, who := range named {
			if !seen[who] {
				seen[who] = true
				rule.Identities = append(rule.Identities, flags.Identity{IdentityType: who.Type, IdentityValue: who.Value})
			}
		}
		config := before
		if *first {
			config.Rules = append([]flags.Rule{rule}, before.Rules...)
		} else {
			config.Rules = append(append([]flags.Rule{}, before.Rules...), rule)
		}
		updated, err := setEnvironment(ctx, app, projectID, flag.ID, *env, config)
		if err != nil {
			return err
		}
		lines := []string{fmt.Sprintf("Added rule %s to %s in %s: %s → %s.", ruleLabel(rule), flag.Key, *env, describeRuleMatch(rule), describeServe(rule.Serve, variants))}
		if *first || len(before.Rules) == 0 {
			lines = append(lines, "It is read first, after overrides.")
		} else {
			lines = append(lines, fmt.Sprintf("It is read after the %s before it; --first puts a rule first.", plural(len(before.Rules), "rule")))
		}
		if !before.IsEnabled {
			lines = append(lines, fmt.Sprintf("%s is off in %s, so nobody gets it there until 'voidhash flag enable %s%s'.", flag.Key, *env, flag.Key, envSuffix(*env)))
		}
		if *env == "test" && flag.Environments.Test == nil {
			lines = append(lines, testSplitsOff(flag))
		}
		return app.PrintItem(mode, updated, strings.Join(lines, "\n"))
	}
	return cmd
}

// newRuleRemove creates `voidhash flag rule remove [flag] [rule] [--env] [--yes]`.
func newRuleRemove(app *cli.App) *cobra.Command {
	const usage = "voidhash flag rule remove <flag> <rule>"
	cmd := &cobra.Command{
		Use:   "remove",
		Short: "Remove a rule from a flag.",
		Long:  "Remove a rule, so the end users it matches get what later rules or everyone else gets. In production on a flag that is on, it asks first; --yes skips that.",
		Example: `voidhash flag rule remove new-checkout beta-testers --yes
voidhash flag rule remove new-checkout "Beta testers" --env test`,
	}
	cli.SetArgs(cmd, flagArg, cli.Arg{Name: "rule", Help: "The rule's id or name; 'voidhash flag view' lists them", Optional: true})
	env := addEnvFlag(cmd)
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
		before := flag.In(*env)
		var typed *string
		if input := strings.TrimSpace(cli.ArgAt(args, 1)); input != "" {
			typed = &input
		}
		missing := func(message string) error {
			hint := "It has no rules there."
			if len(before.Rules) > 0 {
				hint = "Its rules: " + ruleLabels(before.Rules) + "."
			}
			return &cli.UserError{Message: message, Hint: hint, ExitCode: cli.ExitNotFound}
		}
		if typed == nil && len(before.Rules) == 0 {
			return missing(fmt.Sprintf("%s has no rules in %s.", flag.Key, *env))
		}
		choices := make([]cli.Choice[string], len(before.Rules))
		for index, rule := range before.Rules {
			choices[index] = cli.Choice[string]{Title: ruleLabel(rule), Value: rule.ID}
		}
		chosen, err := cli.RequireChoice(ctx, app, typed, cli.ChoicePrompt[string]{
			What: "the rule", Message: fmt.Sprintf("Which rule of %s in %s?", flag.Key, *env), Usage: usage, Choices: choices,
		})
		if err != nil {
			return err
		}
		var removed *flags.Rule
		config := before
		config.Rules = nil
		for index, rule := range before.Rules {
			if removed == nil && (rule.ID == chosen || (rule.Name != nil && strings.EqualFold(*rule.Name, chosen))) {
				removed = &before.Rules[index]
				continue
			}
			config.Rules = append(config.Rules, rule)
		}
		if removed == nil {
			return missing(fmt.Sprintf("%s has no rule %q in %s.", flag.Key, chosen, *env))
		}
		if *env == "production" && before.IsEnabled {
			matched := "The end users it matches"
			if len(removed.Conditions) == 0 {
				matched = "The " + plural(len(removed.Identities), "end user") + " it names"
			}
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf(
				"Remove rule %s from %s in production in %s? %s then get what the rules after it or everyone else gets.",
				ruleLabel(*removed), flag.Key, target.Label(), matched)); err != nil {
				return err
			}
		}
		updated, err := setEnvironment(ctx, app, projectID, flag.ID, *env, config)
		if err != nil {
			return err
		}
		lines := []string{fmt.Sprintf("Removed rule %s from %s in %s.", ruleLabel(*removed), flag.Key, *env)}
		if *env == "test" && flag.Environments.Test == nil {
			lines = append(lines, testSplitsOff(flag))
		}
		return app.PrintItem(mode, updated, strings.Join(lines, "\n"))
	}
	return cmd
}
