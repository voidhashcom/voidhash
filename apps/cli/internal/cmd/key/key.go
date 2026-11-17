// Package key holds `voidhash key`: the project's API keys.
package key

import (
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

const managedInDashboard = "Keys are created, rotated and deleted by a person in the dashboard: 'voidhash open keys'."

// New creates `voidhash key`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "key",
		Aliases: []string{"keys"},
		Short:   "See the project's API keys.",
		Long:    "See the project's API keys. " + managedInDashboard,
	}
	cmd.AddCommand(newList(app))
	return cmd
}

// Every permission a secret key may hold. A key with all of them has full
// access; the API lists them one by one.
var keyPermissions = []string{
	"project:read", "project:update", "project:delete", "project:keys:read",
	"project:products:read", "project:products:write",
	"project:persons:read", "project:persons:write", "project:persons:delete",
	"project:entitlements:read", "project:entitlements:write", "project:schema:read",
	"project:flags:read", "project:flags:write",
	"project:experiments:read", "project:experiments:write",
	"project:paywalls:read", "project:paywalls:write", "project:paywalls:publish",
	"project:analytics:read", "project:analytics:write",
	"project:events:read", "project:events:write",
	"project:notifications:read", "project:notifications:write", "project:notifications:send",
	"project:webhooks:read", "project:webhooks:write",
	"project:development:read", "project:development:write",
	"project:providers:read", "project:providers:write",
	"project:ads:read", "project:ads:manage", "project:purchases:write", "project:audit:read",
	"project:files:read", "project:files:write",
	"project:automations:read", "project:automations:write", "project:automations:publish",
}

// keyValue is the key as people tell it apart: a publishable key in full, a
// secret key by its ends.
func keyValue(key api.ApiKeyJsonEncoding) string {
	if key.Type == "publishable" && key.RawKey != nil {
		return *key.RawKey
	}
	return key.Prefix + "…" + key.End
}

// keyAccess is what a key may do: "full" for a secret key holding every
// permission a key may be given (older keys store no scopes for it), else
// its scopes.
func keyAccess(key api.ApiKeyJsonEncoding) string {
	if key.Type == "publishable" {
		return "SDK in apps"
	}
	if key.Scopes == nil {
		return "full"
	}
	scopes := *key.Scopes
	for _, permission := range keyPermissions {
		if !slices.Contains(scopes, permission) {
			return strings.Join(scopes, ", ")
		}
	}
	return "full"
}

// newList creates `voidhash key list [--environment production|test]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the project's API keys.",
		Long: `List the project's API keys: the publishable keys apps ship with, in full, and secret keys by their ends.

A production key reads production purchases. A test key, such as a staging build's or server's, reads store sandbox and test purchases and records what it reports as test. Debug builds simulate purchases only with the test publishable key.`,
		Example: `voidhash key list
voidhash key list --environment test --json`,
	}
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "test"}, "",
		"Only the keys of production, or of test (a staging server's)")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		params := &api.ApiKeysListParams{}
		if *environment != "" {
			params.Environment = (*api.IntegrationEnvironment)(environment)
		}
		keys, err := cli.ListAll[api.ApiKeyJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			params.Cursor, params.Limit = page.Cursor, page.Limit
			return c.ApiKeysList(ctx, target.Project.Id, params)
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(keys)
		case cli.Quiet:
			app.PrintIDs(keys)
			return nil
		}
		orDash := func(value *string, format func(string) string) string {
			if value == nil {
				return "-"
			}
			return format(*value)
		}
		cli.PrintTable(app, []cli.Column[api.ApiKeyJsonEncoding]{
			{Header: "NAME", Cell: func(key api.ApiKeyJsonEncoding) string { return key.Name }},
			{Header: "TYPE", Cell: func(key api.ApiKeyJsonEncoding) string { return string(key.Type) }},
			{Header: "ENVIRONMENT", Cell: func(key api.ApiKeyJsonEncoding) string { return string(key.Environment) }},
			{Header: "KEY", Cell: keyValue},
			{Header: "ACCESS", Cell: keyAccess},
			{Header: "EXPIRES", Cell: func(key api.ApiKeyJsonEncoding) string { return orDash(key.ExpiresAt, app.FormatDate) }},
			{Header: "LAST USED", Cell: func(key api.ApiKeyJsonEncoding) string { return orDash(key.LastUsedAt, app.FormatTimeAgo) }},
			{Header: "ID", Cell: func(key api.ApiKeyJsonEncoding) string { return key.Id }},
		}, keys.Items, "The project has no keys.")
		app.Notef("%s", managedInDashboard)
		return nil
	}
	return cmd
}
