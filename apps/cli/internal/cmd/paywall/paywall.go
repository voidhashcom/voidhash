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
		Long: `Paywalls and onboarding flows: list and view them, create and duplicate them, build and deploy their designs, archive and delete them.

A paywall is designed in the dashboard. A build is a snapshot of that design; deploying a build makes it what end users see at every location that shows the paywall ('voidhash location'). Withdrawing a bad build stops it being served anywhere until it is restored.`,
	}
	cmd.AddCommand(newList(app), newView(app), newCreate(app), newDuplicate(app), newEdit(app), newBuild(app), newDeploy(app),
		newWithdraw(app, true), newWithdraw(app, false), newArchive(app, true), newArchive(app, false), newDelete(app), newTemplate(app))
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

// liveLabel is "build #3, live 2 days ago", or "never deployed", followed by
// "; build #4 in test" while test has a build of its own.
func liveLabel(app *cli.App, builds []paywalls.Build) string {
	inTest := ""
	if test, ok := paywalls.TestBuild(builds); ok && !test.IsDeployed {
		inTest = "; " + paywalls.BuildLabel(test.Number) + " in test"
	}
	deployed, ok := paywalls.DeployedBuild(builds)
	if !ok {
		if inTest != "" {
			return "never deployed to production" + inTest
		}
		return "never deployed"
	}
	withdrawn := ""
	if deployed.IsWithdrawn {
		withdrawn = ", withdrawn: apps get an earlier build"
	}
	if deployed.DeployedAt == nil {
		return paywalls.BuildLabel(deployed.Number) + withdrawn + inTest
	}
	return paywalls.BuildLabel(deployed.Number) + ", live " + app.FormatTimeAgo(*deployed.DeployedAt) + withdrawn + inTest
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
		Short: "Create a paywall or onboarding flow, empty or from a template.",
		Long:  "Create a paywall or onboarding flow, empty or starting as a template's design ('voidhash paywall template list'). It is designed in the dashboard, and nobody sees it until it is deployed and a location shows it.",
		Example: `voidhash paywall create --name "Summer sale"
voidhash paywall create --name "Summer sale" --template plan-picker
voidhash paywall create --name Welcome --slug welcome --kind onboarding`,
	}
	name := cmd.Flags().String("name", "", "What people see, such as Summer sale")
	slug := cmd.Flags().String("slug", "", "How analytics name it (default: made from the name); it cannot change later")
	kind := cli.AddChoiceFlag(cmd, "kind", "", []string{"paywall", "onboarding"}, "paywall", "A paywall (the default, or the template's purpose), or onboarding, a flow of screens")
	template := cmd.Flags().String("template", "", "A `template` whose design it starts as, such as plan-picker; 'voidhash paywall template list' lists them")
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
		body := api.CreatePaywallBodyJsonEncoding{Name: paywallName, Slug: paywallSlug}
		// With a template, the purpose is the template's unless --kind names one.
		if *template == "" || cmd.Flags().Changed("kind") {
			paywallKind := api.PaywallKind(*kind)
			body.Kind = &paywallKind
		}
		if *template != "" {
			body.Template = template
		}
		created, err := cli.Fetch[paywalls.Paywall](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsCreate(ctx, target.Project.Id, body)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_slug_taken":         fmt.Sprintf("Choose another --slug; 'voidhash paywall view %s' shows the paywall that has it.", paywallSlug),
				"paywall_template_not_found": "'voidhash paywall template list' lists the templates and their purposes.",
			})
		}
		made := created.Value
		start := "It is empty, and nobody sees it yet."
		if *template != "" {
			start = fmt.Sprintf("It starts as the %s template's design, and nobody sees it yet.", *template)
		}
		design := fmt.Sprintf("  Design it in the dashboard: 'voidhash open paywall %s'", made.Slug)
		if *template != "" {
			design = fmt.Sprintf("  Make it yours in the dashboard, where its issues say what it still needs: 'voidhash open paywall %s'", made.Slug)
		}
		lines := []string{
			fmt.Sprintf("Created %s %s. %s", strings.ToLower(paywalls.KindLabel(made)), label(made), start),
			"Next:",
			design,
		}
		if products := templateProducts(ctx, app, target.Project.Id, *template); len(products) > 0 {
			lines = append(lines, fmt.Sprintf("  Give it products: create %s with 'voidhash product create', or choose others in the dashboard", strings.Join(products, " and ")))
		}
		lines = append(lines,
			fmt.Sprintf("  Make the design live: 'voidhash paywall deploy %s'", made.Slug),
			fmt.Sprintf("  Show it in your app: 'voidhash location show <location> %s'", made.Slug),
		)
		return app.PrintItem(mode, created, strings.Join(lines, "\n"))
	}
	return cmd
}

