// Package link holds the commands that choose the project others act on:
// `voidhash link`, `unlink` and `switch`.
package link

import (
	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
)

var projectArg = cli.Arg{Name: "project", Help: "The project's slug, organization/slug, name or id", Optional: true}

// NewLink creates `voidhash link [project]`.
func NewLink(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "link",
		Short: "Make a project this directory's: commands run here and below act on it.",
		Long:  "Make a project this directory's: commands run here, and in the directories below, act on it. The link is yours, kept in ~/.voidhash, not in the repository. Without a project, asks which.",
		Example: `voidhash link acme/app
voidhash link`,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()
			// An app's committed config already decides; a link beside it
			// would be ignored.
			if directoryConfig, found, err := app.DirectoryConfig(); err != nil {
				return err
			} else if found {
				return cli.Failf("This directory's %s already names its project.", directoryConfig.FileBase()).
					WithHint("To use another project here, run 'voidhash init' again: it rewrites the config, the client and the types.")
			}
			session, err := app.Session(ctx)
			if err != nil {
				return err
			}
			kind := cli.ProjectKind(session)
			linked, err := cli.RequireItem(ctx, app, kind, session.Projects, cli.ArgAt(args, 0), "voidhash link <project>")
			if err != nil {
				return err
			}
			settings, err := app.Config()
			if err != nil {
				return err
			}
			links := map[string]string{app.Dir: linked.Id}
			for directory, projectID := range settings.Links {
				if directory != app.Dir {
					links[directory] = projectID
				}
			}
			if err := app.WriteConfig(config.Changes{Links: links}); err != nil {
				return err
			}
			app.Printf("Linked %s to %s.\n", app.Dir, cli.Printable(kind.Label(linked)))
			app.Println("Commands you run here, and in the directories below, act on it.")
			return nil
		},
	}
	cli.SetArgs(cmd, projectArg)
	return cmd
}

// NewUnlink creates `voidhash unlink`.
func NewUnlink(app *cli.App) *cobra.Command {
	return &cobra.Command{
		Use:   "unlink",
		Short: "Remove the link 'voidhash link' made for this directory.",
		Long:  "Remove the link 'voidhash link' made for this directory, or for the nearest linked directory above it. Commands here then act on your default project.",
		RunE: func(*cobra.Command, []string) error {
			settings, err := app.Config()
			if err != nil {
				return err
			}
			linked, projectID, ok := cli.LinkFor(settings.Links, app.Dir)
			if !ok {
				app.Println("This directory is not linked to a project.")
				return nil
			}
			links := map[string]string{}
			for directory, id := range settings.Links {
				if directory != linked {
					links[directory] = id
				}
			}
			if err := app.WriteConfig(config.Changes{Links: links}); err != nil {
				return err
			}
			app.Printf("Unlinked %s from %s.\n", linked, projectID)
			return nil
		},
	}
}

// NewSwitch creates `voidhash switch [project]`.
func NewSwitch(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "switch",
		Short: "Choose your default project, which commands act on outside linked directories.",
		Long:  "Choose your default project: the one commands act on outside linked directories and directories whose own configuration names a project. Without a project, asks which.",
		Example: `voidhash switch acme/app
voidhash switch`,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()
			session, err := app.Session(ctx)
			if err != nil {
				return err
			}
			kind := cli.ProjectKind(session)
			chosen, err := cli.RequireItem(ctx, app, kind, session.Projects, cli.ArgAt(args, 0), "voidhash switch <project>")
			if err != nil {
				return err
			}
			if err := app.WriteConfig(config.Changes{DefaultProject: &chosen.Id}); err != nil {
				return err
			}
			app.Printf("Your default project is now %s.\n", cli.Printable(kind.Label(chosen)))

			// Say so when this directory keeps acting on another project.
			if directoryConfig, found, err := app.DirectoryConfig(); err != nil {
				return err
			} else if found {
				app.Printf("This directory's %s still names %s/%s.\n", directoryConfig.FileBase(), directoryConfig.Team, directoryConfig.Project)
				return nil
			}
			settings, err := app.Config()
			if err != nil {
				return err
			}
			if linked, projectID, ok := cli.LinkFor(settings.Links, app.Dir); ok && projectID != chosen.Id {
				name := projectID
				if project := session.Project(projectID); project != nil {
					name = kind.Label(*project)
				}
				app.Printf("%s is still linked to %s.\n", linked, cli.Printable(name))
			}
			return nil
		},
	}
	cli.SetArgs(cmd, projectArg)
	return cmd
}
