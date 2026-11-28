// Package ads holds `voidhash ads`: the ad accounts a project reads, their
// campaigns and reports, what needs attention, and what Voidhash tells the
// ad platform back.
package ads

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash ads`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "ads",
		Aliases: []string{"ad"},
		Short:   "Paid acquisition: ad accounts, campaigns, reports and what needs attention.",
		Long:    "Paid acquisition: connect ad accounts, see campaigns and reports, and find what needs attention. Voidhash reads ads; it never changes them.",
	}
	cmd.AddCommand(newAccounts(app), newConnect(app), newDisconnect(app), newCampaigns(app), newReport(app), newIssues(app), newSettings(app), newMeasurement(app))
	return cmd
}

// account is the part of a connected ad account the commands read.
type account struct {
	ID                  string  `json:"id"`
	ExternalID          string  `json:"externalId"`
	Name                string  `json:"name"`
	Currency            string  `json:"currency"`
	Timezone            string  `json:"timezone"`
	BackfillDays        int     `json:"backfillDays"`
	SyncStatus          string  `json:"syncStatus"`
	LastSyncSucceededAt *string `json:"lastSyncSucceededAt"`
	LastSyncError       *string `json:"lastSyncError"`
}

var accountKind = cli.ItemKind[account]{
	Noun:          "ad account",
	ID:            func(item account) string { return item.ID },
	Label:         func(item account) string { return item.Name + " (act_" + item.ExternalID + ")" },
	ListCommand:   "voidhash ads accounts",
	CreateCommand: "voidhash ads connect",
	Keys:          func(item account) []string { return []string{item.ExternalID, "act_" + item.ExternalID} },
	Names:         func(item account) []string { return []string{item.Name} },
}

func listAccounts(ctx context.Context, app *cli.App, projectID string) (cli.List[account], error) {
	return cli.ListAll[account](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.AdAccountsList(ctx, projectID, &api.AdAccountsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

var syncLabels = map[string]string{
	"pending": "first sync running",
	"ok":      "ok",
	"error":   "failing, retrying",
	"stopped": "stopped",
}

func syncLabel(item account) string {
	if label, ok := syncLabels[item.SyncStatus]; ok {
		return label
	}
	return item.SyncStatus
}

// orDash is the text value points at, or "-" for none.
func orDash(value *string) string {
	if value == nil {
		return "-"
	}
	return *value
}

// newAccounts creates `voidhash ads accounts`.
func newAccounts(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "accounts",
		Short:   "List the connected ad accounts and how their syncs are doing.",
		Example: `voidhash ads accounts`,
	}
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
		accounts, err := listAccounts(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(accounts)
		case cli.Quiet:
			app.PrintIDs(accounts)
			return nil
		}
		cli.PrintTable(app, []cli.Column[account]{
			{Header: "NAME", Cell: func(item account) string { return item.Name }},
			{Header: "ACCOUNT", Cell: func(item account) string { return "act_" + item.ExternalID }},
			{Header: "CURRENCY", Cell: func(item account) string { return item.Currency }},
			{Header: "TIME ZONE", Cell: func(item account) string { return item.Timezone }},
			{Header: "SYNC", Cell: syncLabel},
			{Header: "LAST SYNCED", Cell: func(item account) string {
				if item.LastSyncSucceededAt == nil {
					return "-"
				}
				return app.FormatTimeAgo(*item.LastSyncSucceededAt)
			}},
			{Header: "ID", Cell: func(item account) string { return item.ID }},
		}, accounts.Items, "No ad accounts connected. Connect a Meta ad account with 'voidhash ads connect'.")
		for _, item := range accounts.Items {
			if item.SyncStatus != "error" && item.SyncStatus != "stopped" {
				continue
			}
			problem := "the last sync failed"
			if item.LastSyncError != nil {
				problem = *item.LastSyncError
			}
			again := ""
			if item.SyncStatus == "stopped" {
				again = fmt.Sprintf(" Connect it again with 'voidhash ads connect %s'.", item.ExternalID)
			}
			app.Warnf("%s", cli.Printable(fmt.Sprintf("%s: %s.%s", accountKind.Label(item), strings.TrimSuffix(problem, "."), again)))
		}
		return nil
	}
	return cmd
}

const connectUsage = "voidhash ads connect <account> --token-stdin < token.txt"

// availableAccount is an ad account the access token can read.
type availableAccount struct {
	ExternalID  string `json:"externalId"`
	Name        string `json:"name"`
	Currency    string `json:"currency"`
	Status      string `json:"status"`
	IsSuggested bool   `json:"isSuggested"`
	IsConnected bool   `json:"isConnected"`
}

func (a availableAccount) label() string {
	status := ""
	switch a.Status {
	case "inactive":
		status = ", inactive"
	case "no_spend":
		status = ", no spend"
	}
	return fmt.Sprintf("%s (act_%s, %s%s)", a.Name, a.ExternalID, a.Currency, status)
}

// newConnect creates `voidhash ads connect [account]`.
func newConnect(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "connect",
		Short: "Connect a Meta ad account with a system user token.",
		Long: `Connect a Meta ad account with a system user access token that grants ads_read. The token is asked for without showing it, or piped in with --token-stdin; it is never passed as a flag's value.

