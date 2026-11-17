// Package member holds `voidhash member`: the people of an organization.
package member

import (
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

type member = api.OrganizationMemberJsonEncoding

// New creates `voidhash member`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "member",
		Aliases: []string{"members"},
		Short:   "Your organization's team: list members, add people, change roles, remove people.",
	}
	cmd.AddCommand(newList(app), newInvite(app), newRole(app), newRemove(app))
	return cmd
}

var memberKind = cli.ItemKind[member]{
	Noun:          "member",
	ID:            func(m member) string { return m.Id },
	Label:         func(m member) string { return m.Name + " <" + m.Email + ">" },
	ListCommand:   "voidhash member list",
	CreateCommand: "voidhash member invite",
	Keys:          func(m member) []string { return []string{m.Email, m.UserId} },
	Names:         func(m member) []string { return []string{m.Name} },
}

var memberArg = cli.Arg{Name: "member", Help: "The member's email, name or id", Optional: true}

// ownerHint is why the API refuses to change the owner or the last
// administrator, and what to do instead.
const ownerHint = "The owner cannot be demoted or removed, and neither can the last admin; make someone else an admin in the Voidhash dashboard first."

// adminRefused is the refusal of a command asked to make someone an
// administrator: the API lets only the person, signed in to the dashboard or
// the mobile app, do that, never the CLI acting for them.
func adminRefused() error {
	return cli.Usagef("The CLI cannot make someone an admin.").
		WithHint("Make them an admin in the Voidhash dashboard, where you are signed in as yourself.")
}

func listMembers(cmd *cobra.Command, app *cli.App, organizationID string) (cli.List[member], error) {
	ctx := cmd.Context()
	return cli.ListAll[member](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.OrganizationMembersList(ctx, organizationID, &api.OrganizationMembersListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// asRole reads "a member", "an admin", "the owner".
func asRole(role api.OrganizationMemberRole) string {
	switch role {
	case "owner":
		return "the owner"
	case "admin":
		return "an admin"
	default:
		return "a " + string(role)
	}
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List an organization's members and their roles.",
		Example: "voidhash member list\nvoidhash member list --org acme --json",
	}
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
		members, err := listMembers(cmd, app, organization.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(members)
		case cli.Quiet:
			app.PrintIDs(members)
			return nil
		}
		session, err := app.Session(ctx)
		if err != nil {
			return err
		}
		cli.PrintTable(app, []cli.Column[member]{
			{Header: "NAME", Cell: func(m member) string {
				if session.Person.Id != "" && m.UserId == session.Person.Id {
					return m.Name + " (you)"
				}
				return m.Name
			}},
			{Header: "EMAIL", Cell: func(m member) string { return m.Email }},
			{Header: "ROLE", Cell: func(m member) string { return string(m.Role) }},
			{Header: "JOINED", Cell: func(m member) string { return app.FormatTimeAgo(m.CreatedAt) }},
			{Header: "ID", Cell: func(m member) string { return m.Id }},
		}, members.Items, cli.OrganizationKind.Label(organization)+" has no members you can see.")
		return nil
	}
	return cmd
}

func newInvite(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "invite",
		Short: "Add someone with a Voidhash account to the organization as a member.",
		Long: `Add someone with a Voidhash account to the organization as a member. They can use its projects at once. Adding a member again keeps their role.

Someone without an account is invited by email from the dashboard, and making someone an admin is done there too.`,
		Example: "voidhash member invite sam@example.com\nvoidhash member invite sam@example.com --org acme",
	}
	cli.SetArgs(cmd, cli.Arg{Name: "email", Help: "The email of their Voidhash account", Optional: true})
	role := cli.AddChoiceFlag(cmd, "role", "", []string{"admin", "member"}, "member",
		"Their role: member (the default). Making someone an admin is done in the Voidhash dashboard")
	org := cli.AddOrgFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		if *role == "admin" {
			return adminRefused()
		}
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		email, err := app.RequireText(ctx, cli.ArgAt(args, 0), cli.TextPrompt{
			What: "the email", Message: "Email of their Voidhash account", Usage: "voidhash member invite <email>",
		})
		if err != nil {
			return err
		}
		added, err := cli.Fetch[member](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.OrganizationMembersCreate(ctx, organization.Id, api.InviteOrganizationMemberBodyJsonEncoding{Email: email})
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invitee_has_no_account": fmt.Sprintf("Invite them by email from the dashboard, under Settings → Members. If they sign up with %s and verify it, this command can add them too.", cli.Printable(email)),
			})
		}
		return app.PrintItem(mode, added, fmt.Sprintf("%s is %s of %s and can use its projects now.",
			memberKind.Label(added.Value), asRole(added.Value.Role), cli.OrganizationKind.Label(organization)))
	}
	return cmd
}

