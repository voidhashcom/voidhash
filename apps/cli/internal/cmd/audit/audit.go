// Package audit holds `voidhash audit`: who changed what in a project.
package audit

import (
	"net/http"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

type entry = api.AuditLogEntryJsonEncoding

// New creates `voidhash audit [--type] [--entity] [--limit]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "audit",
		Short: "Show who changed what in the project, newest first.",
		Long:  "Show who changed what in the project, newest first. Needs permission to read the project's audit log.",
		Example: `voidhash audit
voidhash audit --type product --limit 100
voidhash audit --entity prod_123 --json`,
	}
	entityType := cmd.Flags().String("type", "", "Only changes to this kind of thing, such as product, paywall or api_key")
	entityID := cmd.Flags().String("entity", "", "Only changes to the thing with this `id`")
	limit := cmd.Flags().Int("limit", 30, "How many of the latest changes to show, at most 100")
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
		params := &api.AuditLogListParams{}
		count := min(max(*limit, 1), 100)
		params.Limit = &count
		if *entityType != "" {
			params.EntityType = entityType
		}
		if *entityID != "" {
			params.EntityId = entityID
		}
		entries, info, err := cli.FetchPage[entry](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AuditLogList(ctx, target.Project.Id, params)
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(entries)
		case cli.Quiet:
			app.PrintIDs(entries)
			return nil
		}

		// Names are for people only. A key, or a role that cannot list
		// members, sees ids instead, so a refusal here is not a failure.
		emails := map[string]string{}
		members, err := cli.ListAll[api.OrganizationMemberJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.OrganizationMembersList(ctx, target.Project.OrganizationId, &api.OrganizationMembersListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil && ctx.Err() != nil {
			return err
		}
		if err == nil {
			for _, member := range members.Items {
				emails[member.UserId] = member.Email
			}
		}
		actor := func(e entry) string {
			switch {
			case e.ActorType == "system":
				return "Voidhash"
			case e.ActorType == "api_key":
				return "a secret key"
			case e.ActorUserId == nil:
				return "someone"
			}
			if email, ok := emails[*e.ActorUserId]; ok {
				return email
			}
			return *e.ActorUserId
		}
		empty := "Nothing has been changed in this project yet."
		if *entityType != "" || *entityID != "" {
			empty = "No changes match."
		}
		cli.PrintTable(app, []cli.Column[entry]{
			{Header: "WHEN", Cell: func(e entry) string {
				if e.CreatedAt == nil {
					return "-"
				}
				return app.FormatTimeAgo(*e.CreatedAt)
			}},
			{Header: "WHO", Cell: actor},
			{Header: "ACTION", Cell: func(e entry) string { return e.Action }},
			{Header: "WHAT", Cell: func(e entry) string { return e.EntityType + " " + e.EntityId }},
		}, entries.Items, empty)
		if info.HasNextPage {
			app.Notef("There are older changes: raise --limit, or narrow with --type or --entity.")
		}
		return nil
	}
	return cmd
}
