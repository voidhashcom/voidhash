// Package paywall holds `voidhash paywall`: paywalls and onboarding flows,
// their builds and what is live.
package paywall

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

// New creates `voidhash paywall`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "paywall",
		Aliases: []string{"paywalls"},
		Short:   "Paywalls and onboarding flows: create, build, deploy, archive and delete them.",
		Long: `Paywalls and onboarding flows: list and view them, create them, build and deploy their designs, archive and delete them.

A paywall is designed in the dashboard. A build is a snapshot of that design; deploying a build makes it what end users see at every location that shows the paywall ('voidhash location').`,
	}
	cmd.AddCommand(newList(app), newView(app), newCreate(app), newEdit(app), newBuild(app), newDeploy(app),
		newArchive(app, true), newArchive(app, false), newDelete(app))
	return cmd
}

var paywallArg = cli.Arg{Name: "paywall", Help: "The paywall's slug, name or id", Optional: true}

func label(paywall paywalls.Paywall) string { return paywalls.PaywallKind.Label(paywall) }

func addTimeoutFlag(cmd *cobra.Command) *int {
	return cmd.Flags().Int("timeout", 300, "How many `seconds` to wait for the build (default: 300)")
}

func checkTimeout(seconds int) error {
	if seconds < 1 {
		return cli.Usagef("--timeout takes a number of seconds, 1 or more.")
	}
	return nil
}

// liveLabel is "build #3, live 2 days ago", or "never deployed".
func liveLabel(app *cli.App, builds []paywalls.Build) string {
	deployed, ok := paywalls.DeployedBuild(builds)
	if !ok {
		return "never deployed"
	}
	if deployed.DeployedAt == nil {
		return paywalls.BuildLabel(deployed.Number)
	}
	return paywalls.BuildLabel(deployed.Number) + ", live " + app.FormatTimeAgo(*deployed.DeployedAt)
}

// newerLabel is the newest build when it is newer than the deployed one:
// "build #4 failed". It is empty otherwise.
func newerLabel(builds []paywalls.Build) string {
	if len(builds) == 0 {
		return ""
	}
	newest := builds[0]
	if deployed, ok := paywalls.DeployedBuild(builds); ok && newest.Number <= deployed.Number {
		return ""
	}
	status := newest.Status
	if status == "ready" {
		status = "ready, not deployed"
	}
	return paywalls.BuildLabel(newest.Number) + " " + status
}

// newList creates `voidhash paywall list [--archived]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's paywalls with what is live and where each is shown.",
		Long:  "List the project's paywalls with the build end users see, a newer build that is not live, and the locations that show each paywall.",
		Example: `voidhash paywall list
voidhash paywall list --archived -q`,
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
		projectID := target.Project.Id
		all, err := paywalls.ListPaywalls(ctx, app, projectID)
		if err != nil {
			return err
		}
		listed := all.Filter(func(paywall paywalls.Paywall) bool { return paywall.IsArchived == *archived })
		switch mode {
		case cli.JSON:
			return app.PrintJSON(listed)
		case cli.Quiet:
			app.PrintIDs(listed)
			return nil
		}

		// Only people see what is live and where, so only they wait for it.
		type row struct {
			paywall paywalls.Paywall
			builds  []paywalls.Build
		}
		rows, err := cli.Each(ctx, listed.Items, 8, func(ctx context.Context, paywall paywalls.Paywall) (row, error) {
			builds, err := paywalls.ListBuilds(ctx, app, projectID, paywall.Id)
			return row{paywall: paywall, builds: builds.Items}, err
		})
		if err != nil {
			return err
		}
		var locations cli.List[paywalls.Location]
		if len(rows) > 0 {
			if locations, err = paywalls.ListLocations(ctx, app, projectID); err != nil {
				return err
			}
		}
		empty := "No paywalls yet. Create one with 'voidhash paywall create'."
		if *archived {
			empty = "No archived paywalls."
		}
		cli.PrintTable(app, []cli.Column[row]{
			{Header: "NAME", Cell: func(r row) string { return r.paywall.Name }},
			{Header: "SLUG", Cell: func(r row) string { return r.paywall.Slug }},
			{Header: "KIND", Cell: func(r row) string { return paywalls.KindLabel(r.paywall) }},
			{Header: "LIVE", Cell: func(r row) string { return liveLabel(app, r.builds) }},
			{Header: "NEWER", Cell: func(r row) string {
				if newer := newerLabel(r.builds); newer != "" {
					return newer
				}
				return "-"
			}},
			{Header: "SHOWN AT", Cell: func(r row) string {
				return paywalls.LocationNames(paywalls.LocationsShowing(locations.Items, r.paywall), "-")
			}},
			{Header: "ID", Cell: func(r row) string { return r.paywall.Id }},
		}, rows, empty)
		return nil
	}
	return cmd
}

