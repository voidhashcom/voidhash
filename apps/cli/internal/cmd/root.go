// Package cmd assembles the CLI: every command group under the root
// command, in the groups its help shows.
package cmd

import (
	"errors"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/ads"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/audit"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/auth"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/config"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/dev"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/domain"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/events"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/experiment"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/feedback"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/flag"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/home"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/initcmd"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/insights"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/integrate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/key"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/link"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/location"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/mcp"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/member"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/newcmd"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/notices"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/open"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/org"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/paywall"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/perk"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/person"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/product"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/project"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/provider"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/publish"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/push"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/registry"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/sandbox"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/settings"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/status"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/testcmd"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/types"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/webhook"
)

// group is one titled set of commands in the root help.
type group struct {
	id       string
	title    string
	commands []*cobra.Command
}

// NewRoot creates `voidhash` with every command, ready for [cli.App.Execute].
func NewRoot(app *cli.App) *cobra.Command {
	root := &cobra.Command{
		Use:   cli.BinaryName,
		Short: "Manage your Voidhash projects from the terminal.",
		Long: `Manage your Voidhash projects from the terminal. On a terminal, 'voidhash' alone opens a screen that sets your app up and shows its project; 'voidhash status' prints the same in a few lines.

Environment, for CI and scripts:
  VOIDHASH_API_KEY  A project secret key or a person's token; used instead of the stored sign-in
  VOIDHASH_API_URL  The API server, instead of the configured api_url
  VOIDHASH_PROFILE  The config profile, when --profile is not passed
  NO_COLOR          Print without colors`,
		Example: `voidhash login
voidhash link acme/app
voidhash product list --json`,
	}

	groups := []group{
		{"start", "Get started", []*cobra.Command{
			initcmd.New(app), integrate.New(app), auth.NewLogin(app), auth.NewLogout(app), auth.NewWhoami(app),
		}},
		{"project", "Choose a project", []*cobra.Command{
			status.New(app), link.NewLink(app), link.NewUnlink(app), link.NewSwitch(app), open.New(app),
		}},
		{"persons", "Persons and access", []*cobra.Command{person.New(app)}},
		{"catalog", "Catalog", []*cobra.Command{product.New(app), perk.New(app)}},
		{"payments", "Payments", []*cobra.Command{provider.New(app)}},
		{"paywalls", "Paywalls", []*cobra.Command{paywall.New(app), location.New(app)}},
		{"flags", "Flags and experiments", []*cobra.Command{flag.New(app), experiment.New(app)}},
		{"analytics", "Analytics and ads", []*cobra.Command{
			events.New(app), insights.New(app), analytics.New(app), ads.New(app),
		}},
		{"backend", "Your backend", []*cobra.Command{webhook.New(app)}},
		{"messaging", "Messaging", []*cobra.Command{push.New(app)}},
		{"team", "Team and settings", []*cobra.Command{
			org.New(app), project.New(app), member.New(app), settings.New(app), domain.New(app),
			sandbox.New(app), key.New(app), audit.New(app), notices.New(app), feedback.New(app),
		}},
		{"components", "Paywall components", []*cobra.Command{
			dev.New(app), newcmd.New(app), publish.New(app), testcmd.New(app), registry.New(app),
		}},
		{"more", "More", []*cobra.Command{
			types.New(app), mcp.New(app), api.New(app), auth.New(app), config.New(app),
		}},
	}
	for _, group := range groups {
		root.AddGroup(&cobra.Group{ID: group.id, Title: group.title})
		for _, command := range group.commands {
			command.GroupID = group.id
			root.AddCommand(command)
		}
	}
	root.SetHelpCommandGroupID("more")
	root.SetCompletionCommandGroupID("more")

	app.Prepare(root)

	// On a terminal, `voidhash` alone opens the screen that sets an app up
	// and shows its project. Off one, when VOIDHASH_NO_TUI is set, and
	// where the screen's program is not installed, it prints the help, as
	// do --help and `voidhash help`.
	help := root.RunE
	root.RunE = func(cmd *cobra.Command, args []string) error {
		if cmd.Flags().Changed("completions") || !app.IsInteractive() || app.Getenv("VOIDHASH_NO_TUI") != "" {
			return help(cmd, args)
		}
		err := home.Run(cmd.Context(), app, root)
		switch {
		case errors.Is(err, home.ErrNoScreen):
			return help(cmd, args)
		case err != nil && cmd.Context().Err() == nil:
			return cli.Failf("Could not show the screen: %v.", err).WithHint("Run 'voidhash --help' for the commands.")
		}
		return cmd.Context().Err()
	}
	return root
}
