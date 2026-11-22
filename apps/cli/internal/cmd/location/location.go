// Package location holds `voidhash location`: the places in an app that
// show a paywall, and what each shows.
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

// New creates `voidhash location`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "location",
		Aliases: []string{"locations"},
		Short:   "The places in your apps that show a paywall, and what each shows.",
		Long: `The places in your apps that show a paywall: list and view them, choose what each shows, show an end user or a group a paywall of their own, and see what they showed before.

An app asks for a location by its slug and gets the paywall it shows. What is asked first decides: an end user's pin, then the first rule that matches them, then what the location shows everyone. Apps using a test key get the same unless the location is given a test showing, pins or rules of its own (--env test).`,
	}
	cmd.AddCommand(newList(app), newView(app), newCreate(app), newEdit(app), newShow(app), newClear(app),
		newPin(app), newUnpin(app), newRule(app), newHistory(app), newArchive(app), newBundle(app))
	return cmd
}

var (
	locationArg = cli.Arg{Name: "location", Help: "The location's slug, name or id", Optional: true}
	paywallArg  = cli.Arg{Name: "paywall", Help: "The paywall's slug, name or id", Optional: true}
)

func label(location paywalls.Location) string { return paywalls.LocationKind.Label(location) }

func paywallLabel(paywall paywalls.Paywall) string { return paywalls.PaywallKind.Label(paywall) }

// addEnvFlag adds --env production|test.
func addEnvFlag(cmd *cobra.Command, usage string) *string {
	return cli.AddChoiceFlag(cmd, "env", "", []string{"production", "test"}, "production", usage)
}

func environmentOf(env string) *api.PaywallLocationEnvironment {
	environment := api.PaywallLocationEnvironment(env)
	return &environment
}

// showable is a paywall with the live build a location would show.
type showable struct {
	paywall paywalls.Paywall
	build   paywalls.Build
}

// requireShowable finds the paywall people name to show, once it has a live
// build to show. A missing name is asked for among the unarchived paywalls.
func requireShowable(ctx context.Context, app *cli.App, projectID, input, usage string) (showable, error) {
	all, err := paywalls.ListPaywalls(ctx, app, projectID)
	if err != nil {
		return showable{}, err
	}
	var paywall paywalls.Paywall
	if input == "" {
		inUse := all.Filter(func(paywall paywalls.Paywall) bool { return !paywall.IsArchived })
		paywall, err = cli.RequireItem(ctx, app, paywalls.PaywallKind, inUse.Items, "", usage)
	} else {
		paywall, err = cli.FindItem(paywalls.PaywallKind, all.Items, input)
	}
	if err != nil {
		return showable{}, err
	}
	builds, err := paywalls.ListBuilds(ctx, app, projectID, paywall.Id)
	if err != nil {
		return showable{}, err
	}
	live, ok := paywalls.DeployedBuild(builds.Items)
	if !ok {
		return showable{}, cli.Failf("%s has no live build, so there is nothing to show.", paywallLabel(paywall)).
			WithHint(fmt.Sprintf("Deploy it first: 'voidhash paywall deploy %s'.", paywall.Slug))
	}
	if warning := paywalls.WithdrawnLiveWarning(live); warning != "" {
		app.Warnf("%s", warning)
	}
	return showable{paywall: paywall, build: live}, nil
}

// testRunningHint is what to do when a running experiment holds a location.
const testRunningHint = "Pause the experiment first ('voidhash experiment pause <experiment>'): everyone then sees its control arm, and the change can go ahead."

// refuseArchived fails for a location that is archived, which cannot show
// anything again.
func refuseArchived(location paywalls.Location) error {
	if !location.IsArchived {
		return nil
	}
	return cli.Failf("%s is archived, so it cannot show anything again.", label(location)).
		WithHint("Create a new location with 'voidhash location create'.")
}

func getLocation(ctx context.Context, app *cli.App, projectID, id string) (cli.Object[paywalls.Location], error) {
	return cli.Fetch[paywalls.Location](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaywallLocationsGet(ctx, projectID, id)
	})
}