// newView creates `voidhash paywall view <paywall>`.
func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a paywall: the build end users see, newer builds, and where it is shown.",
		Long:  "Show a paywall: the build end users see, newer builds, and where it is shown. With --json the paywall is printed with its recent builds and the locations showing it added as builds and shownAt.",
		Example: `voidhash paywall view pro
voidhash paywall view "Summer sale" --json`,
	}
	cli.SetArgs(cmd, paywallArg)
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
		found, err := paywalls.RequirePaywall(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash paywall view <paywall>")
		if err != nil {
			return err
		}
		if mode == cli.Quiet {
			app.PrintIDs(found)
			return nil
		}
		paywall := found.Value
		builds, err := paywalls.ListBuilds(ctx, app, projectID, paywall.Id)
		if err != nil {
			return err
		}
		locations, err := paywalls.ListLocations(ctx, app, projectID)
		if err != nil {
			return err
		}
		shownAt := locations.Filter(func(location paywalls.Location) bool { return paywalls.Shows(location, paywall) })
		if mode == cli.JSON {
			return app.PrintJSON(paywalls.ExtendObject(found.Raw,
				paywalls.Member{Key: "builds", Value: builds.RawJSON()},
				paywalls.Member{Key: "shownAt", Value: shownAt.RawJSON()},
			))
		}
		kind := paywalls.KindLabel(paywall)
		if paywall.IsArchived {
			kind += ", archived"
		}
		fields := []cli.Field{
			{Label: "Kind", Value: kind},
			{Label: "Live", Value: liveLabel(app, builds.Items)},
		}
		if newer := newerLabel(builds.Items); newer != "" {
			fields = append(fields, cli.Field{Label: "Newer", Value: newer})
		}
		recent := fmt.Sprintf("none; build and deploy it with 'voidhash paywall deploy %s'", paywall.Slug)
		if len(builds.Items) > 0 {
			var lines []string
			for _, build := range builds.Items[:min(5, len(builds.Items))] {
				lines = append(lines, fmt.Sprintf("#%d  %s  %s", build.Number, paywalls.BuildStatus(build), app.FormatTimeAgo(build.CreatedAt)))
			}
			recent = strings.Join(lines, "\n")
		}
		fields = append(fields,
			cli.Field{Label: "Shown at", Value: paywalls.LocationNames(shownAt.Items,
				fmt.Sprintf("no location; show it with 'voidhash location show <location> %s'", paywall.Slug))},
			cli.Field{Label: "Builds", Value: recent},
			cli.Field{Label: "ID", Value: paywall.Id},
		)
		settings, err := app.Config()
		if err != nil {
			return err
		}
		if address, ok := cli.DashboardURL(settings.WebURL, target, "paywalls/"+paywall.Id); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		app.Println(cli.Printable(label(paywall)) + "\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}

const createUsage = "voidhash paywall create --name <name> [--slug <slug>] [--kind onboarding]"

// newCreate creates `voidhash paywall create [--name] [--slug] [--kind]`.
func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create an empty paywall or onboarding flow.",
		Long:  "Create an empty paywall or onboarding flow. It is designed in the dashboard, and nobody sees it until it is deployed and a location shows it.",
		Example: `voidhash paywall create --name "Summer sale"
voidhash paywall create --name Welcome --slug welcome --kind onboarding`,
	}
	name := cmd.Flags().String("name", "", "What people see, such as Summer sale")
	slug := cmd.Flags().String("slug", "", "How analytics name it (default: made from the name); it cannot change later")
	kind := cli.AddChoiceFlag(cmd, "kind", "", []string{"paywall", "onboarding"}, "paywall", "A paywall (the default), or onboarding, a flow of screens")
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
		paywallName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name, as people see it", Usage: createUsage})
		if err != nil {
			return err
		}
		paywallSlug := *slug
		if paywallSlug == "" {
			paywallSlug = paywalls.SlugFrom(paywallName)
			if app.IsInteractive() {
				if paywallSlug, err = app.RequireText(ctx, "", cli.TextPrompt{
					What: "--slug", Message: "Slug, as analytics name it (it cannot change later)", Usage: createUsage, Initial: paywallSlug,
				}); err != nil {
					return err
				}
			}
		}
		paywallKind := api.PaywallKind(*kind)
		created, err := cli.Fetch[paywalls.Paywall](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsCreate(ctx, target.Project.Id, api.CreatePaywallBodyJsonEncoding{Name: paywallName, Slug: paywallSlug, Kind: &paywallKind})
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_slug_taken": fmt.Sprintf("Choose another --slug; 'voidhash paywall view %s' shows the paywall that has it.", paywallSlug),
			})
		}
		made := created.Value
		return app.PrintItem(mode, created, strings.Join([]string{
			fmt.Sprintf("Created %s %s. It is empty, and nobody sees it yet.", strings.ToLower(paywalls.KindLabel(made)), label(made)),
			"Next:",
			fmt.Sprintf("  Design it in the dashboard: 'voidhash open paywall %s'", made.Slug),
			fmt.Sprintf("  Make the design live: 'voidhash paywall deploy %s'", made.Slug),
			fmt.Sprintf("  Show it in your app: 'voidhash location show <location> %s'", made.Slug),
		}, "\n"))
	}
	return cmd
}

