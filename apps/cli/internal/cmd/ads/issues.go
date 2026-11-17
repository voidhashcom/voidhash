package ads

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// attention are the ways of delivering that need a person to look.
var attention = []string{"rejected", "account_issue", "not_delivering", "learning_limited"}

// newIssues creates `voidhash ads issues`.
func newIssues(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "issues",
		Short: "What needs attention in your ads.",
		Long:  "What needs attention: failing syncs, rejected or held campaigns, ad groups and ads, and active ads whose links lack the tracking parameters Voidhash ties people to them by.",
		Example: `voidhash ads issues
voidhash ads issues --json`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the accounts, objects and ads that need attention as JSON, for scripts")
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		accounts, err := listAccounts(ctx, app, projectID)
		if err != nil {
			return err
		}
		syncs := accounts.Filter(func(item account) bool { return item.SyncStatus != "ok" })
		var lines []string
		for _, item := range syncs.Items {
			line := fmt.Sprintf("%s: sync %s", accountKind.Label(item), syncLabel(item))
			if item.LastSyncError != nil {
				line += " (" + *item.LastSyncError + ")"
			}
			if item.SyncStatus == "stopped" {
				line += fmt.Sprintf(". Connect it again: 'voidhash ads connect %s'", item.ExternalID)
			}
			lines = append(lines, line)
		}
		held := []json.RawMessage{}
		type heldObjects struct {
			campaigns cli.List[campaign]
			adGroups  cli.List[adGroup]
			ads       cli.List[ad]
		}
		byStatus, err := cli.Each(ctx, attention, 2, func(ctx context.Context, status string) (found heldObjects, err error) {
			filter := objectFilter{deliveryStatus: status}
			if found.campaigns, err = listCampaigns(ctx, app, projectID, filter); err != nil {
				return found, err
			}
			if found.adGroups, err = listAdGroups(ctx, app, projectID, filter); err != nil {
				return found, err
			}
			found.ads, err = listAds(ctx, app, projectID, filter)
			return found, err
		})
		if err != nil {
			return err
		}
		for _, found := range byStatus {
			campaigns, adGroups, ads := found.campaigns, found.adGroups, found.ads
			for index, item := range campaigns.Items {
				held = append(held, campaigns.Raw[index])
				lines = append(lines, fmt.Sprintf("Campaign %s (%s): %s", item.Name, item.ID, item.delivery))
			}
			for index, item := range adGroups.Items {
				held = append(held, adGroups.Raw[index])
				lines = append(lines, fmt.Sprintf("Ad group %s (%s): %s", item.Name, item.ID, item.delivery))
			}
			for index, item := range ads.Items {
				held = append(held, ads.Raw[index])
				lines = append(lines, fmt.Sprintf("Ad %s (%s): %s", item.Name, item.ID, item.delivery))
			}
		}
		active, err := listAds(ctx, app, projectID, objectFilter{status: "on"})
		if err != nil {
			return err
		}
		untracked := active.Filter(func(item ad) bool { return len(item.MissingTrackingParameters) > 0 })
		for _, item := range untracked.Items {
			lines = append(lines, fmt.Sprintf("Ad %s (%s): links lack %s, so Voidhash cannot tie the people it brings to it",
				item.Name, item.ID, strings.Join(item.MissingTrackingParameters, ", ")))
		}
		if *asJSON {
			// The objects as the server sent them; an empty list, never null.
			return app.PrintJSON(struct {
				Accounts        []json.RawMessage `json:"accounts"`
				Delivery        []json.RawMessage `json:"delivery"`
				MissingTracking []json.RawMessage `json:"missingTracking"`
			}{append([]json.RawMessage{}, syncs.Raw...), held, append([]json.RawMessage{}, untracked.Raw...)})
		}
		switch len(lines) {
		case 0:
			if len(accounts.Items) == 0 {
				app.Println("No ad accounts connected. Connect one with 'voidhash ads connect'.")
			} else {
				app.Println("Nothing needs attention: syncs are fine, nothing is rejected or held, and active ads carry the tracking parameters.")
			}
			return nil
		case 1:
			app.Println("1 thing needs attention:")
		default:
			app.Println(fmt.Sprintf("%d things need attention:", len(lines)))
		}
		for _, line := range lines {
			app.Println("  " + cli.Printable(line))
		}
		return nil
	}
	return cmd
}

type adSettings struct {
	WebToAppLandingPrefixes []string `json:"webToAppLandingPrefixes"`
}

// newSettings creates `voidhash ads settings`.
func newSettings(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "settings",
		Short: "The project's ads settings.",
		Long:  "The project's ads settings: the landing pages that mark website ads as web-to-app, which send people on to your app.",
	}
	cmd.AddCommand(newSettingsView(app), newSettingsWebToApp(app))
	return cmd
}

func newSettingsView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "view",
		Short:   "Show the landing pages that mark website ads as web-to-app.",
		Example: `voidhash ads settings view`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the API object as JSON, for scripts")
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		settings, err := cli.Fetch[adSettings](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdsGetSettings(ctx, target.Project.Id)
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(settings)
		}
		prefixes := "none"
		if len(settings.Value.WebToAppLandingPrefixes) > 0 {
			prefixes = strings.Join(settings.Value.WebToAppLandingPrefixes, "\n")
		}
		app.Println(cli.FormatFields([]cli.Field{{Label: "Web-to-app landing pages", Value: prefixes}}))
		app.Notef("Website ads landing under these count as web-to-app. Change them with 'voidhash ads settings web-to-app <prefix>...'.")
		return nil
	}
	return cmd
}

func newSettingsWebToApp(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "web-to-app",
		Short: "Set which landing pages mark website ads as web-to-app.",
		Long:  "Set exactly which landing pages mark website ads as web-to-app (sending people on to your app). The prefixes replace the list; --clear empties it. Synced ads change right away.",
		Example: `voidhash ads settings web-to-app example.app/start
voidhash ads settings web-to-app example.app/start example.app/get
voidhash ads settings web-to-app --clear`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "prefix", Help: "Landing page prefixes, such as example.app/start; they replace the list", Optional: true, Variadic: true})
	clear := cmd.Flags().Bool("clear", false, "Remove every prefix")
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the API object as JSON, for scripts")
	cmd.RunE = func(cmd *cobra.Command, prefixes []string) error {
		ctx := cmd.Context()
		const usage = "Run it as: voidhash ads settings web-to-app example.app/start [more...], or --clear."
		switch {
		case *clear && len(prefixes) > 0:
			return cli.Usagef("--clear takes no prefixes.").WithHint(usage)
		case !*clear && len(prefixes) == 0:
			return cli.Usagef("Missing the prefixes.").WithHint(usage)
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		// An empty list, not null, clears them.
		body := reports.Body{"webToAppLandingPrefixes": append([]string{}, prefixes...)}
		settings, err := cli.Fetch[adSettings](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdsUpdateSettingsWithBody(ctx, target.Project.Id, reports.ContentType, body.Reader())
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invalid_landing_prefix": "Pass a host with an optional path, such as example.app/start.",
			})
		}
		if *asJSON {
			return app.PrintJSON(settings)
		}
		if len(settings.Value.WebToAppLandingPrefixes) == 0 {
			app.Println("No landing pages mark ads as web-to-app now.")
			return nil
		}
		app.Println(cli.Printable(fmt.Sprintf("Website ads landing under %s now count as web-to-app; synced ads changed right away.",
			strings.Join(settings.Value.WebToAppLandingPrefixes, ", "))))
		return nil
	}
	return cmd
}