// newList creates `voidhash location list [--archived]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the places in your apps that show a paywall, with what each shows now.",
		Long:  "List the places in your apps that show a paywall, with what each shows now, and what apps using a test key see where that differs.",
		Example: `voidhash location list
voidhash location list --archived --json`,
	}
	archived := cmd.Flags().Bool("archived", false, "List only archived ones")
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
		all, err := paywalls.ListLocations(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		locations := all.Filter(func(location paywalls.Location) bool { return location.IsArchived == *archived })
		switch mode {
		case cli.JSON:
			return app.PrintJSON(locations)
		case cli.Quiet:
			app.PrintIDs(locations)
			return nil
		}
		empty := "No locations yet. Create one with 'voidhash location create'."
		if *archived {
			empty = "No archived locations."
		}
		if len(locations.Items) == 0 {
			app.Println(empty)
			return nil
		}
		describe, _, err := paywalls.ShowingDescriber(ctx, app, target.Project.Id, paywalls.ShowingsOf(locations.Items...))
		if err != nil {
			return err
		}
		columns := []cli.Column[paywalls.Location]{
			{Header: "NAME", Cell: func(location paywalls.Location) string { return location.Name }},
			{Header: "SLUG", Cell: func(location paywalls.Location) string { return location.Slug }},
			{Header: "SHOWS", Cell: func(location paywalls.Location) string {
				if location.Showing == nil {
					return "nothing"
				}
				return describe(*location.Showing)
			}},
			{Header: "SINCE", Cell: func(location paywalls.Location) string {
				if location.Showing == nil {
					return "-"
				}
				return app.FormatTimeAgo(location.Showing.StartedAt)
			}},
		}
		// Only when a location shows test keys something of its own; otherwise test is the same.
		for _, location := range locations.Items {
			if location.TestShowing != nil {
				columns = append(columns, cli.Column[paywalls.Location]{Header: "IN TEST", Cell: func(location paywalls.Location) string {
					if location.TestShowing == nil {
						return "the same"
					}
					return describe(*location.TestShowing)
				}})
				break
			}
		}
		columns = append(columns, cli.Column[paywalls.Location]{Header: "ID", Cell: func(location paywalls.Location) string { return location.ID }})
		cli.PrintTable(app, columns, locations.Items, empty)
		return nil
	}
	return cmd
}

// pin is one end user's paywall of their own at a location.
type pin = api.PaywallLocationPinJsonEncoding

func describePin(pinned pin, all []paywalls.Paywall) string {
	line := identityLabel(string(pinned.IdentityType), pinned.IdentityValue) + " → " + paywalls.PaywallName(all, pinned.PaywallId)
	if pinned.Environment == "test" {
		line += ", test keys only"
	}
	if pinned.Note != nil {
		line += " (" + *pinned.Note + ")"
	}
	return line
}

