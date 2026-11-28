// Package notices holds `voidhash notices`: what an organization sent the
// signed-in person, such as billing and security notices.
package notices

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

type notice = api.NoticeJsonEncoding

// New creates `voidhash notices`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "notices",
		Aliases: []string{"notice"},
		Short:   "Notices your organizations sent you: list them, mark them read, archive them, choose how they reach you.",
	}
	cmd.AddCommand(newList(app), newRead(app), newArchive(app, true), newArchive(app, false), newPreferences(app))
	return cmd
}

var noticeArg = cli.Arg{Name: "notice", Help: "A notice's id, as 'voidhash notices list' shows; repeat for each", Optional: true, Variadic: true}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the notices an organization sent you, newest first.",
		Long:    "List the notices an organization sent you, such as billing and security notices, newest first.",
		Example: "voidhash notices list\nvoidhash notices list --archived --org acme",
	}
	archived := cmd.Flags().Bool("archived", false, "List the archive instead of the inbox")
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
		isArchived := api.NoticesListParamsIsArchived(fmt.Sprint(*archived))
		notices, err := cli.ListAll[notice](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.NoticesList(ctx, organization.Id, &api.NoticesListParams{Cursor: page.Cursor, Limit: page.Limit, IsArchived: &isArchived})
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(notices)
		case cli.Quiet:
			app.PrintIDs(notices)
			return nil
		}
		empty := "No notices from " + cli.OrganizationKind.Label(organization) + "."
		if *archived {
			empty = "Nothing archived in " + cli.OrganizationKind.Label(organization) + "."
		}
		marked := false
		cli.PrintTable(app, []cli.Column[notice]{
			{Header: " ", Cell: func(n notice) string {
				switch {
				case n.IsUrgent && n.ResolvedAt == nil:
					marked = true
					return "!"
				case n.ReadAt == nil:
					marked = true
					return "•"
				}
				return " "
			}},
			{Header: "WHEN", Cell: func(n notice) string { return app.FormatTimeAgo(n.CreatedAt) }},
			{Header: "CATEGORY", Cell: func(n notice) string { return string(n.Category) }},
			{Header: "TITLE", Cell: func(n notice) string { return n.Title }},
			{Header: "ID", Cell: func(n notice) string { return n.Id }},
		}, notices.Items, empty)
		if marked {
			app.Notef("• unread, ! needs action. Mark them read with 'voidhash notices read --all'.")
		}
		return nil
	}
	return cmd
}

// printUnread prints what marking and archiving answer with: how many
// notices are still unread.
func printUnread(app *cli.App, asJSON bool, unread cli.Object[api.NoticeUnreadCountJsonEncoding], done string) error {
	if asJSON {
		return app.PrintJSON(unread)
	}
	app.Println(fmt.Sprintf("%s. %d unread left.", done, unread.Value.Count))
	return nil
}

func newRead(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "read",
		Short:   "Mark notices read, or the whole inbox with --all.",
		Example: "voidhash notices read notice_123 notice_456\nvoidhash notices read --all",
	}
	cli.SetArgs(cmd, noticeArg)
	all := cmd.Flags().Bool("all", false, "Mark the whole inbox read")
	org := cli.AddOrgFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		if *all == (len(args) > 0) {
			return cli.Usagef("Name the notices to mark read, or pass --all.").
				WithHint("Run it as: voidhash notices read <notice>... or voidhash notices read --all")
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		body := api.MarkNoticesReadBodyJsonEncoding{}
		if !*all {
			body.NoticeIds = &args
		}
		unread, err := cli.Fetch[api.NoticeUnreadCountJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.NoticesMarkRead(ctx, organization.Id, body)
		})
		if err != nil {
			return err
		}
		return printUnread(app, *asJSON, unread, "Marked read")
	}
	return cmd
}

