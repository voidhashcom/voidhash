package paywall

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// newWithdraw creates `voidhash paywall withdraw|restore <paywall> --build <number> [--yes]`.
func newWithdraw(app *cli.App, withdraw bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "restore",
		Short: "Serve a withdrawn build again wherever it is placed.",
		Long: `Restore a withdrawn build: every location, rule, pin and experiment arm that names it serves it again, and it can be deployed.

Asks first when anyone would be served it again; --yes skips that. To restore an archived paywall, use 'voidhash paywall unarchive'.`,
		Example: `voidhash paywall restore pro --build 4
voidhash paywall restore pro --build 4 --yes`,
	}
	if withdraw {
		cmd.Use = "withdraw"
		cmd.Short = "Stop serving a bad build anywhere, in production and test."
		cmd.Long = `Withdraw a bad build, in production and test at once: no app is served it again, whether through a location's showing, rules or pins or an experiment arm. Each of those serves the most recent earlier build deployed there that is not withdrawn and fits the location instead, an arm preferring the builds it kept before, or no paywall when there is none. Apps that cannot show a newer build are never given it either.

Nothing deployed or placed changes. The build cannot be deployed until 'voidhash paywall restore' restores it; to put a fixed design in front of people, deploy it afterwards with 'voidhash paywall deploy'.

Lists each place that serves the build and what it serves instead, then asks; --yes skips that.`
		cmd.Example = `voidhash paywall withdraw pro --build 4
voidhash paywall withdraw pro --build 4 --yes`
	}
	verb := cmd.Use
	cli.SetArgs(cmd, paywallArg)
	buildFlag := cmd.Flags().String("build", "", "The build, by `number` or id")
	yes := cli.AddYesFlag(cmd)
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
		usage := fmt.Sprintf("voidhash paywall %s <paywall> --build <number>", verb)
		found, err := paywalls.RequirePaywall(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		paywall := found.Value
		// A restore names a withdrawn build, which may be older than the recent ones listed.
		list := paywalls.ListBuilds
		if !withdraw {
			list = paywalls.ListWithdrawnBuilds
		}
		builds, err := list(ctx, app, projectID, paywall.Id)
		if err != nil {
			return err
		}
		var passed *string
		if *buildFlag != "" {
			passed = buildFlag
		}
		var choices []cli.Choice[string]
		for _, build := range builds.Items {
			if build.Status == "ready" && build.IsWithdrawn != withdraw {
				choices = append(choices, cli.Choice[string]{Title: buildChoiceTitle(build), Value: build.ID})
			}
		}
		if passed == nil && len(choices) == 0 {
			if withdraw {
				return cli.Failf("%s has no ready build to withdraw.", label(paywall))
			}
			return cli.Failf("%s has no withdrawn build.", label(paywall))
		}
		chosen, err := cli.RequireChoice(ctx, app, passed, cli.ChoicePrompt[string]{
			What: "--build", Message: "Which build?", Usage: usage, Choices: choices,
		})
		if err != nil {
			return err
		}
		index := paywalls.FindBuild(builds.Items, chosen)
		if index < 0 && !withdraw {
			// Not withdrawn: found among the recent builds, it is said to be as asked.
			if builds, err = paywalls.ListBuilds(ctx, app, projectID, paywall.Id); err != nil {
				return err
			}
			index = paywalls.FindBuild(builds.Items, chosen)
		}
		if index < 0 {
			return &cli.UserError{
				Message:  fmt.Sprintf("%s has no build %s.", label(paywall), chosen),
				Hint:     fmt.Sprintf("'voidhash paywall view %s' lists its recent builds.", paywall.Slug),
				ExitCode: cli.ExitNotFound,
			}
		}
		build := builds.Object(index)
		if build.Value.Status != "ready" {
			return cli.Failf("Build #%d of %s is %s, so it was never served: there is nothing to %s.", build.Value.Number, label(paywall), build.Value.Status, verb)
		}
		name := paywalls.BuildLabel(build.Value.Number)
		if build.Value.IsWithdrawn == withdraw {
			state := "not withdrawn"
			if withdraw {
				state = "already withdrawn"
			}
			return app.PrintItem(mode, build, fmt.Sprintf("%s of %s is %s; nothing changed.", capitalize(name), label(paywall), state))
		}
		withdrawal, err := cli.Fetch[api.PaywallBuildWithdrawalJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsGetBuildWithdrawal(ctx, projectID, paywall.Id, build.Value.ID)
		})
		if err != nil {
			return err
		}
		places := withdrawalPlaces(withdrawal.Value, withdraw, name)
		if len(places) > 0 {
			question := fmt.Sprintf("Withdraw %s of %s in %s? From their next visit:\n%s", name, label(paywall), target.Label(), strings.Join(places, "\n"))
			if !withdraw {
				question = fmt.Sprintf("Restore %s of %s in %s? From their next visit:\n%s", name, label(paywall), target.Label(), strings.Join(places, "\n"))
			}
			if err := app.ConfirmChange(ctx, *yes, question); err != nil {
				return err
			}
		}
		changed, err := cli.Fetch[paywalls.Build](ctx, app, func(c *api.Client) (*http.Response, error) {
			if withdraw {
				return c.PaywallsWithdrawBuild(ctx, projectID, paywall.Id, build.Value.ID)
			}
			return c.PaywallsRestoreBuild(ctx, projectID, paywall.Id, build.Value.ID)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_withdrawal_limit": fmt.Sprintf("Restore a build that no longer needs to be withdrawn: 'voidhash paywall restore %s --build <number>'.", paywall.Slug),
			})
		}
		if !withdraw {
			return app.PrintItem(mode, changed, fmt.Sprintf("Restored %s of %s; it can be deployed again.", name, label(paywall)))
		}
		summary := fmt.Sprintf("Withdrew %s of %s; no app is served it from their next visit.", name, label(paywall))
		if len(places) == 0 {
			summary += " Nothing served it."
		}
		return app.PrintItem(mode, changed, summary+fmt.Sprintf("\n'voidhash paywall restore %s --build %d' puts it back.", paywall.Slug, changed.Value.Number))
	}
	return cmd
}