// newDuplicate creates `voidhash paywall duplicate <paywall> [--name <name>] [--slug <slug>]`.
func newDuplicate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "duplicate",
		Short: "Copy a paywall's design into a new paywall.",
		Long:  "Copy a paywall's current design into a new paywall of the same project, to try a variation without touching the original. The copy is made for the same locations and uses the same images, fonts, components and products. It has no builds and no location shows it, so nobody sees it until it is deployed and shown. It is named after the paywall with \"copy\" and a free slug unless --name and --slug say otherwise.",
		Example: `voidhash paywall duplicate summer-sale
voidhash paywall duplicate summer-sale --name "Summer sale B" --slug summer-sale-b`,
	}
	cli.SetArgs(cmd, paywallArg)
	name := cmd.Flags().String("name", "", "The copy's name (default: the paywall's name followed by \"copy\")")
	slug := cmd.Flags().String("slug", "", "The copy's slug, which cannot change later (default: the paywall's slug followed by -copy)")
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
		found, err := paywalls.RequirePaywall(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash paywall duplicate <paywall>")
		if err != nil {
			return err
		}
		body := api.DuplicatePaywallBodyJsonEncoding{}
		if *name != "" {
			body.Name = name
		}
		if *slug != "" {
			body.Slug = slug
		}
		copied, err := cli.Fetch[paywalls.Paywall](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsDuplicate(ctx, target.Project.Id, found.Value.Id, body)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_slug_taken": "Choose another --slug, or leave it out to get a free one.",
			})
		}
		made := copied.Value
		return app.PrintItem(mode, copied, strings.Join([]string{
			fmt.Sprintf("Duplicated %s as %s. The copy is made for the same locations, and nobody sees it yet.", label(found.Value), label(made)),
			"Next:",
			fmt.Sprintf("  Change it in the dashboard: 'voidhash open paywall %s'", made.Slug),
			fmt.Sprintf("  Make the design live: 'voidhash paywall deploy %s'", made.Slug),
			fmt.Sprintf("  Show it in your app: 'voidhash location show <location> %s'", made.Slug),
		}, "\n"))
	}
	return cmd
}

// templateProducts is the slugs of the products template `id` sells, or none when there is no
// template or it cannot be read: the next steps then leave products out.
func templateProducts(ctx context.Context, app *cli.App, projectID, id string) []string {
	if id == "" {
		return nil
	}
	templates, err := cli.ListAll[api.PaywallTemplateJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaywallTemplatesList(ctx, projectID, &api.PaywallTemplatesListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return nil
	}
	for _, template := range templates.Items {
		if template.Id == id {
			return template.ProductSlugs
		}
	}
	return nil
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
		Long:  "Build the paywall's current design without deploying it. --wait waits for the result, shows why a build failed, and warns of a language whose texts have no translation, which a build never fails on. Starting a build needs you signed in as yourself; a project key cannot.",
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
		for _, warning := range paywalls.MissingTranslationWarnings(build.Value) {
			app.Warnf("%s", warning)
		}
		return app.PrintItem(mode, build, fmt.Sprintf("Build #%d of %s is ready. Make it live: 'voidhash paywall deploy %s --build %d'.",
			number, label(paywall), paywall.Slug, number))
	}
	return cmd
}

