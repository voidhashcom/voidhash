// Package project holds `voidhash project`: list, create, rename and delete
// projects.
package project

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash project`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "project",
		Aliases: []string{"projects"},
		Short:   "Your projects: list, create, rename and delete them.",
	}
	cmd.AddCommand(newList(app), newCreate(app), newEdit(app), newDelete(app))
	return cmd
}

var projectArg = cli.Arg{
	Name:     "project",
	Help:     "The project's slug, organization/slug, name or id (default: this directory's project, then your default project)",
	Optional: true,
}

// projectNamed is the project input names, or the one commands act on here.
func projectNamed(ctx context.Context, app *cli.App, input string) (api.SessionProjectJsonEncoding, *cli.Session, error) {
	session, err := app.Session(ctx)
	if err != nil {
		return api.SessionProjectJsonEncoding{}, nil, err
	}
	if input == "" {
		target, err := app.ResolveProject(ctx, "")
		if err != nil {
			return api.SessionProjectJsonEncoding{}, nil, err
		}
		return target.Project, session, nil
	}
	project, err := cli.FindItem(cli.ProjectKind(session), session.Projects, input)
	return project, session, err
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the projects of an organization.",
		Example: "voidhash project list\nvoidhash project list --org acme --json",
	}
	org := cli.AddOrgFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		projects, err := cli.ListAll[api.ProjectJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ProjectsList(ctx, organization.Id, &api.ProjectsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(projects)
		case cli.Quiet:
			app.PrintIDs(projects)
			return nil
		}
		cli.PrintTable(app, []cli.Column[api.ProjectJsonEncoding]{
			{Header: "NAME", Cell: func(project api.ProjectJsonEncoding) string { return project.Name }},
			{Header: "SLUG", Cell: func(project api.ProjectJsonEncoding) string { return organization.Slug + "/" + project.Slug }},
			{Header: "ID", Cell: func(project api.ProjectJsonEncoding) string { return project.Id }},
		}, projects.Items, fmt.Sprintf("%s has no projects yet. Create one with 'voidhash project create --org %s'.",
			cli.OrganizationKind.Label(organization), organization.Slug))
		return nil
	}
	return cmd
}

func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a project in an organization.",
		Long:  "Create a project, with its production and test publishable keys, in an organization. --switch makes it your default project.",
		Example: `voidhash project create "My App"
voidhash project create "My App" --org acme --switch`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "name", Help: "The project's name, such as your app's", Optional: true})
	org := cli.AddOrgFlag(cmd)
	makeDefault := cmd.Flags().Bool("switch", false, "Make it your default project, as 'voidhash switch' does")
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		name, err := app.RequireText(ctx, cli.ArgAt(args, 0), cli.TextPrompt{
			What: "the name", Message: "Project name", Usage: "voidhash project create <name> [--org <org>]",
		})
		if err != nil {
			return err
		}
		created, err := cli.Fetch[api.ProjectJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ProjectsCreate(ctx, organization.Id, api.CreateProjectBodyJsonEncoding{Name: name})
		})
		if err != nil {
			return err
		}
		if *makeDefault {
			if err := app.WriteConfig(config.Changes{DefaultProject: &created.Value.Id}); err != nil {
				return err
			}
		}
		if mode != cli.Human {
			return app.PrintItem(mode, created, "")
		}

		path := organization.Slug + "/" + created.Value.Slug
		lines := []string{fmt.Sprintf("Created %s (%s), %s.", created.Value.Name, path, created.Value.Id)}
		// Apps need the publishable keys, so people see them right away. The
		// project exists either way, so a failure to list them is not one.
		publishable := api.ApiKeyType("publishable")
		keys, _, err := cli.FetchPage[api.ApiKeyJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ApiKeysList(ctx, created.Value.Id, &api.ApiKeysListParams{Type: &publishable})
		})
		if err != nil {
			app.Debugf("Listing the new project's keys failed: %v", err)
		}
		for _, environment := range []struct{ name, label string }{
			{"production", "Publishable key: "},
			{"test", "Test publishable key, for debug, staging and test builds: "},
		} {
			for _, key := range keys.Items {
				if string(key.Environment) == environment.name && key.RawKey != nil {
					lines = append(lines, environment.label+*key.RawKey)
					break
				}
			}
		}
		lines = append(lines, "Next:")
		if *makeDefault {
			lines = append(lines, "  It is your default project now.")
		} else {
			lines = append(lines, fmt.Sprintf("  Make it your default: 'voidhash switch %s'", path))
		}
		lines = append(lines, "  Set up your app with it: 'voidhash init'")
		return app.PrintItem(mode, created, strings.Join(lines, "\n"))
	}
	return cmd
}

func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Rename a project or change its logo.",
		Long:  "Rename a project or change its logo. Its slug never changes, so apps and links keep working.",
		Example: `voidhash project edit app --name "My App"
