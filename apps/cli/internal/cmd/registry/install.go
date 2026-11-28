package registry

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// changeLabels say what each kind of definition change means for a project,
// in one line. A change a newer server reports that this CLI does not know
// is printed as its kind.
var changeLabels = map[string]string{
	"capability_added":      "asks for",
	"capability_removed":    "no longer asks for",
	"prop_added":            "adds prop",
	"prop_removed":          "removes prop",
	"prop_type_changed":     "changes the type of prop",
	"event_added":           "adds event",
	"event_removed":         "removes event",
	"event_payload_changed": "changes the payload of event",
}

type installReview = api.PublishedComponentInstallReviewJsonEncoding

// formatInstallReview writes the lines a person reads before installing or
// updating the registry component slug.
func formatInstallReview(slug string, review installReview) string {
	from := ""
	if review.CurrentVersion != nil {
		from = *review.CurrentVersion + " → "
	}
	lines := []string{fmt.Sprintf("%s %s%s (range %s)", slug, from, review.TargetVersion, review.VersionRange)}
	if len(review.TargetCapabilities) > 0 {
		lines = append(lines, "  Capabilities: "+strings.Join(review.TargetCapabilities, ", "))
	}
	for _, change := range review.Changes {
		label, known := changeLabels[string(change.Kind)]
		if !known {
			label = string(change.Kind)
		}
		lines = append(lines, "  - "+label+" "+change.Name)
	}
	return cli.PrintableLines(strings.Join(lines, "\n"))
}

func addRangeFlag(cmd *cobra.Command) *string {
	return cmd.Flags().String("range", "", "Version `range`: *, an exact version, ^1.2.3 or ~1.2.3")
}

func addAcceptFlag(cmd *cobra.Command) *bool {
	yes := cli.AddYesFlag(cmd)
	cmd.Flags().Lookup("yes").Usage = "Accept the capabilities and changes the review shows"
	return yes
}

// reviewAndConsent fetches the review of installing or updating component,
// shows it to a person, and returns the consent to send: nil when nothing
// needs accepting, and otherwise the reviewed version and every capability
// it asks for, once the person accepted them with --yes or at the prompt.
func reviewAndConsent(cmd *cobra.Command, app *cli.App, mode cli.OutputMode, review installReview, slug string, yes bool) (map[string]any, error) {
	if mode == cli.Human || review.IsConsentRequired && !yes {
		// The review is what the person accepts, so it is shown wherever
		// they are asked; scripts that passed --yes get the result alone.
		app.Notef("%s", formatInstallReview(slug, review))
	}
	if !review.IsConsentRequired {
		return nil, nil
	}
	if err := app.ConfirmChange(cmd.Context(), yes, fmt.Sprintf("Accept the capabilities and changes of %s %s?", slug, review.TargetVersion)); err != nil {
		return nil, err
	}
	capabilities := review.TargetCapabilities
	if capabilities == nil {
		capabilities = []string{}
	}
	return map[string]any{"version": review.TargetVersion, "capabilities": capabilities}, nil
}

func installBody(base map[string]any, versionRange string, consent map[string]any) map[string]any {
	if versionRange != "" {
		base["versionRange"] = versionRange
	}
	if consent != nil {
		base["consent"] = consent
	}
	return base
}

func getReview(cmd *cobra.Command, app *cli.App, projectID, componentID, versionRange string) (installReview, error) {
	ctx := cmd.Context()
	params := &api.ComponentRegistryGetInstallReviewParams{}
	if versionRange != "" {
		params.VersionRange = &versionRange
	}
	review, err := cli.Fetch[installReview](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ComponentRegistryGetInstallReview(ctx, projectID, componentID, params)
	})
	return review.Value, componentapi.Error(err)
}

