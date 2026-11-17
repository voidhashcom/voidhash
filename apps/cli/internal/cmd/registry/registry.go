// Package registry holds `voidhash registry`: the organization's component
// registry and the project's installs from it.
package registry

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
)

// New creates `voidhash registry`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "registry",
		Short: "Publish components to your organization's registry, and install them.",
		Long: `Publish components to your organization's registry, and install and manage registry components in a project.

A registry component is named <publisher>/<name>, such as acme/wheel-picker: the publisher is your organization's namespace ('voidhash registry publisher show'). Every project of the organization can install what the registry holds.`,
	}
	cmd.AddCommand(
		newList(app),
		newPublish(app),
		newInstall(app),
		newUpdate(app),
		newUninstall(app),
		newDeprecate(app),
		newYank(app),
		newTransfer(app),
		newPublisher(app),
	)
	return cmd
}

var componentArg = cli.Arg{Name: "component", Help: "The registry component's id, such as acme/wheel-picker"}

var (
	componentIDPattern    = regexp.MustCompile(`^([a-z0-9][a-z0-9-]*)/([a-z0-9][a-z0-9-]*)$`)
	projectVersionPattern = regexp.MustCompile(`^([a-z0-9][a-z0-9-]*)@([1-9]\d*)$`)
)

// parseComponentID splits a registry component id (acme/wheel-picker) into
// its publisher and name.
func parseComponentID(id string) (publisher, name string, ok bool) {
	match := componentIDPattern.FindStringSubmatch(strings.TrimSpace(id))
	if match == nil {
		return "", "", false
	}
	return match[1], match[2], true
}

// parseProjectVersion reads `--from-project <slug>@<version>`: a project
// component slug and its catalog version number.
func parseProjectVersion(value string) (slug string, version int, ok bool) {
	match := projectVersionPattern.FindStringSubmatch(strings.TrimSpace(value))
	if match == nil {
		return "", 0, false
	}
	version, err := strconv.Atoi(match[2])
	return match[1], version, err == nil
}

// findComponent finds the component of the organization's registry that id
// (acme/wheel-picker) names, as the project sees it, with the project's
// install of it.
func findComponent(ctx context.Context, app *cli.App, projectID, id string) (cli.Object[api.PublishedComponentJsonEncoding], error) {
	publisher, name, ok := parseComponentID(id)
	if !ok {
		return cli.Object[api.PublishedComponentJsonEncoding]{}, cli.Usagef("%q is not a component id.", id).
			WithHint("A registry component is <publisher>/<name>, such as acme/wheel-picker; 'voidhash registry list' shows them.")
	}
	slug := publisher + "/" + name
	found, _, err := cli.FetchPage[api.PublishedComponentJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ComponentRegistryList(ctx, projectID, &api.ComponentRegistryListParams{Slug: &slug})
	})
	if err != nil {
		return cli.Object[api.PublishedComponentJsonEncoding]{}, componentapi.Error(err)
	}
	if len(found.Items) == 0 {
		return cli.Object[api.PublishedComponentJsonEncoding]{}, &cli.UserError{
			Message:  fmt.Sprintf("Your organization's registry has no component %s.", slug),
			Hint:     "'voidhash registry list' shows them.",
			ExitCode: cli.ExitNotFound,
		}
	}
	return found.Object(0), nil
}

// findVersion finds the version of the registry component published as the
// semantic version version.
func findVersion(ctx context.Context, app *cli.App, projectID string, component api.PublishedComponentJsonEncoding, version string) (api.PublishedComponentVersionJsonEncoding, error) {
	found, _, err := cli.FetchPage[api.PublishedComponentVersionJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ComponentRegistryListVersions(ctx, projectID, component.Id, &api.ComponentRegistryListVersionsParams{Version: &version})
	})
	if err != nil {
		return api.PublishedComponentVersionJsonEncoding{}, componentapi.Error(err)
	}
	if len(found.Items) == 0 {
		return api.PublishedComponentVersionJsonEncoding{}, &cli.UserError{
			Message:  fmt.Sprintf("%s has no version %s.", component.Slug, version),
			ExitCode: cli.ExitNotFound,
		}
	}
	return found.Items[0], nil
}

