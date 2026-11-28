package registry

import (
	"net/http"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

func addMessageFlag(cmd *cobra.Command) *string {
	return cmd.Flags().String("message", "", "Why, shown wherever the component is used")
}

// updateVersion sets the status of a registry version.
func updateVersion(cmd *cobra.Command, app *cli.App, projectID, componentID, versionID, status, message string) error {
	ctx := cmd.Context()
	body := map[string]any{"status": status}
	if message != "" {
		body["statusMessage"] = message
	}
	err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ComponentRegistryUpdateVersionWithBody(ctx, projectID, componentID, versionID, "application/json", componentapi.JSONBody(body))
	})
	return componentapi.Error(err)
}

// updateComponent changes a registry component.
func updateComponent(cmd *cobra.Command, app *cli.App, projectID, componentID string, body map[string]any) error {
	ctx := cmd.Context()
	err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ComponentRegistryUpdateWithBody(ctx, projectID, componentID, "application/json", componentapi.JSONBody(body))
	})
	return componentapi.Error(err)
}

// newDeprecate creates `voidhash registry deprecate <component> [version] [--message] [--undo]`.
func newDeprecate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "deprecate",
		Short: "Deprecate a component or one of its versions.",
		Long: `Deprecate one version, or the whole component when no version is named.

A deprecated component cannot be newly installed or inserted, and a deprecated version cannot be published in a paywall again; published paywalls keep working. --undo lifts the deprecation.`,
		Example: `voidhash registry deprecate acme/wheel-picker --message "Use acme/picker instead"
voidhash registry deprecate acme/wheel-picker 1.2.0
voidhash registry deprecate acme/wheel-picker 1.2.0 --undo`,
	}
	cli.SetArgs(cmd, componentArg, cli.Arg{Name: "version", Help: "The version to deprecate (the whole component when omitted)", Optional: true})
	message := addMessageFlag(cmd)
	undo := cmd.Flags().Bool("undo", false, "Lift the deprecation")
	project := cli.AddProjectFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		component, err := findComponent(ctx, app, projectID, args[0])
		if err != nil {
			return err
		}
		slug := component.Value.Slug
		if version := cli.ArgAt(args, 1); version != "" {
			found, err := findVersion(ctx, app, projectID, component.Value, version)
			if err != nil {
				return err
			}
			status := "deprecated"
			if *undo {
				status = "ready"
			}
			if err := updateVersion(cmd, app, projectID, component.Value.Id, found.Id, status, *message); err != nil {
				return err
			}
			if *undo {
				app.Println(cli.Printable("✓ " + slug + " " + version + " is no longer deprecated."))
				return nil
			}
			app.Println(cli.Printable("✓ Deprecated " + slug + " " + version + "."))
			app.Notef("Published paywalls keep working.")
			return nil
		}
		body := map[string]any{"isDeprecated": !*undo}
		if *message != "" {
			body["deprecationMessage"] = *message
		}
		if err := updateComponent(cmd, app, projectID, component.Value.Id, body); err != nil {
			return err
		}
		if *undo {
			app.Println(cli.Printable("✓ " + slug + " is no longer deprecated."))
			return nil
		}
		app.Println(cli.Printable("✓ Deprecated " + slug + "."))
		app.Notef("It cannot be newly installed or inserted; published paywalls keep working.")
		return nil
	}
	return cmd
}

// newYank creates `voidhash registry yank <component> <version> [--message]`.
func newYank(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "yank",
		Short:   "Yank a component version for good.",
		Long:    "Yank a version for good: it can no longer be installed, inserted or published. Paywalls already published with it keep working. To discourage a version without closing it, use 'voidhash registry deprecate'.",
		Example: `voidhash registry yank acme/wheel-picker 1.2.0 --message "Crashes on small screens"`,
	}
	cli.SetArgs(cmd, componentArg, cli.Arg{Name: "version", Help: "The version to yank"})
	message := addMessageFlag(cmd)
	project := cli.AddProjectFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		component, err := findComponent(ctx, app, projectID, args[0])
		if err != nil {
			return err
		}
		found, err := findVersion(ctx, app, projectID, component.Value, args[1])
		if err != nil {
			return err
		}
		if err := updateVersion(cmd, app, projectID, component.Value.Id, found.Id, "yanked", *message); err != nil {
			return err
		}
		app.Println(cli.Printable("✓ Yanked " + component.Value.Slug + " " + args[1] + "."))
		app.Notef("It cannot be installed, inserted or published again; published paywalls keep working.")
		return nil
	}
	return cmd
}

// newTransfer creates `voidhash registry transfer <component> [--project]`.
func newTransfer(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "transfer",
		Short: "Move a component to another project of your organization.",
		Long: `Make the project (this directory's, or --project) the owner of a registry component, so the people who may publish paywalls in it can publish new versions, deprecate and yank. The previous owner loses that access.

Only an organization admin can, signed in with 'voidhash login' (not with a secret key).`,
		Example: "voidhash registry transfer acme/wheel-picker --project acme/design-system",
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
		if err := updateComponent(cmd, app, target.Project.Id, component.Value.Id, map[string]any{"ownerProjectId": target.Project.Id}); err != nil {
			return err
		}
		app.Println(cli.Printable("✓ " + component.Value.Slug + " now belongs to " + target.Label() + "."))
		app.Notef("People who may publish paywalls in it can publish, deprecate and yank its versions.")
		return nil
	}
	return cmd
}
