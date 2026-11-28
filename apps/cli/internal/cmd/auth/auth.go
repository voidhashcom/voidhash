// Package auth holds the sign-in commands: `voidhash login`, `logout` and
// `whoami`, and the `voidhash auth` group that has them too.
package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash auth`; `login`, `logout` and `whoami` are also
// top-level commands.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Sign the CLI in and out, and see who it is signed in as.",
	}
	status := NewWhoami(app)
	status.Use = "status"
	status.Short = "Show who the CLI is signed in as (the same as 'whoami')."
	status.Long = ""
	status.Example = "voidhash auth status\nvoidhash auth status --json"
	cmd.AddCommand(NewLogin(app), NewLogout(app), status)
	return cmd
}

// NewLogin creates `voidhash login [--read-only] [--no-browser]`.
func NewLogin(app *cli.App) *cobra.Command {
	var readOnly, noBrowser bool
	cmd := &cobra.Command{
		Use:   "login",
		Short: "Sign in by approving a code in your browser.",
		Long: `Sign in by approving a code in your browser; the CLI then acts as you. Works over SSH and in containers: the code can be entered on any device.

The token is kept in the system keychain when there is one, for the configured API server only. In CI and scripts, set VOIDHASH_API_KEY instead of signing in.`,
		Example: `voidhash login
voidhash login --read-only
voidhash login --no-browser --profile staging`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return login(cmd.Context(), app, readOnly, noBrowser)
		},
	}
	cmd.Flags().BoolVar(&readOnly, "read-only", false, "Sign in read-only: commands can look but not change anything")
	cmd.Flags().BoolVar(&noBrowser, "no-browser", false, "Print the sign-in address and code without opening a browser")
	return cmd
}

// NewLogout creates `voidhash logout`.
func NewLogout(app *cli.App) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Short: "Sign out on this computer.",
		Long:  "Sign out on this computer, and end the CLI's session on the server when it can be reached.",
		RunE: func(cmd *cobra.Command, _ []string) error {
			return logout(cmd.Context(), app)
		},
	}
}

// NewWhoami creates `voidhash whoami [--json]`.
func NewWhoami(app *cli.App) *cobra.Command {
	var json *bool
	cmd := &cobra.Command{
		Use:     "whoami",
		Short:   "Show who the CLI is signed in as, and what it can use.",
		Long:    "Show who the CLI is signed in as, on which server and where the credential came from, and the organizations and projects it can use. Exits with 3 when no one is signed in.",
		Example: "voidhash whoami\nvoidhash whoami --json",
		RunE: func(cmd *cobra.Command, _ []string) error {
			return showSession(cmd.Context(), app, *json)
		},
	}
	json = cli.AddJSONFlag(cmd)
	return cmd
}

// How each kind of credential reads after "with".
var credentialKinds = map[api.CredentialKind]string{
	"cli_key":           "this computer's CLI key",
	"secret_key":        "a project secret key",
	"mcp_client":        "an MCP connection",
	"dashboard_session": "a dashboard session",
}

// showSession prints who the credential signs in as, on which server and
// where the credential came from, and what it can use; the session object
// with json.
func showSession(ctx context.Context, app *cli.App, json bool) error {
	session, err := app.Session(ctx)
	if err != nil {
		return err
	}
	if json {
		return app.PrintJSON(session)
	}
	settings, err := app.Config()
	if err != nil {
		return err
	}
	who := "a project secret key"
	if !session.IsKey() {
		kind, ok := credentialKinds[session.Kind]
		if !ok {
			kind = string(session.Kind)
		}
		who = fmt.Sprintf("%s <%s> with %s", cli.Printable(session.Person.Name), cli.Printable(session.Person.Email), kind)
	}
	app.Printf("Signed in as %s on %s.\n", who, settings.APIURL)
	creds := app.Credentials(ctx)
	if credential, err := creds.Resolve(ctx, settings.APIURL); err == nil && credential != nil {
		app.Printf("Credential for %s from %s.\n", credential.Origin, credentials.DescribeSource(credential.Source, creds.Store().FilePath()))
	}
	if session.IsReadOnly {
		app.Println("Read-only: the CLI can look but not change anything. Change it under Settings → Devices and apps in the dashboard.")
	}

	organizations := "none"
	if len(session.Organizations) > 0 {
		labels := make([]string, len(session.Organizations))
		for index, organization := range session.Organizations {
			labels[index] = cli.OrganizationKind.Label(organization)
		}
		organizations = strings.Join(labels, "\n")
	}
	projects := "none"
	if len(session.Projects) > 0 {
		kind := cli.ProjectKind(session)
		labels := make([]string, len(session.Projects))
		for index, project := range session.Projects {
			labels[index] = kind.Label(project)
		}
		projects = strings.Join(labels, "\n")
	}
	app.Println("")
	app.Println(cli.FormatFields([]cli.Field{{Label: "Organizations", Value: organizations}, {Label: "Projects", Value: projects}}))
	app.Notef("\n'voidhash status' shows the project commands act on here.")
	return nil
}
