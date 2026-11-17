package location

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

var pinnedArg = cli.Arg{
	Name:     "person",
	Help:     "The end user: an email, a distinct id or a person id (person_…); prefix email:, distinct_id: or person_id: to say which",
	Optional: true,
}

const pinEnvUsage = "Whose apps the pin answers: production (the default), which answers every app, or test, which answers apps using a test key only and wins there"

// requirePinned reads the end user a pin names; a pin cannot name one by an
// external id.
func requirePinned(ctx context.Context, app *cli.App, input, usage string) (identity, error) {
	typed, err := app.RequireText(ctx, input, cli.TextPrompt{What: "<person>", Message: "Email, distinct id or person id", Usage: usage})
	if err != nil {
		return identity{}, err
	}
	named := parseIdentity(typed)
	if named.Type == "external_id" {
		return identity{}, cli.Usagef("A pin names an end user by email, distinct id or person id.").
			WithHint("An external id cannot be pinned; name them by one of those instead.")
	}
	return named, nil
}

// pinSegment is a pin's end user as the path names them: "email:ada@example.com".
func pinSegment(named identity) string { return named.Type + ":" + named.Value }

func testSuffix(env, suffix string) string {
	if env == "test" {
		return suffix
	}
	return ""
}

// newPin creates `voidhash location pin <location> <person> <paywall> [--env] [--note]`.
func newPin(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "pin",
		Short: "Show one end user a paywall of their own at a location.",
		Long: `Show one end user a paywall of their own at a location, whatever it shows everyone else; they are outside an experiment running there. Pinning them again changes their pin.

With --env test the pin answers apps using a test key only. A pin shows only where the location shows something.`,
		Example: `voidhash location pin home ada@example.com pro --note QA
voidhash location pin home distinct_id:device-qa pro --env test`,
	}
	cli.SetArgs(cmd, locationArg, pinnedArg, paywallArg)
	note := cmd.Flags().String("note", "", "Why, such as QA")
	env := addEnvFlag(cmd, pinEnvUsage)
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
		const usage = "voidhash location pin <location> <person> <paywall> [--env test]"
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		location := found.Value
		if err := refuseArchived(location); err != nil {
			return err
		}
		named, err := requirePinned(ctx, app, cli.ArgAt(args, 1), usage)
		if err != nil {
			return err
		}
		chosen, err := requireShowable(ctx, app, projectID, cli.ArgAt(args, 2), usage)
		if err != nil {
			return err
		}
		body := api.PutPaywallLocationPinBodyJsonEncoding{PaywallId: chosen.paywall.Id}
		if *note != "" {
			body.Note = note
		}
		saved, err := cli.Fetch[pin](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsUpsertPin(ctx, projectID, location.ID, pinSegment(named),
				&api.PaywallLocationsUpsertPinParams{Environment: environmentOf(*env)}, body)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_not_deployed":       fmt.Sprintf("Deploy it first: 'voidhash paywall deploy %s'.", chosen.paywall.Slug),
				"paywall_location_pin_limit": fmt.Sprintf("'voidhash location view %s' lists its pins; remove one with 'voidhash location unpin'.", location.Slug),
			})
		}
		who := identityLabel(string(saved.Value.IdentityType), saved.Value.IdentityValue)
		// The kind starts the sentence: "Distinct id device-qa now sees …".
		who = strings.ToUpper(who[:1]) + who[1:]
		human := fmt.Sprintf("%s now sees %s, %s, at %s%s, whatever it shows everyone else.",
			who, paywallLabel(chosen.paywall), paywalls.BuildLabel(chosen.build.Number), label(location), testSuffix(*env, " in apps using a test key"))
		// What the location shows everyone else there: test follows production without its own.
		shown, where := location.Showing, "in production"
		if *env == "test" {
			where = "to test keys"
			if location.TestShowing != nil {
				shown = location.TestShowing
			}
		}
		switch {
		case shown == nil:
			human += fmt.Sprintf("\n%s shows nothing %s, and a pin shows only where the location shows something: 'voidhash location show %s <paywall>'.",
				label(location), where, location.Slug)
		case shown.Type == "feature_flag":
			human += "\nThey are outside the experiment running there: not in an arm, and not counted."
		}
		human += fmt.Sprintf("\n  Undo it: 'voidhash location unpin %s %s:%s%s'",
			location.Slug, saved.Value.IdentityType, saved.Value.IdentityValue, testSuffix(*env, " --env test"))
		return app.PrintItem(mode, saved, human)
	}
	return cmd
}

// newUnpin creates `voidhash location unpin <location> <person> [--env]`.
func newUnpin(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "unpin",
		Short: "Remove an end user's pin at a location.",
		Long:  "Remove an end user's pin at a location, in production or in test with --env test, so they see what it shows everyone else again.",
		Example: `voidhash location unpin home ada@example.com
voidhash location unpin home distinct_id:device-qa --env test`,
	}
	cli.SetArgs(cmd, locationArg, pinnedArg)
	env := addEnvFlag(cmd, pinEnvUsage)
	project := cli.AddProjectFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		const usage = "voidhash location unpin <location> <person> [--env test]"
		found, err := paywalls.RequireLocation(ctx, app, target.Project.Id, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		location := found.Value
		named, err := requirePinned(ctx, app, cli.ArgAt(args, 1), usage)
		if err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsRemovePin(ctx, target.Project.Id, location.ID, pinSegment(named),
				&api.PaywallLocationsRemovePinParams{Environment: environmentOf(*env)})
		}); err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_location_pin_not_found": fmt.Sprintf("'voidhash location view %s' lists its pins in each environment.", location.Slug),
			})
		}
		app.Println(cli.Printable(fmt.Sprintf("Removed the %s pin of %s at %s; they see what it shows everyone else again.",
			*env, identityLabel(named.Type, named.Value), label(location))))
		return nil
	}
	return cmd
}
