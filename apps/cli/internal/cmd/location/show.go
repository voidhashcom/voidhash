package location

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

const showingEnvUsage = "Whose apps it changes: production (the default), or test, which only apps using a test key see; test follows production until the location is given a test showing of its own"

// newShow creates `voidhash location show <location> <paywall> [--env] [--yes]`.
func newShow(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "show",
		Short: "Show a paywall's live build at a location from now on.",
		Long: `Show a paywall's live build at a location from now on. Deploying a newer build of the paywall updates the location too.

Asks first when it replaces what end users see there; --yes skips that. With --env test only apps using a test key see it, production keeps what it shows, and nothing is asked.`,
		Example: `voidhash location show home pro
voidhash location show home summer-sale --env test`,
	}
	cli.SetArgs(cmd, locationArg, paywallArg)
	env := addEnvFlag(cmd, showingEnvUsage)
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
		const usage = "voidhash location show <location> <paywall> [--env test]"
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		location := found.Value
		if err := refuseArchived(location); err != nil {
			return err
		}
		chosen, err := requireShowable(ctx, app, projectID, cli.ArgAt(args, 1), usage)
		if err != nil {
			return err
		}
		describe, _, err := paywalls.ShowingDescriber(ctx, app, projectID, paywalls.ShowingsOf(location))
		if err != nil {
			return err
		}
		setShowing := func() error {
			err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PaywallLocationsSetShowing(ctx, projectID, location.ID,
					&api.PaywallLocationsSetShowingParams{Environment: environmentOf(*env)},
					api.SetPaywallLocationShowingBodyJsonEncoding{PaywallId: chosen.paywall.Id})
			})
			return cli.APIError(err, map[string]string{
				"paywall_not_deployed": fmt.Sprintf("Deploy it first: 'voidhash paywall deploy %s'.", chosen.paywall.Slug),
			})
		}
		shows := func(showing *paywalls.Showing) bool {
			return showing != nil && showing.Type == "paywall" && showing.PaywallID != nil && *showing.PaywallID == chosen.paywall.Id
		}
		what := paywallLabel(chosen.paywall) + ", " + paywalls.BuildLabel(chosen.build.Number)

		if *env == "test" {
			if shows(location.TestShowing) {
				return app.PrintItem(mode, found, fmt.Sprintf("%s already shows %s in test; nothing changed.", label(location), paywallLabel(chosen.paywall)))
			}
			// Only apps using a test key see it, so there is nothing end users lose to confirm.
			if err := setShowing(); err != nil {
				return err
			}
			updated, err := getLocation(ctx, app, projectID, location.ID)
			if err != nil {
				return err
			}
			production := "nothing"
			if location.Showing != nil {
				production = describe(*location.Showing)
			}
			return app.PrintItem(mode, updated, strings.Join([]string{
				fmt.Sprintf("%s now shows %s, to apps using a test key. Production keeps showing %s.", label(updated.Value), what, production),
				fmt.Sprintf("  Show it to everyone:      'voidhash location show %s %s'", updated.Value.Slug, chosen.paywall.Slug),
				fmt.Sprintf("  Follow production again:  'voidhash location clear %s --env test'", updated.Value.Slug),
			}, "\n"))
		}

		if shows(location.Showing) {
			return app.PrintItem(mode, found, fmt.Sprintf("%s already shows %s; nothing changed.", label(location), paywallLabel(chosen.paywall)))
		}
		if location.Showing != nil {
			ends := ""
			if location.Showing.Type == "feature_flag" {
				ends = " This ends the experiment's split there."
			}
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Show %s, at %s in %s instead of %s?%s End users there see it on their next visit.",
				what, label(location), target.Label(), describe(*location.Showing), ends)); err != nil {
				return err
			}
		}
		if err := setShowing(); err != nil {
			return err
		}
		updated, err := getLocation(ctx, app, projectID, location.ID)
		if err != nil {
			return err
		}
		keeps := ""
		if updated.Value.TestShowing != nil {
			keeps = " Apps using a test key keep seeing its test showing."
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("%s now shows %s. Deploying a newer build of it updates the location too.%s", label(updated.Value), what, keeps))
	}
	return cmd
}

// newClear creates `voidhash location clear <location> [--env] [--yes]`.
func newClear(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "clear",
		Short: "Stop showing anything at a location, so apps asking for it get no paywall.",
		Long: `Stop showing anything at a location, so apps asking for it get no paywall. Asks first; --yes skips that.

With --env test it ends the location's test showing instead, so apps using a test key get what production shows again; nothing is asked, because nothing changes for end users.`,
		Example: `voidhash location clear home
voidhash location clear home --env test`,
	}
	cli.SetArgs(cmd, locationArg)
	env := addEnvFlag(cmd, showingEnvUsage)
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
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash location clear <location> [--env test] --yes")
		if err != nil {
			return err
		}
		location := found.Value
		if *env == "test" {
			if location.TestShowing == nil {
				return app.PrintItem(mode, found, label(location)+"'s test already follows production; nothing changed.")
			}
			// Test keys go back to what production shows; nothing changes for end users.
			if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.PaywallLocationsClearShowing(ctx, projectID, location.ID, &api.PaywallLocationsClearShowingParams{Environment: environmentOf("test")})
			}); err != nil {
				return err
			}
			updated, err := getLocation(ctx, app, projectID, location.ID)
			if err != nil {
				return err
			}
			production := "nothing"
			if mode == cli.Human && updated.Value.Showing != nil {
				describe, _, err := paywalls.ShowingDescriber(ctx, app, projectID, paywalls.ShowingsOf(updated.Value))
				if err != nil {
					return err
				}
				production = describe(*updated.Value.Showing)
			}
			return app.PrintItem(mode, updated, fmt.Sprintf("%s: test follows production again (%s).", label(updated.Value), production))
		}
		if location.Showing == nil {
			return app.PrintItem(mode, found, label(location)+" already shows nothing; nothing changed.")
		}
		describe, _, err := paywalls.ShowingDescriber(ctx, app, projectID, []paywalls.Showing{*location.Showing})
		if err != nil {
			return err
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Stop showing %s at %s in %s? Apps that ask for %q get no paywall from then on.",
			describe(*location.Showing), label(location), target.Label(), location.Slug)); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsClearShowing(ctx, projectID, location.ID, nil)
		}); err != nil {
			return err
		}
		updated, err := getLocation(ctx, app, projectID, location.ID)
		if err != nil {
			return err
		}
		keeps := ""
		if updated.Value.TestShowing != nil {
			keeps = " Apps using a test key keep seeing its test showing."
		}
		return app.PrintItem(mode, updated, label(updated.Value)+" shows nothing now."+keeps)
	}
	return cmd
}