// newInstall creates `voidhash registry install <component> [--range] [--yes]`.
func newInstall(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "install",
		Short: "Install a component from your organization's registry.",
		Long: `Install a component of your organization's registry into the project, after showing what it asks for.

A component that asks for capabilities (such as commerce or links) needs your consent: accept at the prompt, or pass --yes after reviewing them.`,
		Example: `voidhash registry install acme/wheel-picker
voidhash registry install acme/wheel-picker --range ^1.2.0 --yes`,
	}
	cli.SetArgs(cmd, componentArg)
	versionRange := addRangeFlag(cmd)
	yes := addAcceptFlag(cmd)
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
		component, err := findComponent(ctx, app, projectID, args[0])
		if err != nil {
			return err
		}
		review, err := getReview(cmd, app, projectID, component.Value.Id, *versionRange)
		if err != nil {
			return err
		}
		consent, err := reviewAndConsent(cmd, app, mode, review, component.Value.Slug, *yes)
		if err != nil {
			return err
		}
		body := installBody(map[string]any{"registryComponentId": component.Value.Id}, *versionRange, consent)
		install, err := cli.Fetch[api.PublishedComponentInstallJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentRegistryCreateInstallWithBody(ctx, projectID, "application/json", componentapi.JSONBody(body))
		})
		if err != nil {
			return componentapi.Error(err)
		}
		return app.PrintItem(mode, install, "✓ Installed "+formatInstall(install.Value)+" in "+target.Label()+".")
	}
	return cmd
}

// newUpdate creates `voidhash registry update <component> [--range] [--yes]`.
func newUpdate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update an installed component to the newest version in its range.",
		Long: `Move an install to the newest version in its range, or to a new range with --range.

Components already placed in paywalls keep their version until they are moved in the editor.`,
		Example: `voidhash registry update acme/wheel-picker
voidhash registry update acme/wheel-picker --range ^2.0.0 --yes`,
	}
	cli.SetArgs(cmd, componentArg)
	versionRange := addRangeFlag(cmd)
	yes := addAcceptFlag(cmd)
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
		component, err := findComponent(ctx, app, projectID, args[0])
		if err != nil {
			return err
		}
		installID, err := requireInstall(component.Value)
		if err != nil {
			return err
		}
		review, err := getReview(cmd, app, projectID, component.Value.Id, *versionRange)
		if err != nil {
			return err
		}
		if review.CurrentVersionId != nil && *review.CurrentVersionId == review.TargetVersionId {
			if mode != cli.Human {
				// Scripts get the install as it stands.
				install, err := cli.Fetch[api.PublishedComponentInstallJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
					return c.ComponentRegistryGetInstall(ctx, projectID, installID)
				})
				if err != nil {
					return componentapi.Error(err)
				}
				return app.PrintItem(mode, install, "")
			}
			app.Println(cli.Printable(fmt.Sprintf("%s is already on %s.", component.Value.Slug, review.TargetVersion)))
			return nil
		}
		consent, err := reviewAndConsent(cmd, app, mode, review, component.Value.Slug, *yes)
		if err != nil {
			return err
		}
		body := installBody(map[string]any{}, *versionRange, consent)
		install, err := cli.Fetch[api.PublishedComponentInstallJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentRegistryUpdateInstallWithBody(ctx, projectID, installID, "application/json", componentapi.JSONBody(body))
		})
		if err != nil {
			return componentapi.Error(err)
		}
		return app.PrintItem(mode, install, "✓ Updated "+formatInstall(install.Value)+" in "+target.Label()+".")
	}
	return cmd
}

// newUninstall creates `voidhash registry uninstall <component>`.
func newUninstall(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "uninstall",
		Short:   "Remove an installed component from the project.",
		Long:    "Remove an installed component from the project. Published paywalls keep working; paywalls that still place it cannot be published until it is removed from them or installed again.",
		Example: "voidhash registry uninstall acme/wheel-picker",
	}
	cli.SetArgs(cmd, componentArg)
	project := cli.AddProjectFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		component, err := findComponent(ctx, app, target.Project.Id, args[0])
		if err != nil {
			return err
		}
		installID, err := requireInstall(component.Value)
		if err != nil {
			return err
		}
		err = cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentRegistryDeleteInstall(ctx, target.Project.Id, installID)
		})
		if err != nil {
			return componentapi.Error(err)
		}
		app.Println(cli.Printable("✓ Uninstalled " + component.Value.Slug + " from " + target.Label() + "."))
		app.Notef("Published paywalls keep working; paywalls that still place it cannot be published until it is removed or installed again.")
		return nil
	}
	return cmd
}