func newRole(app *cli.App) *cobra.Command {
	const usage = "voidhash member role <member> member"
	cmd := &cobra.Command{
		Use:   "role",
		Short: "Make an admin a member.",
		Long:  "Make an admin a member, who uses the organization's projects but no longer manages its team or settings. Asks first; --yes skips that. Making someone an admin is done in the Voidhash dashboard.",
		Example: `voidhash member role ali@example.com member
voidhash member role ali@example.com member --yes`,
	}
	cli.SetArgs(cmd, memberArg, cli.Arg{
		Name:     "role",
		Help:     "member: makes an admin a member. (admin is refused: that is done in the Voidhash dashboard)",
		Optional: true,
	})
	org := cli.AddOrgFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		var passed *string
		switch role := cli.ArgAt(args, 1); role {
		case "":
		case "admin":
			return adminRefused()
		case "member":
			passed = &role
		default:
			return cli.Usagef("%q is not a role.", role).WithHint("Run it as: " + usage)
		}
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		members, err := listMembers(cmd, app, organization.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, memberKind, members.Items, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		name, where := memberKind.Label(found), cli.OrganizationKind.Label(organization)
		wanted, err := cli.RequireChoice(ctx, app, passed, cli.ChoicePrompt[string]{
			What:    "the role",
			Message: fmt.Sprintf("Role of %s (making someone an admin is done in the Voidhash dashboard)", name),
			Usage:   usage,
			Choices: []cli.Choice[string]{{Title: "member: uses its projects", Value: "member"}},
		})
		if err != nil {
			return err
		}
		if found.Role == "owner" {
			return cli.Failf("%s owns %s.", name, where).WithHint("The owner's role cannot change.")
		}
		current := members.Filter(func(m member) bool { return m.Id == found.Id }).Object(0)
		if string(found.Role) == wanted {
			return app.PrintItem(mode, current, fmt.Sprintf("%s is already %s of %s.", name, asRole(found.Role), where))
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Make %s a member of %s? They can no longer manage its team or settings.", name, where)); err != nil {
			return err
		}
		updated, err := cli.Fetch[member](ctx, app, func(c *api.Client) (*http.Response, error) {
			role := api.UpdateOrganizationMemberBodyJsonEncodingRole(wanted)
			return c.OrganizationMembersUpdate(ctx, organization.Id, found.Id, api.UpdateOrganizationMemberBodyJsonEncoding{Role: &role})
		})
		if err != nil {
			return cli.APIError(err, map[string]string{"permission_denied": ownerHint})
		}
		return app.PrintItem(mode, updated, fmt.Sprintf("%s is %s of %s now.", memberKind.Label(updated.Value), asRole(updated.Value.Role), where))
	}
	return cmd
}

func newRemove(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "remove",
		Short: "Remove someone from the organization.",
		Long:  "Remove someone from the organization; they lose access to its projects at once. Asks first; --yes skips that.",
		Example: `voidhash member remove max@example.com
voidhash member remove max@example.com --org acme --yes`,
	}
	cli.SetArgs(cmd, memberArg)
	org := cli.AddOrgFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		organization, err := app.ResolveOrganization(ctx, *org)
		if err != nil {
			return err
		}
		members, err := listMembers(cmd, app, organization.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, memberKind, members.Items, cli.ArgAt(args, 0), "voidhash member remove <member> --yes")
		if err != nil {
			return err
		}
		name, where := memberKind.Label(found), cli.OrganizationKind.Label(organization)
		if found.Role == "owner" {
			return cli.Failf("%s owns %s.", name, where).WithHint("The owner cannot be removed.")
		}
		session, err := app.Session(ctx)
		if err != nil {
			return err
		}
		reach := "its project"
		if count := len(session.ProjectsIn(organization.Id)); count != 1 {
			reach = fmt.Sprintf("all %d of its projects", count)
		}
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Remove %s from %s? They lose access to %s at once.", name, where, reach)); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.OrganizationMembersDelete(ctx, organization.Id, found.Id)
		}); err != nil {
			return cli.APIError(err, map[string]string{"permission_denied": ownerHint})
		}
		removed := members.Filter(func(m member) bool { return m.Id == found.Id }).Object(0)
		return app.PrintItem(mode, removed, fmt.Sprintf("Removed %s from %s.", name, where))
	}
	return cmd
}