// newDeploy creates `voidhash paywall deploy <paywall> [--build <number|id>] [--env production|test] [--timeout <seconds>] [--yes]`.
func newDeploy(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "deploy",
		Short: "Make a paywall's design live at every location that shows it.",
		Long: `Make a paywall's design live: build it, wait for the build, and deploy it to every location that shows the paywall. --build deploys an existing build instead, such as an older one to roll back.

--env test deploys to test only: apps using a test key get the build, and end users keep what they see. Try it on a device, then deploy the same build with --env production. --env production leaves a build test has of its own in place. Without --env the build goes to both, and test follows production again: from then on a deploy to production reaches apps using a test key too, until a build is deployed to test alone.

Asks first when a location shows the paywall and the deploy reaches production, because end users see the change on their next visit; --yes skips that. Without a terminal and without --yes, nothing is built.

Warns, and deploys anyway, when a language of the design has texts without a translation: end users reading it see the design's own language there.

An arm of a running or paused experiment keeps the build it started with; the result names each one. 'voidhash experiment deploy-arm' moves an arm to another build.`,
		Example: `voidhash paywall deploy pro --env test
voidhash paywall deploy pro --build 3 --env production --yes
voidhash paywall deploy pro --build 2 --yes`,
	}
	cli.SetArgs(cmd, paywallArg)
	buildFlag := cmd.Flags().String("build", "", "Deploy this existing build, by `number` or id, such as an older one to roll back (default: build the current design)")
	env := cli.AddChoiceFlag(cmd, "env", "", []string{"production", "test"}, "", "Deploy to this environment only: production (end users) or test (apps using a test key) (default: both)")
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
		// A deploy to test reaches no end user, so it needs no confirmation.
		asks := len(locations) > 0 && *env != "test"
		// Without a terminal to confirm in, say so before building anything.
		if asks && !*yes && !app.IsInteractive() {
			return cli.Usagef("Deploying %s changes what end users see at %s.", label(paywall), shownAt).
				WithHint("There is no terminal to ask in; pass --yes to deploy without asking.")
		}
		before, wasLive := paywalls.DeployedBuild(builds.Items)
		isLiveThere := func(build paywalls.Build) bool { return build.IsDeployed && build.IsDeployedInTest }
		where := ""
		switch *env {
		case "test":
			before, wasLive = paywalls.TestBuild(builds.Items)
			isLiveThere = func(build paywalls.Build) bool { return build.IsDeployedInTest }
			where = " to test"
		case "production":
			isLiveThere = func(build paywalls.Build) bool { return build.IsDeployed }
			where = " to production"
		}
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
		if isLiveThere(ready) {
			return app.PrintItem(mode, chosen, fmt.Sprintf("Build #%d of %s is already live%s; nothing changed.", ready.Number, label(paywall), strings.Replace(where, " to ", " in ", 1)))
		}

		replacing := "its first live build"
		if wasLive {
			replacing = "replacing " + paywalls.BuildLabel(before.Number)
			if before.Number > ready.Number {
				replacing = "rolling back from " + paywalls.BuildLabel(before.Number)
			}
		}
		for _, warning := range paywalls.MissingTranslationWarnings(ready) {
			app.Warnf("%s", warning)
		}
		if wasLive {
			if note := paywalls.TextSizeNote(ready, before, paywall.Slug); note != "" {
				app.Notef("%s", note)
			}
		}
		if asks {
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Deploy %s of %s%s in %s, %s? End users at %s see it on their next visit.",
				paywalls.BuildLabel(ready.Number), label(paywall), where, target.Label(), replacing, shownAt)); err != nil {
				return err
			}
		}
		// A deploy to one environment is an operation of its own, so a server
		// that cannot make one refuses it instead of deploying to both. A deploy
		// to production that leaves test following production (test follows it
		// now, or has this very build) is the deploy to both, which every server
		// runs, also an older one.
		testBuild, testHasOwn := paywalls.TestBuild(builds.Items)
		testHasOwn = testHasOwn && !testBuild.IsDeployed && testBuild.ID != ready.ID
		toBoth := *env == "" || (*env == "production" && !testHasOwn)
		deployed, err := cli.Fetch[paywalls.Build](ctx, app, func(c *api.Client) (*http.Response, error) {
			if toBoth {
				return c.PaywallsDeployBuild(ctx, projectID, paywall.Id, ready.ID)
			}
			return c.PaywallsSetEnvironment(ctx, projectID, paywall.Id, api.PaywallLocationEnvironment(*env),
				api.PaywallsSetEnvironmentJSONRequestBody{BuildId: ready.ID})
		})
		if err != nil && !toBoth && environmentDeployUnavailable(err) {
			message := "The server runs an older version that can't deploy to test alone, so nothing was deployed."
			if *env == "production" {
				message = "The server runs an older version that can't deploy to production while test has a build of its own, so nothing was deployed."
			}
			return &cli.UserError{Message: message, Hint: "Deploy again once the server runs a version that deploys to one environment."}
		}
		if err != nil {
			return cli.APIError(err, map[string]string{
				"paywall_build_components_unavailable": fmt.Sprintf("Update those components in the paywall ('voidhash open paywall %s'), then deploy again.", paywall.Slug),
				"paywall_build_withdrawn":              fmt.Sprintf("Deploy another build, or restore this one first: 'voidhash paywall restore %s --build %d'.", paywall.Slug, ready.Number),
			})
		}
		reach := fmt.Sprintf("No location shows it yet: 'voidhash location show <location> %s'.", paywall.Slug)
		switch {
		case *env == "test":
			reach = fmt.Sprintf("Only apps using a test key get it; end users keep what they see. Once it looks right: 'voidhash paywall deploy %s --build %d --env production'.",
				paywall.Slug, deployed.Value.Number)
		case len(locations) > 0:
			reach = "Live at " + shownAt + "."
		}
		if *env == "production" && !deployed.Value.IsDeployedInTest {
			reach += " Apps using a test key keep the build deployed to test."
		}
		for _, note := range paywalls.TestArmsNotes(deployed.Value, *env) {
			reach += "\n" + note
		}
		return app.PrintItem(mode, deployed, fmt.Sprintf("Deployed %s of %s%s, %s.\n%s",
			paywalls.BuildLabel(deployed.Value.Number), label(paywall), where, replacing, reach))
	}
	return cmd
}