// newEdit creates `voidhash paywall edit <paywall> --name <name>`.
func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "edit",
		Short:   "Rename a paywall.",
		Long:    "Rename a paywall. Its slug cannot change; its design changes in the dashboard.",
		Example: `voidhash paywall edit summer-sale --name "Summer sale 2027"`,
	}
	cli.SetArgs(cmd, paywallArg)
	name := cmd.Flags().String("name", "", "Its new name")
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
		const usage = "voidhash paywall edit <paywall> --name <name>"
		found, err := paywalls.RequirePaywall(ctx, app, target.Project.Id, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		newName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name", Usage: usage, Initial: found.Value.Name})
		if err != nil {
			return err
		}
		if newName == found.Value.Name {
			return app.PrintItem(mode, found, "Nothing changed.")
		}
		updated, err := cli.Fetch[paywalls.Paywall](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsUpdate(ctx, target.Project.Id, found.Value.Id, api.UpdatePaywallBodyJsonEncoding{Name: &newName})
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("Renamed %s to %s.", found.Value.Name, label(updated.Value)))
	}
	return cmd
}

// startBuild starts a build of the paywall's current design.
func startBuild(ctx context.Context, app *cli.App, projectID string, paywall paywalls.Paywall) (cli.Object[paywalls.Build], error) {
	started, err := cli.Fetch[paywalls.Build](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaywallsCreateBuildWithBody(ctx, projectID, paywall.Id, paywalls.JSONContentType, strings.NewReader("{}"))
	})
	return started, cli.APIError(err, map[string]string{
		"permission_denied": "Building takes permission to edit paywalls: use a key that has it, or sign in as yourself with 'voidhash login'.",
	})
}

// buildAndWait starts a build and waits for it, saying so.
func buildAndWait(ctx context.Context, app *cli.App, projectID string, paywall paywalls.Paywall, timeout time.Duration) (cli.Object[paywalls.Build], error) {
	started, err := startBuild(ctx, app, projectID, paywall)
	if err != nil {
		return started, err
	}
	app.Notef("Building %s of %s…", paywalls.BuildLabel(started.Value.Number), cli.Printable(label(paywall)))
	return paywalls.WaitForBuild(ctx, app, projectID, started, timeout)
}

// requireReady fails with what to do about a build that did not get ready.
func requireReady(paywall paywalls.Paywall, build paywalls.Build) error {
	switch build.Status {
	case "failed":
		return cli.Failf("Build #%d of %s failed: %s", build.Number, label(paywall), paywalls.DescribeFailure(build)).
			WithHint(fmt.Sprintf("Fix the design in the dashboard ('voidhash open paywall %s'), then build again.", paywall.Slug))
	case "building":
		return cli.Failf("Build #%d of %s is still building.", build.Number, label(paywall)).
			WithHint(fmt.Sprintf("Deploy it once it is ready: 'voidhash paywall deploy %s --build %d'.", paywall.Slug, build.Number))
	}
	return nil
}

