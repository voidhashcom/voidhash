// Package org holds `voidhash org`: the organizations that own projects.
package org

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash org`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "org",
		Aliases: []string{"orgs"},
		Short:   "The organizations that own your projects: list, create, rename and delete them.",
	}
	cmd.AddCommand(newList(app), newCreate(app), newEdit(app), newDelete(app))
	return cmd
}

var orgArg = cli.Arg{Name: "org", Help: "The organization's slug, name or id", Optional: true}

func label(organization api.OrganizationJsonEncoding) string {
	return organization.Name + " (" + organization.Slug + ")"
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the organizations you belong to and their projects.",
		Example: "voidhash org list\nvoidhash org list --json",
	}
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		organizations, err := cli.ListAll[api.OrganizationJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.OrganizationsList(ctx, &api.OrganizationsListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(organizations)
		case cli.Quiet:
			app.PrintIDs(organizations)
			return nil
		}
		session, err := app.Session(ctx)
		if err != nil {
			return err
		}
		cli.PrintTable(app, []cli.Column[api.OrganizationJsonEncoding]{
			{Header: "NAME", Cell: func(organization api.OrganizationJsonEncoding) string { return organization.Name }},
			{Header: "SLUG", Cell: func(organization api.OrganizationJsonEncoding) string { return organization.Slug }},
			{Header: "PROJECTS", Cell: func(organization api.OrganizationJsonEncoding) string {
				var slugs []string
				for _, project := range session.ProjectsIn(organization.Id) {
					slugs = append(slugs, project.Slug)
				}
				if len(slugs) == 0 {
					return "-"
				}
				return strings.Join(slugs, ", ")
			}},
			{Header: "ID", Cell: func(organization api.OrganizationJsonEncoding) string { return organization.Id }},
		}, organizations.Items, "You belong to no organization yet. Create one with 'voidhash org create'.")
		return nil
	}
	return cmd
}

func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "create",
		Short:   "Create an organization, with you as its owner.",
		Example: `voidhash org create "Acme Inc"`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "name", Help: "The organization's name, such as your company's", Optional: true})
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		name, err := app.RequireText(ctx, cli.ArgAt(args, 0), cli.TextPrompt{
			What: "the name", Message: "Organization name", Usage: "voidhash org create <name>",
		})
		if err != nil {
			return err
		}
		created, err := cli.Fetch[api.OrganizationJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.OrganizationsCreate(ctx, api.CreateOrganizationBodyJsonEncoding{Name: name})
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, created, strings.Join([]string{
			fmt.Sprintf("Created %s; you are its owner.", label(created.Value)),
			"Next:",
			fmt.Sprintf("  Create a project in it: 'voidhash project create --org %s'", created.Value.Slug),
			fmt.Sprintf("  Add your team: 'voidhash member invite <email> --org %s'", created.Value.Slug),
		}, "\n"))
	}
	return cmd
}

func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Rename an organization or change its logo.",
		Long:  "Rename an organization or change its logo. Its slug never changes.",
		Example: `voidhash org edit acme --name "Acme Inc"
voidhash org edit acme --logo logo.png`,
	}
	cli.SetArgs(cmd, orgArg)
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
		session, err := app.Session(ctx)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, cli.OrganizationKind, session.Organizations, cli.ArgAt(args, 0), "voidhash org edit <org> --name <name>")
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
		updated, err := cli.Fetch[api.OrganizationJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			if *name != "" {
				return c.OrganizationsUpdate(ctx, found.Id, api.UpdateOrganizationBodyJsonEncoding{Name: name})
			}
			return c.OrganizationsGet(ctx, found.Id)
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
			updated, err = cli.Fetch[api.OrganizationJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.OrganizationsSetAvatar(ctx, found.Id, image)
			})
			changes = append(changes, "set its logo")
		case logo.Remove:
			err = cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.OrganizationsRemoveAvatar(ctx, found.Id)
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
			human = fmt.Sprintf("Updated %s: %s. Its slug stays %s.", label(updated.Value), strings.Join(changes, ", "), updated.Value.Slug)
		}
		return app.PrintItem(mode, updated, human)
	}
	return cmd
}

func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete an organization with its projects and all their data.",
		Long:  "Delete an organization with its projects and all their data. This cannot be undone. Asks you to type its name; --yes skips that.",
		Example: `voidhash org delete acme
voidhash org delete acme --yes`,
	}
	cli.SetArgs(cmd, orgArg)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		session, err := app.Session(ctx)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, cli.OrganizationKind, session.Organizations, cli.ArgAt(args, 0), "voidhash org delete <org> --yes")
		if err != nil {
			return err
		}
		reach := "It has no projects you can see."
		if projects := session.ProjectsIn(found.Id); len(projects) > 0 {
			slugs := make([]string, len(projects))
			for index, project := range projects {
				slugs[index] = project.Slug
			}
			reach = fmt.Sprintf("Its projects %s and everything in them (keys, catalog, people, purchases, analytics) are deleted, and apps using their keys stop working.", strings.Join(slugs, ", "))
		}
		name := cli.OrganizationKind.Label(found)
		if err := app.ConfirmByTypingName(ctx, *yes, fmt.Sprintf("Delete %s for good? %s Every member loses access.", name, reach), found.Name); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.OrganizationsDelete(ctx, found.Id)
		}); err != nil {
			return err
		}
		return app.PrintItem(mode, cli.NewObject(found), "Deleted "+name+".")
	}
	return cmd
}