// newView creates `voidhash location view <location>`.
func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a location: what it shows now, in test, to pinned end users and by rule, and before.",
		Long:  "Show a location: what it shows now, what apps using a test key see, the end users pinned to a paywall of their own, its rules in the order they are read, and what it showed before. With --json the location is printed with pins, rules and history (its five most recent showings) added.",
		Example: `voidhash location view home
voidhash location view home --json`,
	}
	cli.SetArgs(cmd, locationArg)
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
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash location view <location>")
		if err != nil {
			return err
		}
		if mode == cli.Quiet {
			app.PrintIDs(found)
			return nil
		}
		location := found.Value
		limit := 5
		history, _, err := cli.FetchPage[paywalls.Showing](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsListShowings(ctx, projectID, location.ID, &api.PaywallLocationsListShowingsParams{Limit: &limit})
		})
		if err != nil {
			return err
		}
		pins, err := cli.ListAll[pin](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaywallLocationsListPins(ctx, projectID, location.ID, &api.PaywallLocationsListPinsParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		rules, err := listRules(ctx, app, projectID, location.ID)
		if err != nil {
			return err
		}
		if mode == cli.JSON {
			return app.PrintJSON(paywalls.ExtendObject(found.Raw,
				paywalls.Member{Key: "pins", Value: pins.RawJSON()},
				paywalls.Member{Key: "rules", Value: rules.RawJSON()},
				paywalls.Member{Key: "history", Value: history.RawJSON()},
			))
		}
		describe, all, err := paywalls.ShowingDescriber(ctx, app, projectID, append(history.Items, paywalls.ShowingsOf(location)...))
		if err != nil {
			return err
		}
		shows := fmt.Sprintf("nothing; show a paywall with 'voidhash location show %s <paywall>'", location.Slug)
		switch {
		case location.IsArchived:
			shows = "nothing: it is archived"
		case location.Showing != nil:
			shows = describe(*location.Showing) + ", since " + app.FormatTimeAgo(location.Showing.StartedAt)
		}
		fields := []cli.Field{{Label: "Shows", Value: shows}}
		if !location.IsArchived {
			inTest := "follows production: apps using a test key get the same"
			if location.TestShowing != nil {
				inTest = fmt.Sprintf("%s, since %s; 'voidhash location clear %s --env test' follows production again",
					describe(*location.TestShowing), app.FormatTimeAgo(location.TestShowing.StartedAt), location.Slug)
			}
			fields = append(fields, cli.Field{Label: "In test", Value: inTest})
		}
		if len(pins.Items) > 0 {
			lines := make([]string, len(pins.Items))
			for index, pinned := range pins.Items {
				lines[index] = describePin(pinned, all)
			}
			fields = append(fields, cli.Field{Label: "Pinned", Value: strings.Join(lines, "\n")})
		}
		if len(rules.Items) > 0 {
			lines := make([]string, len(rules.Items))
			for index, one := range rules.Items {
				lines[index] = describeRule(one, all)
			}
			fields = append(fields, cli.Field{Label: "Rules", Value: strings.Join(lines, "\n")})
		}
		if location.Description != nil {
			fields = append(fields, cli.Field{Label: "Description", Value: *location.Description})
		}
		var past []string
		for _, showing := range history.Items {
			if showing.EndedAt == nil {
				continue
			}
			inTest := ""
			if showing.Environment == "test" {
				inTest = " in test"
			}
			past = append(past, describe(showing)+inTest+", until "+app.FormatDate(*showing.EndedAt))
		}
		before := "nothing"
		if len(past) > 0 {
			before = strings.Join(past, "\n")
		}
		fields = append(fields, cli.Field{Label: "Before", Value: before}, cli.Field{Label: "ID", Value: location.ID})
		settings, err := app.Config()
		if err != nil {
			return err
		}
		if address, ok := cli.DashboardURL(settings.WebURL, target, "settings/paywall-locations/"+location.ID); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		app.Println(cli.Printable(label(location)) + "\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}

const createUsage = "voidhash location create --name <name> [--slug <slug>] [--show <paywall>]"

// newCreate creates `voidhash location create [--name] [--slug] [--description] [--show <paywall>]`.
func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a place in your apps that shows a paywall.",
		Long:  "Create a place in your apps that shows a paywall, which the app asks for by its slug. --show shows a paywall there right away; a paywall without a live build creates nothing.",
		Example: `voidhash location create --name "Onboarding end"
voidhash location create --name Settings --slug settings --show pro`,
	}
	name := cmd.Flags().String("name", "", "What people see, such as Onboarding end")
	slug := cmd.Flags().String("slug", "", "What your app asks for (default: made from the name); it cannot change later")
	description := cmd.Flags().String("description", "", "Where in the app it is")
	show := cmd.Flags().String("show", "", "A `paywall` with a live build to show there right away")
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
		projectID := target.Project.Id
		locationName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name, as people see it", Usage: createUsage})
		if err != nil {
			return err
		}
		locationSlug := *slug
		if locationSlug == "" {
			locationSlug = paywalls.SlugFrom(locationName)
			if app.IsInteractive() {
				if locationSlug, err = app.RequireText(ctx, "", cli.TextPrompt{
					What: "--slug", Message: "Slug, as your app asks for it (it cannot change later)", Usage: createUsage, Initial: locationSlug,
				}); err != nil {
					return err
				}
			}
		}
		// Find the paywall first, so one that cannot be shown creates nothing.
		var shown showable
		if *show != "" {
			if shown, err = requireShowable(ctx, app, projectID, *show, createUsage); err != nil {
				return err
			}
		}
		body := map[string]any{"name": locationName, "slug": locationSlug}
		if *description != "" {
			body["description"] = *description
		}
		created, err := cli.Fetch[paywalls.Location](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsCreateWithBody(ctx, projectID, paywalls.JSONContentType, paywalls.JSONBody(body))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_location_slug_taken": fmt.Sprintf("Choose another --slug; 'voidhash location view %s' shows the location that has it.", locationSlug),
			})
		}
		made := created.Value
		if *show == "" {
			return app.PrintItem(mode, created, strings.Join([]string{
				fmt.Sprintf("Created %s. It shows nothing yet.", label(made)),
				fmt.Sprintf("Show a paywall there: 'voidhash location show %s <paywall>'", made.Slug),
				fmt.Sprintf("Your app asks for it as %q.", made.Slug),
			}, "\n"))
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsSetShowing(ctx, projectID, made.ID, nil, api.SetPaywallLocationShowingBodyJsonEncoding{PaywallId: shown.paywall.Id})
		}); err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_not_deployed": fmt.Sprintf("%s was created and shows nothing. Deploy the paywall ('voidhash paywall deploy %s'), then run 'voidhash location show %s %s'.",
					label(made), shown.paywall.Slug, made.Slug, shown.paywall.Slug),
			})
		}
		if created, err = getLocation(ctx, app, projectID, made.ID); err != nil {
			return err
		}
		return app.PrintItem(mode, created, fmt.Sprintf("Created %s, showing %s, %s. Your app asks for it as %q.",
			label(created.Value), paywallLabel(shown.paywall), paywalls.BuildLabel(shown.build.Number), created.Value.Slug))
	}
	return cmd
}

