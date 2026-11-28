package person

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// grant is access to a perk given to a person by hand.
type grant = api.PersonGrantJsonEncoding

// newGrant creates `voidhash person grant <person> <perk> [--days <n> | --until <date>] [--note <text>]`.
func newGrant(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "grant",
		Short: "Give a person a perk without a purchase.",
		Long: `Give a person a perk without a purchase: for a support case, a tester or compensation. They can use it at once, alongside anything they bought, and it never counts as revenue.

It lasts --days days or --until a date, and for life when neither is given; 'voidhash person revoke' takes it back. It is granted in production, for apps using production keys, or with --test for apps using test keys.`,
		Example: `voidhash person grant ada@example.com premium --days 30 --note "Ticket 4821"
voidhash person grant user-42 beta --until 2026-12-31 --test
voidhash person grant person_123 premium --json`,
	}
	cli.SetArgs(cmd, personArg, cli.Arg{Name: "perk", Help: "The perk's slug (what your app checks), name or id", Optional: true})
	days := cmd.Flags().Int("days", 0, "How many `days` from now it lasts")
	until := cmd.Flags().String("until", "", "The last `date` it lasts, as YYYY-MM-DD (it ends at the end of that day, UTC)")
	note := cmd.Flags().String("note", "", "Why it is granted, for your team, such as a ticket number; no personal data")
	inTest := cmd.Flags().Bool("test", false, "Grant it in test, for apps using test keys, instead of production")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		if *days < 0 {
			return cli.Usagef("--days takes a whole number of days, 1 or more.")
		}
		if *days > 0 && *until != "" {
			return cli.Usagef("Pass --days or --until, not both; neither grants it for life.")
		}
		var expiresAt *string
		switch {
		case *days > 0:
			end := app.Now().UTC().Add(time.Duration(*days) * 24 * time.Hour).Format(time.RFC3339)
			expiresAt = &end
		case *until != "":
			day, err := time.Parse(time.DateOnly, *until)
			if err != nil {
				return cli.Usagef("--until takes a date as YYYY-MM-DD, such as 2026-12-31.")
			}
			end := day.Add(24*time.Hour - time.Millisecond).Format(time.RFC3339Nano)
			expiresAt = &end
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		const usage = "voidhash person grant <person> <perk> [--days <n>]"
		found, err := paywalls.RequirePerson(ctx, app, projectID, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		perks, err := cli.ListAll[perk](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.PerksList(ctx, projectID, &api.PerksListParams{Cursor: page.Cursor, Limit: page.Limit})
		})
		if err != nil {
			return err
		}
		perkInput, err := app.RequireText(ctx, cli.ArgAt(args, 1), cli.TextPrompt{What: "the perk", Message: "Which perk (its slug)?", Usage: usage})
		if err != nil {
			return err
		}
		wanted, err := cli.FindItem(perkKind, perks.Items, perkInput)
		if err != nil {
			return err
		}
		body := map[string]any{"perkId": wanted.Id, "expiresAt": expiresAt}
		if *note != "" {
			body["note"] = *note
		}
		granted, err := cli.Fetch[grant](ctx, app, func(c *api.Client) (*http.Response, error) {
			environment := "production"
			if *inTest {
				environment = "test"
			}
			return c.PersonsCreateGrantWithBody(ctx, projectID, found.Value.Id, nil, paywalls.JSONContentType, paywalls.JSONBody(body),
				func(_ context.Context, request *http.Request) error {
					request.Header.Set("x-environment", environment)
					return nil
				})
		})
		if err != nil {
			return err
		}
		lasts := "for life"
		if granted.Value.ExpiresAt != nil {
			lasts = "until " + app.FormatDate(*granted.Value.ExpiresAt)
		}
		return app.PrintItem(mode, granted, fmt.Sprintf("Granted %s to %s %s (%s). 'voidhash person revoke %s %s' takes it back.",
			perkKind.Label(wanted), paywalls.PersonKind.Label(found.Value), lasts, granted.Value.Id, found.Value.Id, granted.Value.Id))
	}
	return cmd
}

// newRevoke creates `voidhash person revoke <person> <grant>`.
func newRevoke(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "revoke",
		Short: "Take back a perk a person was granted by hand.",
		Long:  `Take back a perk a person was granted by hand, by the grant's id (grant_...), which 'voidhash person view' shows beside access granted by hand. Their access ends at once unless something they bought also gives the perk; purchases are not touched.`,
		Example: `voidhash person revoke ada@example.com grant_123
voidhash person revoke person_123 grant_123 --json`,
	}
	cli.SetArgs(cmd, personArg, cli.Arg{Name: "grant", Help: "The grant's id, grant_...", Optional: true})
	project := cli.AddProjectFlag(cmd)
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
		const usage = "voidhash person revoke <person> <grant>"
		found, err := paywalls.RequirePerson(ctx, app, target.Project.Id, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		grantID, err := app.RequireText(ctx, cli.ArgAt(args, 1), cli.TextPrompt{What: "the grant", Message: "Which grant (grant_...)?", Usage: usage})
		if err != nil {
			return err
		}
		revoked, err := cli.Fetch[grant](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsRevokeGrant(ctx, target.Project.Id, found.Value.Id, grantID)
		})
		if err != nil {
			return err
		}
		perkName := revoked.Value.PerkId
		if revoked.Value.PerkSlug != nil {
			perkName = *revoked.Value.PerkSlug
		}
		return app.PrintItem(mode, revoked, fmt.Sprintf("Revoked %s (%s) of %s; access from anything they bought stays.",
			revoked.Value.Id, perkName, paywalls.PersonKind.Label(found.Value)))
	}
	return cmd
}
