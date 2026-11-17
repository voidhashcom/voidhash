// Package flag holds `voidhash flag`: the project's feature flags. Who gets
// a flag is set per environment, production and test, and read top to
// bottom: switched off, the flag is off for everyone there; then an end
// user's override decides; then the rules, in order; then the share
// everyone else gets, and among variants the split. Test follows production
// until something is changed in it.
//
// A rule matches the end users it names, and everyone all its conditions
// hold for: --when conditions on a person's traits and on what their app
// reports.
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

// New creates `voidhash flag`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "flag",
		Aliases: []string{"flags"},
		Short:   "Feature flags: roll features out, fix them for testers, and see who gets what.",
		Long: `Feature flags: turn features on for a share of end users in production or in test, fix them for testers, and see why someone gets what.

Who gets a flag is set per environment and read top to bottom: switched off, it is off for everyone there; then an end user's override decides; then the rules, in order; then the share everyone else gets. Test, which apps using a test key read, follows production until something is changed in it.`,
	}
	variants := &cobra.Command{
		Use:   "variants",
		Short: "The values a string, number or json flag hands out.",
	}
	variants.AddCommand(newVariantsSet(app))
	rule := &cobra.Command{
		Use:     "rule",
		Aliases: []string{"rules"},
		Short:   "Rules: what share of the end users they match get the flag.",
		Long:    "Rules say what share of the end users they match get the flag: those a rule names one by one, and everyone its --when conditions hold for. 'voidhash flag view' shows them in the order they are read.",
	}
	rule.AddCommand(newRuleAdd(app), newRuleRemove(app))
	cmd.AddCommand(
		newList(app), newView(app), newCreate(app),
		newEnable(app), newDisable(app), newRollout(app),
		newEdit(app), variants, newOverride(app), rule,
		newFollow(app), newPromote(app), newEvaluate(app),
		newArchive(app), newRestore(app),
	)
	return cmd
}

var flagArg = cli.Arg{Name: "flag", Help: "The flag's key or id", Optional: true}

var personArg = cli.Arg{
	Name:     "person",
	Help:     "The end user: an email, a distinct id or a person id (person_…); prefix email:, distinct_id:, person_id: or external_id: to say which",
	Optional: true,
}

// addEnvFlag adds --env production|test to a command that reads or changes
// one environment.
func addEnvFlag(cmd *cobra.Command) *string {
	return cli.AddChoiceFlag(cmd, "env", "", []string{"production", "test"}, "production",
		"The environment: production, or test, which apps using a test key read; test follows production until something is changed in it")
}

// variant is a value a flag hands out, as the API sends it.
type variant struct {
	ID               string          `json:"id"`
	Key              string          `json:"key"`
	Label            *string         `json:"label"`
	Value            json.RawMessage `json:"value"`
	WeightPercentage float64         `json:"weightPercentage"`
}

func variantLabel(v variant) string {
	if v.Label == nil {
		return formatValue(v.Value)
	}
	return *v.Label + " (" + formatValue(v.Value) + ")"
}

func variantLabels(variants []variant) string {
	labels := make([]string, len(variants))
	for index, one := range variants {
		labels[index] = variantLabel(one)
	}
	return strings.Join(labels, ", ")
}

// findVariant is the variant input names: by its id or key, its label, or
// its value.
func findVariant(variants []variant, input string) *variant {
	for index, candidate := range variants {
		var text string
		isText := json.Unmarshal(candidate.Value, &text) == nil
		if candidate.ID == input || candidate.Key == input ||
			(candidate.Label != nil && strings.EqualFold(*candidate.Label, input)) ||
			formatValue(candidate.Value) == input || (isText && text == input) {
			return &variants[index]
		}
	}
	return nil
}

func variantByKey(variants []variant, key string) *variant {
	for index := range variants {
		if variants[index].Key == key {
			return &variants[index]
		}
	}
	return nil
}