// buildChoiceTitle is how a build reads among choices: "build #4, ready, live".
func buildChoiceTitle(build paywalls.Build) string {
	return paywalls.BuildLabel(build.Number) + ", " + paywalls.BuildStatus(build)
}

// withdrawalPlaces lists, one line each, the places that serve the build
// and what they serve while it is withdrawn: what a withdrawal moves them to,
// or what a restore moves them from.
func withdrawalPlaces(withdrawal api.PaywallBuildWithdrawalJsonEncoding, withdraw bool, name string) []string {
	lines := make([]string, 0, len(withdrawal.Placements))
	for _, placement := range withdrawal.Placements {
		keys := "end users"
		if placement.Environment == api.PaywallBuildWithdrawalPlacementEnvironmentTest {
			keys = "apps using a test key"
		}
		where := placement.PaywallLocationName
		if placement.Kind == api.PaywallBuildWithdrawalPlacementKindTestArm {
			where = fmt.Sprintf("arm %s of %s at %s", deref(placement.VariantName), deref(placement.ExperimentName), placement.PaywallLocationName)
		}
		instead := "no paywall"
		if placement.ServedBuildNumber != nil {
			instead = paywalls.BuildLabel(*placement.ServedBuildNumber)
		}
		if withdraw {
			lines = append(lines, fmt.Sprintf("  %s: %s get %s", where, keys, instead))
		} else {
			lines = append(lines, fmt.Sprintf("  %s: %s get %s again instead of %s", where, keys, name, instead))
		}
	}
	// An arm of a running experiment goes on counting people while they are shown another build.
	if withdraw {
		seen := map[string]bool{}
		for _, placement := range withdrawal.Placements {
			name := deref(placement.ExperimentName)
			if placement.Kind != api.PaywallBuildWithdrawalPlacementKindTestArm || placement.IsPaused || seen[name] {
				continue
			}
			seen[name] = true
			lines = append(lines, fmt.Sprintf("  The running experiment %s goes on counting people in that arm while they get another build: consider pausing it ('voidhash experiment pause') until the arm has a fixed build.", name))
		}
	}
	if withdrawal.IsTestArmsHidden {
		lines = append(lines, "  Experiment arms are not listed: this key cannot read experiments.")
	}
	return lines
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func capitalize(text string) string {
	if text == "" {
		return text
	}
	return strings.ToUpper(text[:1]) + text[1:]
}