// environmentDeployUnavailable says whether a deploy to one environment was
// refused because the server has no such operation: a 404 or 405 that names
// none of the paywall's own not-found codes.
func environmentDeployUnavailable(err error) bool {
	status := cli.APIErrorStatus(err)
	if status != http.StatusNotFound && status != http.StatusMethodNotAllowed {
		return false
	}
	switch cli.APIErrorCode(err) {
	case "paywall_not_found", "paywall_build_not_found", "project_not_found":
		return false
	}
	return true
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
		Short: "Delete a paywall nothing uses, and its builds.",
		Long:  "Delete a paywall and its builds; its design can no longer be opened. A paywall a location shows, a location's rule or pin names, or an A/B test places cannot be deleted, and the command lists where it is in use. This cannot be undone. Asks first; --yes skips that.",
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
		inUseHint := fmt.Sprintf("Change what those locations show ('voidhash location show', 'voidhash location clear', 'voidhash location rule', 'voidhash location unpin') or conclude the A/B tests first, or archive it instead: 'voidhash paywall archive %s'.", paywall.Slug)
		// Said before asking, so nobody agrees to a deletion that cannot happen.
		uses, err := cli.ListAll[api.PaywallUseJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PaywallsListUses(ctx, projectID, paywall.Id, &api.PaywallsListUsesParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		if len(uses.Items) > 0 {
			places := make([]string, len(uses.Items))
			for i, use := range uses.Items {
				places[i] = "  " + use.Description
			}
			return cli.Failf("%s cannot be deleted while it is in use:\n%s", label(paywall), strings.Join(places, "\n")).WithHint(inUseHint)
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete %s and its builds from %s? Its design can no longer be opened. This cannot be undone.", label(paywall), target.Label())); err != nil {
			return err
		}
		// The server checks again, for a use added meanwhile, and its message names each place.
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsDelete(ctx, projectID, paywall.Id)
		}); err != nil {
			return cli.APIError(err, map[string]string{"paywall_in_use": inUseHint})
		}
		return app.PrintItem(mode, found, "Deleted "+label(paywall)+".")
	}
	return cmd
}
