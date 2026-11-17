package registry

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
)

func dash(value *string) string {
	if value == nil {
		return "-"
	}
	return *value
}

// newList creates `voidhash registry list`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's components, its installs, and your organization's registry.",
		Long: `List the project's own components with their newest versions, the registry components it has installed, and every component of the organization's registry.

With --json, one object holds the three lists: "components", "installs" and "registry".`,
		Example: `voidhash registry list
voidhash registry list --project acme/app --json`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		components, err := cli.ListAll[componentapi.Component](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ComponentsList(ctx, projectID, &api.ComponentsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return componentapi.Error(err)
		}
		installs, err := cli.ListAll[api.PublishedComponentInstallJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ComponentRegistryListInstalls(ctx, projectID, &api.ComponentRegistryListInstallsParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return componentapi.Error(err)
		}
		registry, err := cli.ListAll[api.PublishedComponentJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ComponentRegistryList(ctx, projectID, &api.ComponentRegistryListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return componentapi.Error(err)
		}
		if *asJSON {
			return app.PrintJSON(map[string]any{
				"components": components.RawJSON(),
				"installs":   installs.RawJSON(),
				"registry":   registry.RawJSON(),
			})
		}

		bold := app.Style().Bold
		sections := []string{bold("Project components")}
		if len(components.Items) == 0 {
			sections = append(sections, "  None yet. Create one with 'voidhash new <name>', then 'voidhash publish'.")
		} else {
			sections = append(sections, cli.FormatTable(projectColumns, components.Items, bold))
		}
		sections = append(sections, "", bold("Installed"))
		if len(installs.Items) == 0 {
			sections = append(sections, "  None. Install one with 'voidhash registry install <publisher>/<name>'.")
		} else {
			sections = append(sections, cli.FormatTable(installColumns(registry.Items), installs.Items, bold))
		}
		hasUpdate := false
		for _, install := range installs.Items {
			hasUpdate = hasUpdate || install.AvailableUpdate != nil
		}
		sections = append(sections, "", bold("Organization registry"))
		if len(registry.Items) == 0 {
			sections = append(sections, "  Nothing published yet. Publish with 'voidhash registry publish'.")
		} else {
			sections = append(sections, cli.FormatTable(registryColumns(installs.Items, target.Session.Projects), registry.Items, bold))
		}
		app.Println(strings.Join(sections, "\n"))
		if hasUpdate {
			app.Notef("Move an install to its UPDATE with 'voidhash registry update <component>'.")
		}
		return nil
	}
	return cmd
}

var projectColumns = []cli.Column[componentapi.Component]{
	{Header: "SLUG", Cell: func(c componentapi.Component) string { return c.Slug }},
	{Header: "TITLE", Cell: func(c componentapi.Component) string { return c.Title }},
	{Header: "LATEST", Cell: func(c componentapi.Component) string {
		latest := c.LatestVersion
		if latest == nil {
			return "-"
		}
		failed := ""
		if latest.Conformance != nil && !latest.Conformance.HasPassed {
			failed = " (failed checks)"
		}
		return fmt.Sprintf("v%d %s%s", latest.Version, latest.Status, failed)
	}},
	{Header: "READY", Cell: func(c componentapi.Component) string {
		if c.LatestReadyVersion == nil {
			return "-"
		}
		return fmt.Sprintf("v%d", c.LatestReadyVersion.Version)
	}},
	{Header: "HASH", Cell: func(c componentapi.Component) string {
		if c.LatestReadyVersion == nil || c.LatestReadyVersion.ContentHash == nil {
			return "-"
		}
		hash := *c.LatestReadyVersion.ContentHash
		if len(hash) > 12 {
			hash = hash[:12]
		}
		return hash
	}},
	// A version's warning codes, or `-` when the server checked everything.
	{Header: "WARNINGS", Cell: func(c componentapi.Component) string {
		version := c.LatestReadyVersion
		if version == nil {
			version = c.LatestVersion
		}
		if version == nil {
			return "-"
		}
		return noneIfEmpty(version.Warnings, "-")
	}},
}

// installColumns shows the project's installs; registry holds the
// components the installs are of, to tell which are deprecated.
func installColumns(registry []api.PublishedComponentJsonEncoding) []cli.Column[api.PublishedComponentInstallJsonEncoding] {
	type install = api.PublishedComponentInstallJsonEncoding
	return []cli.Column[install]{
		{Header: "COMPONENT", Cell: func(i install) string { return i.Slug }},
		{Header: "VERSION", Cell: func(i install) string { return i.Version }},
		{Header: "RANGE", Cell: func(i install) string { return i.VersionRange }},
		{Header: "UPDATE", Cell: func(i install) string { return dash(i.AvailableUpdate) }},
		{Header: "STATUS", Cell: func(i install) string {
			for _, component := range registry {
				if component.IsDeprecated && component.Id == i.RegistryComponentId {
					return string(i.VersionStatus) + " (component deprecated)"
				}
			}
			return string(i.VersionStatus)
		}},
		{Header: "CAPABILITIES", Cell: func(i install) string { return noneIfEmpty(i.ConsentedCapabilities, "-") }},
	}
}

// registryColumns shows the organization's registry; installs are the
// project's, and projects the ones the signed-in person can use, which name
// the owners.
func registryColumns(installs []api.PublishedComponentInstallJsonEncoding, projects []api.SessionProjectJsonEncoding) []cli.Column[api.PublishedComponentJsonEncoding] {
	type component = api.PublishedComponentJsonEncoding
	return []cli.Column[component]{
		{Header: "COMPONENT", Cell: func(c component) string { return c.Slug }},
		{Header: "TITLE", Cell: func(c component) string {
			if c.IsDeprecated {
				return c.Title + " (deprecated)"
			}
			return c.Title
		}},
		{Header: "OWNER", Cell: func(c component) string {
			if c.OwnerProjectId == nil {
				return "-"
			}
			for _, project := range projects {
				if project.Id == *c.OwnerProjectId {
					return project.Name
				}
			}
			return *c.OwnerProjectId
		}},
		{Header: "LATEST", Cell: func(c component) string { return dash(c.LatestVersion) }},
		{Header: "INSTALLED", Cell: func(c component) string {
			for _, install := range installs {
				if c.InstallId != nil && install.Id == *c.InstallId {
					return install.Version
				}
			}
			return "-"
		}},
	}
}