// newBuild creates `voidhash paywall build <paywall> [--wait] [--timeout <seconds>]`.
func newBuild(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "build",
		Short: "Build the paywall's current design without deploying it.",
		Long:  "Build the paywall's current design without deploying it. --wait waits for the result and shows why a build failed. Starting a build needs you signed in as yourself; a project key cannot.",
		Example: `voidhash paywall build pro --wait
voidhash paywall build pro -q`,
	}
	cli.SetArgs(cmd, paywallArg)
	wait := cmd.Flags().Bool("wait", false, "Wait until the build is ready or failed")
	timeout := addTimeoutFlag(cmd)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if err := checkTimeout(*timeout); err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		found, err := paywalls.RequirePaywall(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash paywall build <paywall>")
		if err != nil {
			return err
		}
		paywall := found.Value
		var build cli.Object[paywalls.Build]
		if *wait {
			if build, err = buildAndWait(ctx, app, target.Project.Id, paywall, time.Duration(*timeout)*time.Second); err != nil {
				return err
			}
			if err := requireReady(paywall, build.Value); err != nil {
				return err
			}
		} else if build, err = startBuild(ctx, app, target.Project.Id, paywall); err != nil {
			return err
		}
		number := build.Value.Number
		if build.Value.Status == "building" {
			return app.PrintItem(mode, build, fmt.Sprintf("Started %s of %s. Deploy it once it is ready: 'voidhash paywall deploy %s --build %d'.",
				paywalls.BuildLabel(number), label(paywall), paywall.Slug, number))
		}
		return app.PrintItem(mode, build, fmt.Sprintf("Build #%d of %s is ready. Make it live: 'voidhash paywall deploy %s --build %d'.",
			number, label(paywall), paywall.Slug, number))
	}
	return cmd
}

// newDeploy creates `voidhash paywall deploy <paywall> [--build <number|id>] [--timeout <seconds>] [--yes]`.
func newDeploy(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "deploy",
		Short: "Make a paywall's design live at every location that shows it.",
		Long: `Make a paywall's design live: build it, wait for the build, and deploy it to every location that shows the paywall. --build deploys an existing build instead, such as an older one to roll back.

Asks first when a location shows the paywall, because end users see the change on their next visit; --yes skips that. Without a terminal and without --yes, nothing is built.`,
		Example: `voidhash paywall deploy pro
voidhash paywall deploy pro --build 3 --yes`,
	}
	cli.SetArgs(cmd, paywallArg)
	buildFlag := cmd.Flags().String("build", "", "Deploy this existing build, by `number` or id, such as an older one to roll back (default: build the current design)")
	timeout := addTimeoutFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if err := checkTimeout(*timeout); err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		found, err := paywalls.RequirePaywall(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash paywall deploy <paywall> [--build <number>]")
		if err != nil {
			return err
		}
		paywall := found.Value
		builds, err := paywalls.ListBuilds(ctx, app, projectID, paywall.Id)
		if err != nil {
			return err
		}
		allLocations, err := paywalls.ListLocations(ctx, app, projectID)
		if err != nil {
			return err
		}
		locations := paywalls.LocationsShowing(allLocations.Items, paywall)
		shownAt := paywalls.LocationNames(locations, "")
		// Without a terminal to confirm in, say so before building anything.
		if len(locations) > 0 && !*yes && !app.IsInteractive() {
			return cli.Usagef("Deploying %s changes what end users see at %s.", label(paywall), shownAt).
				WithHint("There is no terminal to ask in; pass --yes to deploy without asking.")
		}
		before, wasLive := paywalls.DeployedBuild(builds.Items)
		wait := time.Duration(*timeout) * time.Second
		var chosen cli.Object[paywalls.Build]
		if *buildFlag == "" {
			chosen, err = buildAndWait(ctx, app, projectID, paywall, wait)
		} else if index := paywalls.FindBuild(builds.Items, *buildFlag); index >= 0 {
			chosen, err = paywalls.WaitForBuild(ctx, app, projectID, builds.Object(index), wait)
		} else {
			err = &cli.UserError{
				Message:  fmt.Sprintf("%s has no build %s.", label(paywall), *buildFlag),
				Hint:     fmt.Sprintf("'voidhash paywall view %s' lists its recent builds.", paywall.Slug),
				ExitCode: cli.ExitNotFound,
			}
		}
		if err != nil {
			return err
		}
		ready := chosen.Value
		if err := requireReady(paywall, ready); err != nil {
			return err
		}
		if ready.IsDeployed {
			return app.PrintItem(mode, chosen, fmt.Sprintf("Build #%d of %s is already live; nothing changed.", ready.Number, label(paywall)))
		}

		replacing := "its first live build"
		if wasLive {
			replacing = "replacing " + paywalls.BuildLabel(before.Number)
			if before.Number > ready.Number {
				replacing = "rolling back from " + paywalls.BuildLabel(before.Number)
			}
		}
		if len(locations) > 0 {
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Deploy %s of %s in %s, %s? End users at %s see it on their next visit.",
				paywalls.BuildLabel(ready.Number), label(paywall), target.Label(), replacing, shownAt)); err != nil {
				return err
			}
		}
		deployed, err := cli.Fetch[paywalls.Build](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsDeployBuild(ctx, projectID, paywall.Id, ready.ID)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_build_components_unavailable": fmt.Sprintf("Update those components in the paywall ('voidhash open paywall %s'), then deploy again.", paywall.Slug),
			})
		}
		where := fmt.Sprintf("No location shows it yet: 'voidhash location show <location> %s'.", paywall.Slug)
		if len(locations) > 0 {
			where = "Live at " + shownAt + "."
		}
		return app.PrintItem(mode, deployed, fmt.Sprintf("Deployed %s of %s, %s.\n%s",
			paywalls.BuildLabel(deployed.Value.Number), label(paywall), replacing, where))
	}
	return cmd
}