voidhash project edit --logo icon.png`,
	}
	cli.SetArgs(cmd, projectArg)
	name := cmd.Flags().String("name", "", "Its new name")
	logo := cli.AddLogoFlags(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if err := logo.Check(); err != nil {
			return err
		}
		if *name == "" && logo.File == "" && !logo.Remove {
			return cli.Usagef("Nothing to change.").WithHint("Pass --name, --logo <file> or --remove-logo.")
		}
		found, _, err := projectNamed(ctx, app, cli.ArgAt(args, 0))
		if err != nil {
			return err
		}
		// Read the image first, so a bad file changes nothing.
		var image api.AvatarImageBodyJsonEncoding
		if logo.File != "" {
			if image, err = app.ReadLogo(logo.File); err != nil {
				return err
			}
		}
		updated, err := cli.Fetch[api.ProjectJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			if *name != "" {
				return c.ProjectsUpdate(ctx, found.Id, api.UpdateProjectBodyJsonEncoding{Name: name})
			}
			return c.ProjectsGet(ctx, found.Id)
		})
		if err != nil {
			return err
		}
		var changes []string
		if *name != "" && *name != found.Name {
			changes = append(changes, "renamed it from "+found.Name)
		}
		switch {
		case logo.File != "":
			updated, err = cli.Fetch[api.ProjectJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ProjectsSetAvatar(ctx, found.Id, image)
			})
			changes = append(changes, "set its logo")
		case logo.Remove:
			err = cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ProjectsRemoveAvatar(ctx, found.Id)
			})
			updated.Value.LogoUrl = nil
			updated = cli.NewObject(updated.Value)
			changes = append(changes, "removed its logo")
		}
		if err != nil {
			return err
		}
		human := "Nothing changed."
		if len(changes) > 0 {
			human = fmt.Sprintf("Updated %s: %s. Its slug stays %s, so apps and links keep working.",
				updated.Value.Name, strings.Join(changes, ", "), updated.Value.Slug)
		}
		return app.PrintItem(mode, updated, human)
	}
	return cmd
}

func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete a project and everything in it.",
		Long:  "Delete a project and everything in it: its keys, catalog, people, purchases and analytics. This cannot be undone. Asks you to type its name; --yes skips that.",
		Example: `voidhash project delete acme/web
voidhash project delete acme/web --yes`,
	}
	cli.SetArgs(cmd, projectArg)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		found, session, err := projectNamed(ctx, app, cli.ArgAt(args, 0))
		if err != nil {
			return err
		}
		name := cli.ProjectKind(session).Label(found)
		if err := app.ConfirmByTypingName(ctx, *yes,
			fmt.Sprintf("Delete %s for good? Its keys, catalog, people, purchases and analytics are deleted, and apps using its keys stop working.", name),
			found.Name); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ProjectsDelete(ctx, found.Id)
		}); err != nil {
			return err
		}
		// A default or a link left pointing at the deleted project would
		// fail every later command until it is changed by hand.
		if settings, err := app.Config(); err == nil {
			var changes config.Changes
			var notes []string
			if settings.DefaultProject == found.Id {
				none := ""
				changes.DefaultProject = &none
				notes = append(notes, "It was your default project, so there is none now; choose one with 'voidhash switch'.")
			}
			links := map[string]string{}
			var unlinked []string
			for directory, projectID := range settings.Links {
				if projectID == found.Id {
					unlinked = append(unlinked, directory)
				} else {
					links[directory] = projectID
				}
			}
			if len(unlinked) > 0 {
				changes.Links = links
				slices.Sort(unlinked)
				for _, directory := range unlinked {
					notes = append(notes, fmt.Sprintf("Removed the link of %s to it.", directory))
				}
			}
			if len(notes) > 0 {
				if err := app.WriteConfig(changes); err != nil {
					return err
				}
				for _, note := range notes {
					app.Notef("%s", cli.Printable(note))
				}
			}
		}
		return app.PrintItem(mode, cli.NewObject(found), "Deleted "+name+".")
	}
	return cmd
}
