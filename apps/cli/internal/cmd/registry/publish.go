package registry

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/crate"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// newPublish creates `voidhash registry publish [path]` and
// `voidhash registry publish --from-project <slug>@<version> --version <semver>`.
func newPublish(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "publish",
		Short: "Publish a component bundle, or a ready project component, to your organization's registry.",
		Long: `Publish a component to your organization's registry, where every project of the organization can install it.

A bundle directory holds:
  component.json           the definition to publish (required)
  module.wasm              the module; or, in a crate, what 'voidhash test' built into target/voidhash/
  panel.wasm               its editor panel module, which a module that declares a panel needs
  icon.(png|svg|webp)      optional
  thumbnails/<state>.png   optional, one per preview state (png, jpg or webp)
  README.md, agent.md      optional

With --from-project, a ready version of one of the project's own components is published instead. The server runs every publish check.`,
		Example: `voidhash registry publish
voidhash registry publish ./wheel-picker --project acme/app
voidhash registry publish --from-project plan-picker@3 --version 1.0.0`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "path", Help: "A bundle directory with component.json (the current directory by default)", Optional: true})
	fromProject := cmd.Flags().String("from-project", "", "Publish a ready project component version instead, as `<slug>@<version>`")
	version := cmd.Flags().String("version", "", "Semantic version to publish a project component as (with --from-project)")
	name := cmd.Flags().String("name", "", "Registry name (with --from-project; defaults to the slug)")
	title := cmd.Flags().String("title", "", "Display title (with --from-project)")
	category := cmd.Flags().String("category", "", "Editor category (with --from-project)")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		type publishedVersion = api.PublishedComponentVersionJsonEncoding
		var published cli.Object[publishedVersion]
		projectID := ""

		if *fromProject != "" {
			slug, number, ok := parseProjectVersion(*fromProject)
			if !ok {
				return cli.Usagef("--from-project takes <slug>@<version>, such as plan-picker@3; got %q.", *fromProject)
			}
			if *version == "" {
				return cli.Usagef("--from-project needs --version, such as --version 1.0.0.")
			}
			if len(args) > 0 {
				return cli.Usagef("Pass a bundle directory or --from-project, not both.")
			}
			target, err := app.ResolveProject(ctx, *project)
			if err != nil {
				return err
			}
			projectID = target.Project.Id
			components, _, err := cli.FetchPage[componentapi.Component](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ComponentsList(ctx, projectID, &api.ComponentsListParams{Slug: &slug})
			})
			if err != nil {
				return componentapi.Error(err)
			}
			if len(components.Items) == 0 {
				return &cli.UserError{
					Message:  fmt.Sprintf("The project has no component %s.", slug),
					Hint:     "'voidhash registry list' shows its components.",
					ExitCode: cli.ExitNotFound,
				}
			}
			component := components.Items[0]
			versions, _, err := cli.FetchPage[componentapi.Version](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ComponentsListVersions(ctx, projectID, component.ID, &api.ComponentsListVersionsParams{Version: &number})
			})
			if err != nil {
				return componentapi.Error(err)
			}
			if len(versions.Items) == 0 {
				return &cli.UserError{Message: fmt.Sprintf("%s has no version %d.", slug, number), ExitCode: cli.ExitNotFound}
			}
			body := map[string]any{"componentVersionId": versions.Items[0].ID, "version": *version}
			for key, value := range map[string]string{"name": *name, "title": *title, "category": *category} {
				if value != "" {
					body[key] = value
				}
			}
			published, err = cli.Fetch[publishedVersion](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ComponentRegistryCreateVersionFromComponentWithBody(ctx, projectID, "application/json", componentapi.JSONBody(body))
			})
			if err != nil {
				return componentapi.Error(err)
			}
		} else {
			for flag, value := range map[string]string{"version": *version, "name": *name, "title": *title, "category": *category} {
				if value != "" {
					return cli.Usagef("--%s goes with --from-project; a bundle takes them from its component.json.", flag)
				}
			}
			directory := "."
			if len(args) > 0 {
				directory = args[0]
			}
			bundle, modulePath, err := crate.ReadBundle(componentapi.Path(app, directory))
			var problem *crate.BundleError
			switch {
			case errors.As(err, &problem):
				return cli.Failf("%s", problem.Message).WithHint(problem.Hint)
			case err != nil:
				return &cli.UserError{Message: fmt.Sprintf("Could not read the bundle in %s: %v", directory, err), Cause: err}
			}
			target, err := app.ResolveProject(ctx, *project)
			if err != nil {
				return err
			}
			projectID = target.Project.Id
			app.Notef("Publishing %s (module %s)...", directory, modulePath)
			published, err = cli.Fetch[publishedVersion](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ComponentRegistryCreateVersionFromBundleWithBody(ctx, projectID, "application/json", componentapi.JSONBody(bundle))
			})
			if err != nil {
				return componentapi.Error(err)
			}
		}

		switch mode {
		case cli.JSON:
			return app.PrintJSON(published)
		case cli.Quiet:
			app.PrintIDs(published)
			return nil
		}
		// Only people read the version under its component's slug.
		component, err := cli.Fetch[api.PublishedComponentJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentRegistryGet(ctx, projectID, published.Value.RegistryComponentId)
		})
		if err != nil {
			return componentapi.Error(err)
		}
		slug := component.Value.Slug
		app.Println(cli.Printable(fmt.Sprintf("✓ Published %s %s.", slug, published.Value.Version)))
		app.Println("")
		app.Println(formatRegistryVersion(slug, published.Value))
		app.Notef("Install it in a project with 'voidhash registry install %s'.", cli.Printable(slug))
		return nil
	}
	return cmd
}