// newArchive creates `voidhash paywall archive|unarchive <paywall>`.
func newArchive(app *cli.App, archive bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "unarchive",
		Short:   "Restore an archived paywall.",
		Example: "voidhash paywall unarchive welcome",
	}
	if archive {
		cmd.Use = "archive"
		cmd.Short = "Archive a paywall to tidy the list."
		cmd.Long = "Archive a paywall to tidy the list. Locations that show it keep showing its live build. 'voidhash paywall unarchive' restores it."
		cmd.Example = "voidhash paywall archive welcome"
	}
	verb := cmd.Use
	cli.SetArgs(cmd, paywallArg)
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
		found, err := paywalls.RequirePaywall(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash paywall "+verb+" <paywall>")
		if err != nil {
			return err
		}
		if found.Value.IsArchived == archive {
			already := "not"
			if archive {
				already = "already"
			}
			return app.PrintItem(mode, found, fmt.Sprintf("%s is %s archived; nothing changed.", label(found.Value), already))
		}
		updated, err := cli.Fetch[paywalls.Paywall](ctx, app, func(c *api.Client) (*http.Response, error) {
			if archive {
				return c.PaywallsArchive(ctx, target.Project.Id, found.Value.Id)
			}
			return c.PaywallsUnarchive(ctx, target.Project.Id, found.Value.Id)
		})
		if err != nil {
			return err
		}
		if archive {
			return app.PrintItem(mode, updated, fmt.Sprintf("Archived %s. Locations that show it keep showing its live build.", label(updated.Value)))
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("Restored %s from the archive.", label(updated.Value)))
	}
	return cmd
}

// newDelete creates `voidhash paywall delete <paywall> [--yes]`.
func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete a paywall that no location shows, with its design and builds.",
		Long:  "Delete a paywall that no location shows, with its design and builds. This cannot be undone. Asks first; --yes skips that.",
		Example: `voidhash paywall delete summer-sale
voidhash paywall delete summer-sale --yes`,
	}
	cli.SetArgs(cmd, paywallArg)
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
		found, err := paywalls.RequirePaywall(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash paywall delete <paywall> --yes")
		if err != nil {
			return err
		}
		paywall := found.Value
		locations, err := paywalls.ListLocations(ctx, app, projectID)
		if err != nil {
			return err
		}
		if shownAt := paywalls.LocationsShowing(locations.Items, paywall); len(shownAt) > 0 {
			verb := "show"
			if len(shownAt) == 1 {
				verb = "shows"
			}
			return cli.Failf("%s cannot be deleted while %s %s it.", label(paywall), paywalls.LocationNames(shownAt, ""), verb).
				WithHint(fmt.Sprintf("Show another paywall there ('voidhash location show <location> <paywall>') or clear it ('voidhash location clear <location>') first, or archive it instead: 'voidhash paywall archive %s'.", paywall.Slug))
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete %s with its design and builds from %s? This cannot be undone.", label(paywall), target.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsDelete(ctx, projectID, paywall.Id)
		}); err != nil {
			return err
		}
		return app.PrintItem(mode, found, "Deleted "+label(paywall)+".")
	}
	return cmd
}