func newArchive(app *cli.App, archiving bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "unarchive",
		Short:   "Bring archived notices back to the inbox.",
		Example: "voidhash notices unarchive notice_123",
	}
	verb, done := "bring back", "Moved back to the inbox"
	if archiving {
		cmd.Use, cmd.Short, cmd.Example = "archive", "Archive notices, which also marks them read.", "voidhash notices archive notice_123 notice_456"
		verb, done = "archive", "Archived"
	}
	name := cmd.Use
	cli.SetArgs(cmd, noticeArg)
	org := cli.AddOrgFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		if len(args) == 0 {
			return cli.Usagef("Name the notices to %s.", verb).
				WithHint(fmt.Sprintf("Run it as: voidhash notices %s <notice>...; 'voidhash notices list' shows their ids.", name))
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		body := api.NoticeSelectionBodyJsonEncoding{NoticeIds: args}
		unread, err := cli.Fetch[api.NoticeUnreadCountJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			if archiving {
				return c.NoticesArchive(ctx, organization.Id, body)
			}
			return c.NoticesUnarchive(ctx, organization.Id, body)
		})
		if err != nil {
			return err
		}
		return printUnread(app, *asJSON, unread, done)
	}
	return cmd
}

func onOff(value bool) string {
	if value {
		return "on"
	}
	return "off"
}

func newPreferences(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "preferences",
		Short: "Show or change how each category of notices reaches you, and their language.",
		Long:  "Show or change how each category of notices reaches you, and their language. Without flags it shows them. Billing, legal and security notices always reach you.",
		Example: `voidhash notices preferences
voidhash notices preferences --category product --email off
voidhash notices preferences --locale cs`,
	}
	categories := []string{"billing", "legal", "security", "account", "integrations", "product"}
	category := cli.AddChoiceFlag(cmd, "category", "", categories, "", "The category to change, with --inbox or --email")
	inbox := cli.AddChoiceFlag(cmd, "inbox", "", []string{"on", "off"}, "", "Whether its notices appear in your inbox")
	email := cli.AddChoiceFlag(cmd, "email", "", []string{"on", "off"}, "", "Whether its notices are emailed to you")
	locale := cli.AddChoiceFlag(cmd, "locale", "", []string{"en", "cs"}, "", "The language of your notices, in every organization")
	org := cli.AddOrgFlag(cmd)
	asJSON := cli.AddJSONFlag(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if (*inbox != "" || *email != "") != (*category != "") {
			return cli.Usagef("Pass --category with --inbox or --email.").
				WithHint("Run it as: voidhash notices preferences --category product --email off")
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		// Only what was passed is sent; what is left out keeps its setting.
		body := map[string]any{}
		if *locale != "" {
			body["locale"] = *locale
		}
		if *category != "" {
			change := map[string]any{"category": *category}
			if *inbox != "" {
				change["isInboxEnabled"] = *inbox == "on"
			}
			if *email != "" {
				change["isEmailEnabled"] = *email == "on"
			}
			body["categories"] = []any{change}
		}
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		preferences, err := cli.Fetch[api.NoticePreferencesJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			if len(body) == 0 {
				return c.NoticesGetPreferences(ctx, organization.Id)
			}
			return c.NoticesUpdatePreferencesWithBody(ctx, organization.Id, "application/json", bytes.NewReader(encoded))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"notice_category_mandatory": "Billing, legal and security notices always reach you; only the other categories can be turned off.",
			})
		}
		if *asJSON {
			return app.PrintJSON(preferences)
		}
		language := "English"
		if preferences.Value.Locale == "cs" {
			language = "Czech"
		}
		type preference = api.NoticeCategoryPreferenceJsonEncoding
		app.Println(cli.PrintableLines(fmt.Sprintf("How %s reaches you (notices in %s):", cli.OrganizationKind.Label(organization), language)))
		app.Println(cli.FormatTable([]cli.Column[preference]{
			{Header: "CATEGORY", Cell: func(p preference) string { return string(p.Category) }},
			{Header: "INBOX", Cell: func(p preference) string { return onOff(p.IsInboxEnabled) }},
			{Header: "EMAIL", Cell: func(p preference) string { return onOff(p.IsEmailEnabled) }},
			{Header: "", Cell: func(p preference) string {
				if p.IsMandatory {
					return "always on"
				}
				return ""
			}},
		}, preferences.Value.Categories, app.Style().Bold))
		return nil
	}
	return cmd
}