func listVariants(ctx context.Context, app *cli.App, projectID, flagID string) (cli.List[variant], error) {
	return cli.ListAll[variant](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.FeatureFlagsListVariants(ctx, projectID, flagID, &api.FeatureFlagsListVariantsParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// variantsOf is the variants of a flag that can have some: a boolean flag
// is on or off, so nothing is asked for it.
func variantsOf(ctx context.Context, app *cli.App, projectID string, flag flags.Flag) ([]variant, error) {
	if flag.Type == "boolean" {
		return nil, nil
	}
	list, err := listVariants(ctx, app, projectID, flag.ID)
	return list.Items, err
}

// requireFlag is the flag a command names, among every flag of the project,
// archived ones included.
func requireFlag(ctx context.Context, app *cli.App, projectID, input, usage string) (cli.Object[flags.Flag], error) {
	inUse, err := flags.List(ctx, app, projectID, false)
	if err != nil {
		return cli.Object[flags.Flag]{}, err
	}
	archived, err := flags.List(ctx, app, projectID, true)
	if err != nil {
		return cli.Object[flags.Flag]{}, err
	}
	return flags.RequireObject(ctx, app, flags.Kind, flags.Concat(inUse, archived), input, usage)
}

// getFlag reads a flag again, to print it as the API has it after a change
// whose answer is not the flag.
func getFlag(ctx context.Context, app *cli.App, projectID, flagID string) (cli.Object[flags.Flag], error) {
	return cli.Fetch[flags.Flag](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.FeatureFlagsGet(ctx, projectID, flagID)
	})
}

// setEnvironment replaces a flag's whole configuration in an environment.
func setEnvironment(ctx context.Context, app *cli.App, projectID, flagID, environment string, config flags.Environment) (cli.Object[flags.Flag], error) {
	body, err := json.Marshal(config.Body())
	if err != nil {
		return cli.Object[flags.Flag]{}, err
	}
	return cli.Fetch[flags.Flag](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.FeatureFlagsSetEnvironmentWithBody(ctx, projectID, flagID, api.FeatureFlagEnvironmentName(environment), "application/json", bytes.NewReader(body))
	})
}

func plural(count int, noun string) string {
	if count == 1 {
		return fmt.Sprintf("1 %s", noun)
	}
	return fmt.Sprintf("%d %ss", count, noun)
}

// environmentState says whether an environment is on, and for what share of
// the end users no rule matches.
func environmentState(config flags.Environment) string {
	if !config.IsEnabled {
		return "off"
	}
	state := "on for " + flags.Percent(config.Fallthrough.RolloutPercentage)
	if len(config.Rules) > 0 {
		state += ", " + plural(len(config.Rules), "rule")
	}
	return state
}

// flagState says whether a flag is on in production, and for whom, before
// overrides and rules.
func flagState(flag flags.Flag) string {
	if flag.IsArchived {
		return "archived"
	}
	return environmentState(flag.Environments.Production)
}

// testState says what apps using a test key get: production's answers, or
// test's own.
func testState(flag flags.Flag) string {
	if flag.Environments.Test == nil {
		return "follows production"
	}
	return environmentState(*flag.Environments.Test)
}

// testSplitsOff says what a first change in test does to a flag whose test
// still follows production.
func testSplitsOff(flag flags.Flag) string {
	return fmt.Sprintf("Test now has a configuration of its own, started from production's. 'voidhash flag follow %s' makes it follow production again.", flag.Key)
}

// envSuffix is the flag that repeats a command for the same environment.
func envSuffix(environment string) string {
	if environment == "test" {
		return " --env test"
	}
	return ""
}

// managedByExperiment refuses to change a flag an experiment owns.
func managedByExperiment(flag flags.Flag, hint string) error {
	return cli.Failf("%s assigns the arms of experiment %s.", flag.Key, *flag.ExperimentID).
		WithHint(fmt.Sprintf(hint, *flag.ExperimentID))
}

// describeServe says what a share of people gets: "25% get it", "100% get
// it, Red ("red")", "nobody gets it".
func describeServe(serve flags.Serve, variants []variant) string {
	if serve.RolloutPercentage == 0 {
		return "nobody gets it"
	}
	text := flags.Percent(serve.RolloutPercentage) + " get it"
	if serve.VariantKey != nil {
		text += ", " + variantName(variants, *serve.VariantKey)
	}
	return text
}

// variantName is the variant with key as people read it, or the key itself
// when the flag no longer has it.
func variantName(variants []variant, key string) string {
	if found := variantByKey(variants, key); found != nil {
		return variantLabel(*found)
	}
	return key
}

func ruleLabel(rule flags.Rule) string {
	if rule.Name == nil {
		return rule.ID
	}
	return rule.ID + " (" + *rule.Name + ")"
}

func ruleLabels(rules []flags.Rule) string {
	labels := make([]string, len(rules))
	for index, rule := range rules {
		labels[index] = ruleLabel(rule)
	}
	return strings.Join(labels, ", ")
}

var conditionSubjects = map[string]string{
	"platform":    "platform",
	"app_version": "app version",
	"os_version":  "OS version",
	"country":     "country",
	"locale":      "locale",
}

// describeCondition is a condition in words: "country is DE or AT", "app
// version is 2.4 or newer".
func describeCondition(condition flags.Condition) string {
	subject, known := conditionSubjects[condition.Attribute]
	if condition.Attribute == "trait" {
		key := "?"
		if condition.Key != nil {
			key = *condition.Key
		}
		subject = "trait " + key
	} else if !known {
		subject = condition.Attribute
	}
	first := "?"
	if len(condition.Values) > 0 {
		first = condition.Values[0]
	}
	switch condition.Op {
	case "in":
		return subject + " is " + strings.Join(condition.Values, " or ")
	case "not_in":
		return subject + " is not " + strings.Join(condition.Values, " or ")
	case "gte":
		return subject + " is " + first + " or newer"
	case "lt":
		return subject + " is older than " + first
	case "is_set":
		return subject + " is set"
	case "is_not_set":
		return subject + " is not set"
	default:
		// A comparison newer than this CLI: shown as the API names it.
		return strings.TrimSpace(subject + " " + condition.Op + " " + strings.Join(condition.Values, ","))
	}
}

// describeRuleMatch says who a rule matches: the end users it names, and
// everyone its conditions hold for.
func describeRuleMatch(rule flags.Rule) string {
	var parts []string
	if len(rule.Identities) > 0 {
		named := make([]string, len(rule.Identities))
		for index, one := range rule.Identities {
			named[index] = identityLabel(one.IdentityType, one.IdentityValue)
		}
		parts = append(parts, strings.Join(named, ", "))
	}
	if len(rule.Conditions) > 0 {
		conditions := make([]string, len(rule.Conditions))
		for index, condition := range rule.Conditions {
			conditions[index] = describeCondition(condition)
		}
		parts = append(parts, "everyone whose "+strings.Join(conditions, " and "))
	}
	if len(parts) == 0 {
		return "nobody"
	}
	return strings.Join(parts, ", and ")
}

// describeEnvironment is one environment as lines, in the order it is read:
// overrides, rules, everyone else.
func describeEnvironment(config flags.Environment, variants []variant) string {
	lines := []string{"off for everyone, overrides included"}
	if config.IsEnabled {
		lines[0] = "on for " + flags.Percent(config.Fallthrough.RolloutPercentage) + " of end users"
		if len(config.Rules) > 0 {
			lines[0] += " no rule matches"
		}
	}
	for _, override := range config.Overrides {
		setting := "off"
		switch {
		case override.VariantKey != nil:
			setting = "on, " + variantName(variants, *override.VariantKey)
		case override.IsEnabled:
			setting = "on"
		}
		lines = append(lines, fmt.Sprintf("Override  %s: %s", identityLabel(override.IdentityType, override.IdentityValue), setting))
	}
	for index, rule := range config.Rules {
		lines = append(lines, fmt.Sprintf("Rule %d    %s: %s → %s", index+1, ruleLabel(rule), describeRuleMatch(rule), describeServe(rule.Serve, variants)))
	}
	return strings.Join(append(lines, "Everyone else: "+describeServe(config.Fallthrough, variants)), "\n")
}

func keyTakenHint(key string) string {
	return fmt.Sprintf("Choose another --key, or bring back the archived flag with 'voidhash flag restore %s'.", key)
}

// requireIdentity is the end user a command names, asked for on a terminal.
func requireIdentity(ctx context.Context, app *cli.App, input, usage string) (identity, error) {
	text, err := app.RequireText(ctx, input, cli.TextPrompt{
		What: "the end user (<person>)", Message: "Email, distinct id or person id", Usage: usage,
	})
	if err != nil {
		return identity{}, err
	}
	return parseIdentity(text), nil
}