// newEdit creates `voidhash location edit <location> [--name] [--description | --clear-description]`.
func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Rename a location or change its description.",
		Long:  "Rename a location or change its description. Its slug cannot change, because apps ask for it.",
		Example: `voidhash location edit home --name "Home screen"
voidhash location edit home --clear-description`,
	}
	cli.SetArgs(cmd, locationArg)
	name := cmd.Flags().String("name", "", "Its new name")
	description := cmd.Flags().String("description", "", "Its new description")
	clearDescription := cmd.Flags().Bool("clear-description", false, "Remove its description")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		body := map[string]any{}
		if cli.Changed(cmd, "name") {
			body["name"] = *name
		}
		if cli.Changed(cmd, "description") {
			if *clearDescription {
				return cli.Usagef("Pass --description or --clear-description, not both.")
			}
			body["description"] = *description
		}
		if *clearDescription {
			body["description"] = nil
		}
		if len(body) == 0 {
			return cli.Usagef("Nothing to change.").WithHint("Pass --name, --description or --clear-description. A location's slug cannot change.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		found, err := paywalls.RequireLocation(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash location edit <location> --name <name>")
		if err != nil {
			return err
		}
		updated, err := cli.Fetch[paywalls.Location](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsUpdateWithBody(ctx, target.Project.Id, found.Value.ID, paywalls.JSONContentType, paywalls.JSONBody(body))
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("Updated %s.", label(updated.Value)))
	}
	return cmd
}

// newHistory creates `voidhash location history <location>`.
func newHistory(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "history",
		Short: "List what a location has shown, most recent first.",
		Long:  "List what a location has shown, in production and to test keys, most recent first.",
		Example: `voidhash location history home
voidhash location history home --json`,
	}
	cli.SetArgs(cmd, locationArg)
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
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash location history <location>")
		if err != nil {
			return err
		}
		showings, err := cli.ListAll[paywalls.Showing](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaywallLocationsListShowings(ctx, projectID, found.Value.ID, &api.PaywallLocationsListShowingsParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(showings)
		case cli.Quiet:
			app.PrintIDs(showings)
			return nil
		}
		empty := label(found.Value) + " has never shown anything."
		if len(showings.Items) == 0 {
			app.Println(cli.Printable(empty))
			return nil
		}
		describe, _, err := paywalls.ShowingDescriber(ctx, app, projectID, showings.Items)
		if err != nil {
			return err
		}
		columns := []cli.Column[paywalls.Showing]{{Header: "SHOWED", Cell: describe}}
		// Only when the location ever showed test keys something of its own.
		for _, showing := range showings.Items {
			if showing.Environment == "test" {
				columns = append(columns, cli.Column[paywalls.Showing]{Header: "IN", Cell: func(showing paywalls.Showing) string { return showing.Environment }})
				break
			}
		}
		columns = append(columns,
			cli.Column[paywalls.Showing]{Header: "FROM", Cell: func(showing paywalls.Showing) string { return app.FormatDate(showing.StartedAt) }},
			cli.Column[paywalls.Showing]{Header: "UNTIL", Cell: func(showing paywalls.Showing) string {
				if showing.EndedAt == nil {
					return "now"
				}
				return app.FormatDate(*showing.EndedAt)
			}},
		)
		cli.PrintTable(app, columns, showings.Items, empty)
		return nil
	}
	return cmd
}

// newArchive creates `voidhash location archive <location> [--yes]`.
func newArchive(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "archive",
		Short: "Archive a location your apps no longer ask for.",
		Long:  "Archive a location your apps no longer ask for; it shows nothing from then on. This cannot be undone. Asks first; --yes skips that.",
		Example: `voidhash location archive onboarding-end
voidhash location archive onboarding-end --yes`,
	}
	cli.SetArgs(cmd, locationArg)
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
		found, err := paywalls.RequireLocation(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash location archive <location> --yes")
		if err != nil {
			return err
		}
		location := found.Value
		if location.IsArchived {
			return app.PrintItem(mode, found, label(location)+" is already archived; nothing changed.")
		}
		stops := ""
		if location.Showing != nil {
			describe, _, err := paywalls.ShowingDescriber(ctx, app, projectID, paywalls.ShowingsOf(location))
			if err != nil {
				return err
			}
			stops = fmt.Sprintf("It stops showing %s, and apps that ask for %q get no paywall. ", describe(*location.Showing), location.Slug)
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Archive %s in %s? %sThis cannot be undone.", label(location), target.Label(), stops)); err != nil {
			return err
		}
		archived, err := cli.Fetch[paywalls.Location](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallLocationsArchive(ctx, projectID, location.ID)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{"paywall_location_test_running": testRunningHint})
		}
		return app.PrintItem(mode, archived, "Archived "+label(archived.Value)+".")
	}
	return cmd
}