Without an account, you choose from the accounts the token reads. The first sync starts right away and reads --backfill-days of history.`,
		Example: `voidhash ads connect
voidhash ads connect act_1234567890
voidhash ads connect 1234567890 --token-stdin --backfill-days 365 < token.txt`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "account", Help: "The Meta ad account id, with or without act_ (default: choose from the token's accounts)", Optional: true})
	project := cli.AddProjectFlag(cmd)
	tokenStdin := cmd.Flags().Bool("token-stdin", false, "Read the access token from standard input instead of asking for it")
	backfillDays := cmd.Flags().Int("backfill-days", 0, "History the first sync reads, in `days` (default: 90, at most 1095)")
	output := cli.AddOutputFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if cli.Changed(cmd, "backfill-days") && (*backfillDays < 1 || *backfillDays > 1095) {
			return cli.Usagef("--backfill-days must be from 1 to 1095.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		token, err := readSecret(ctx, app, *tokenStdin, secretPrompt{
			What:      "access token",
			Message:   "Meta system user access token (with ads_read)",
			PipeUsage: connectUsage,
		})
		if err != nil {
			return err
		}
		rejected := map[string]string{
			"ad_account_rejected": "Check that the token is a system user token with ads_read, and that its user has access to the account.",
		}
		externalID := strings.TrimPrefix(strings.TrimSpace(cli.ArgAt(args, 0)), "act_")
		if externalID == "" {
			available, err := cli.Fetch[struct {
				Token struct {
					HasRequiredPermission bool `json:"hasRequiredPermission"`
				} `json:"token"`
				Accounts []availableAccount `json:"accounts"`
			}](ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.AdAccountsQueryAvailableWithBody(ctx, projectID, reports.ContentType, reports.Body{"platform": "meta", "accessToken": token}.Reader())
			})
			if err != nil {
				return cli.APIError(err, rejected)
			}
			if !available.Value.Token.HasRequiredPermission {
				return cli.Failf("This token does not grant ads_read, so it reads no ad accounts.").
					WithHint("Create a system user token with ads_read in Meta Business Settings.")
			}
			choices := slices.DeleteFunc(slices.Clone(available.Value.Accounts), func(item availableAccount) bool { return item.IsConnected })
			if len(choices) == 0 {
				return cli.Failf("Every ad account this token can read is connected already.").WithHint("'voidhash ads accounts' lists them.")
			}
			labels := make([]string, len(choices))
			for index, choice := range choices {
				labels[index] = cli.Printable(choice.label())
			}
			if !app.IsInteractive() {
				return cli.Usagef("Which ad account? The token reads:\n  %s", strings.Join(labels, "\n  ")).WithHint("Run it as: " + connectUsage)
			}
			for index, choice := range choices {
				if choice.IsSuggested {
					labels[index] += " (suggested)"
				}
			}
			picked, err := app.Prompter().Select(ctx, "Which ad account?", labels)
			if err != nil {
				return err
			}
			externalID = choices[picked].ExternalID
		}
		body := reports.Body{"platform": "meta", "externalId": externalID, "accessToken": token}
		if cli.Changed(cmd, "backfill-days") {
			body["backfillDays"] = *backfillDays
		}
		connected, err := cli.Fetch[account](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdAccountsCreateWithBody(ctx, projectID, reports.ContentType, body.Reader())
		})
		if err != nil {
			return cli.APIError(err, rejected)
		}
		return app.PrintItem(mode, connected, fmt.Sprintf("Connected %s to %s; its first sync of %d days has started.\nCheck on it with 'voidhash ads accounts'.",
			accountKind.Label(connected.Value), target.Label(), connected.Value.BackfillDays))
	}
	return cmd
}

// newDisconnect creates `voidhash ads disconnect [account]`.
func newDisconnect(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "disconnect",
		Short: "Disconnect an ad account and delete what was synced from it.",
		Long:  "Disconnect an ad account and delete what was synced from it: its campaigns, ads and spend leave the ads reports. Asks first; --yes skips that.",
		Example: `voidhash ads disconnect "Acme EU"
voidhash ads disconnect act_1234567890 --yes`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "account", Help: "The ad account's name, act_ id or id", Optional: true})
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
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
		accounts, err := listAccounts(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, accountKind, accounts.Items, cli.ArgAt(args, 0), "voidhash ads disconnect <account> --yes")
		if err != nil {
			return err
		}
		label := accountKind.Label(found)
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Disconnect %s from %s? Its synced campaigns, ads and spend are deleted; ads reports lose them.", label, target.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdAccountsDelete(ctx, target.Project.Id, found.ID)
		}); err != nil {
			return err
		}
		index := slices.IndexFunc(accounts.Items, func(item account) bool { return item.ID == found.ID })
		return app.PrintItem(mode, accounts.Object(index), fmt.Sprintf("Disconnected %s. Connect it again with 'voidhash ads connect %s'.", label, found.ExternalID))
	}
	return cmd
}