// requireInstall is the project's install of component, or a failure saying
// it has none.
func requireInstall(component api.PublishedComponentJsonEncoding) (string, error) {
	if component.InstallId == nil {
		return "", cli.Failf("%s is not installed in this project.", component.Slug).
			WithHint(fmt.Sprintf("Install it with 'voidhash registry install %s'.", component.Slug))
	}
	return *component.InstallId, nil
}

func noneIfEmpty(items []string, none string) string {
	if len(items) == 0 {
		return none
	}
	return strings.Join(items, ", ")
}

// formatRegistryVersion lists the facts of a version of the registry
// component slug, one aligned line each, then its warnings.
func formatRegistryVersion(slug string, version api.PublishedComponentVersionJsonEncoding) string {
	status := string(version.Status)
	if version.StatusMessage != nil && *version.StatusMessage != "" {
		status += " (" + *version.StatusMessage + ")"
	}
	lines := []string{
		cli.Printable(slug + " " + version.Version),
		cli.FormatFields([]cli.Field{
			{Label: "Status", Value: status},
			{Label: "Number", Value: strconv.Itoa(version.Number)},
			{Label: "Capabilities", Value: noneIfEmpty(version.Capabilities, "none")},
			{Label: "Content hash", Value: version.ContentHash},
			{Label: "Bundle hash", Value: version.BundleHash},
			{Label: "Size", Value: fmt.Sprintf("%d bytes", version.ByteSize)},
		}),
	}
	for _, warning := range version.Warnings {
		lines = append(lines, "  ! "+cli.Printable(componentapi.WarningLabel(string(warning))))
	}
	return strings.Join(lines, "\n")
}

// formatInstall is one line per install for `registry install` and `update`.
func formatInstall(install api.PublishedComponentInstallJsonEncoding) string {
	return fmt.Sprintf("%s %s (range %s)", install.Slug, install.Version, install.VersionRange)
}

// newPublisher creates `voidhash registry publisher`.
func newPublisher(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "publisher",
		Short: "Show or claim the namespace your organization publishes components under.",
	}
	cmd.AddCommand(newPublisherShow(app), newPublisherClaim(app))
	return cmd
}

// newPublisherShow creates `voidhash registry publisher show`.
func newPublisherShow(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "show",
		Short:   "Show the organization's component namespace.",
		Long:    "Show the namespace the project's organization publishes components under.",
		Example: "voidhash registry publisher show",
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		publisher, err := cli.Fetch[api.RegistryPublisherJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentRegistryGetPublisher(ctx, target.Project.Id)
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"registry_publisher_not_found": "Claim one with 'voidhash registry publisher claim <namespace>'.",
			})
		}
		if *asJSON {
			return app.PrintJSON(publisher)
		}
		namespace := cli.Printable(publisher.Value.Namespace)
		app.Println("Namespace: " + namespace)
		app.Println("Components publish as " + namespace + "/<name>.")
		return nil
	}
	return cmd
}

// newPublisherClaim creates `voidhash registry publisher claim <namespace>`.
func newPublisherClaim(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "claim",
		Short: "Claim the organization's component namespace.",
		Long: `Claim the namespace your organization publishes components under, or rename it while nothing is published.

Only an organization admin can, signed in with 'voidhash login' (not with a secret key).`,
		Example: "voidhash registry publisher claim acme",
	}
	cli.SetArgs(cmd, cli.Arg{Name: "namespace", Help: "Lowercase letters, digits and dashes, at most 39 characters"})
	project := cli.AddProjectFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		publisher, err := cli.Fetch[api.RegistryPublisherJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentRegistryUpsertPublisher(ctx, target.Project.Id, api.UpsertRegistryPublisherBodyJsonEncoding{Namespace: args[0]})
		})
		if err != nil {
			return componentapi.Error(err)
		}
		if *asJSON {
			return app.PrintJSON(publisher)
		}
		app.Println("✓ Your organization publishes components as " + cli.Printable(publisher.Value.Namespace) + "/<name>.")
		return nil
	}
	return cmd
}
