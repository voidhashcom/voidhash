// Package config holds `voidhash config`: the CLI's own settings.
package config

import (
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	settingsfile "github.com/voidhashcom/voidhash/apps/cli/internal/config"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
)

// New creates `voidhash config`, which shows the settings, with `set` and
// `reset`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Show the CLI settings: API and dashboard URLs, credential, default project and links.",
		Long: `Show the CLI settings: the API and dashboard URLs, the credential in use (masked), the default project and the linked directories.

Settings live in ~/.voidhash. With --profile (or VOIDHASH_PROFILE) a named profile's settings override the base ones, such as a staging server's URLs.`,
		Example: `voidhash config
voidhash config set api_url https://api.staging.example.com --profile staging
voidhash config reset --profile staging`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return show(cmd, app)
		},
	}
	cmd.AddCommand(newSet(app), newReset(app))
	return cmd
}

func show(cmd *cobra.Command, app *cli.App) error {
	ctx := cmd.Context()
	settings, err := app.Config()
	if err != nil {
		return err
	}
	style := app.Style()
	notSet := style.Dim("(not set)")
	if profile := app.ActiveProfile(); profile != "" {
		app.Printf("Active profile: %s\n", profile)
	}
	// Never the token itself: only enough of it to tell two apart.
	credential := notSet
	creds := app.Credentials(ctx)
	if found, err := creds.Resolve(ctx, settings.APIURL); err == nil && found != nil {
		credential = credentials.MaskToken(found.Token) + " (from " + credentials.DescribeSource(found.Source, creds.Store().FilePath()) + ")"
	}
	defaultProject := settings.DefaultProject
	if defaultProject == "" {
		defaultProject = notSet
	}
	app.Println(cli.FormatFields([]cli.Field{
		{Label: "credential", Value: credential},
		{Label: "api_url", Value: settings.APIURL},
		{Label: "web_url", Value: settings.WebURL},
		{Label: "default_project", Value: defaultProject},
	}))
	if len(settings.Links) > 0 {
		directories := make([]string, 0, len(settings.Links))
		for directory := range settings.Links {
			directories = append(directories, directory)
		}
		sort.Strings(directories)
		links := make([]cli.Field, len(directories))
		for index, directory := range directories {
			links[index] = cli.Field{Label: directory, Value: settings.Links[directory]}
		}
		app.Println("\nLinks:")
		app.Println(cli.FormatFields(links))
	}
	file, err := app.ConfigStore().ReadFile()
	if err == nil && len(file.Profiles) > 0 {
		app.Printf("\nProfiles: %s\n", strings.Join(file.ProfileNames(), ", "))
	}
	return nil
}

// The settings `config set` writes.
var keys = []string{"api_url", "web_url", "default_project"}

func newSet(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "set",
		Short: "Set a CLI setting: api_url, web_url or default_project.",
		Long: `Set a CLI setting: api_url (the API server), web_url (the dashboard) or default_project (a project id; 'voidhash switch' sets it by name).

With --profile the value is stored in that profile and overrides the base setting while the profile is active.`,
		Example: `voidhash config set api_url http://localhost:8787
voidhash config set web_url https://voidhash.localhost --profile local`,
		ValidArgsFunction: func(_ *cobra.Command, args []string, _ string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return keys, cobra.ShellCompDirectiveNoFileComp
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(_ *cobra.Command, args []string) error {
			key, value := args[0], args[1]
			changes := settingsfile.Changes{}
			switch key {
			case "api_key":
				return cli.Failf("Keys are not kept in the config.").
					WithHint("Sign in with 'voidhash login', or set VOIDHASH_API_KEY for scripts and CI.")
			case "api_url", "web_url":
				if _, ok := credentials.Origin(value); !ok {
					return cli.Usagef("%s must be an http or https URL, such as https://api.voidhash.com.", key)
				}
				if key == "api_url" {
					changes.APIURL = &value
				} else {
					changes.WebURL = &value
				}
			case "default_project":
				changes.DefaultProject = &value
			default:
				return cli.Usagef("There is no setting %q.", key).WithHint("Settings: " + strings.Join(keys, ", ") + ".")
			}
			if err := app.WriteConfig(changes); err != nil {
				return err
			}
			where := ""
			if profile := app.ActiveProfile(); profile != "" {
				where = " in the " + profile + " profile"
			}
			app.Printf("Set %s to %s%s.\n", key, cli.Printable(value), where)
			return nil
		},
	}
	cli.SetArgs(cmd,
		cli.Arg{Name: "key", Help: "The setting: api_url, web_url or default_project"},
		cli.Arg{Name: "value", Help: "Its new value"},
	)
	return cmd
}

func newReset(app *cli.App) *cobra.Command {
	return &cobra.Command{
		Use:   "reset",
		Short: "Return the API and dashboard URLs to their defaults.",
		Long: `Return api_url and web_url to their defaults. With --profile, clear that profile's settings instead, so it falls back to the base ones.

Stored sign-ins, the default project and links are kept; to sign out, use 'voidhash logout'.`,
		RunE: func(*cobra.Command, []string) error {
			if err := app.ConfigStore().Reset(); err != nil {
				return cli.Failf("Could not write the CLI config, ~/.voidhash: %v", err)
			}
			if profile := app.ActiveProfile(); profile != "" {
				app.Printf("Cleared the settings of the %s profile; it now uses the base settings.\n", profile)
				return nil
			}
			app.Printf("Reset api_url to %s and web_url to %s.\n", settingsfile.DefaultAPIURL, settingsfile.DefaultWebURL)
			return nil
		},
	}
}
