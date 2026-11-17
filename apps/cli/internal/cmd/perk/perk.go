// Package perk holds `voidhash perk`: the access an app checks for, which
// products grant.
package perk

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// New creates `voidhash perk`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "perk",
		Aliases: []string{"perks"},
		Short:   "The perks your app checks for, which products grant.",
		Long:    "The perks your app checks for, which products grant: list, create, edit and delete them. 'voidhash product perks set' chooses the perks a product grants.",
	}
	cmd.AddCommand(newList(app), newCreate(app), newEdit(app), newDelete(app))
	return cmd
}

var perkArg = cli.Arg{Name: "perk", Help: "The perk's slug, name or id", Optional: true}

func slugTakenHint(slug string) string {
	return fmt.Sprintf("Choose another --slug; 'voidhash perk list' shows the perk %s belongs to.", slug)
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the project's perks and the products that grant each.",
		Example: "voidhash perk list\nvoidhash perk list --json",
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
		projectID := target.Project.Id
		perks, err := catalog.ListPerks(ctx, app, projectID)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(perks)
		case cli.Quiet:
			app.PrintIDs(perks)
			return nil
		}

		// Which products grant each perk, for people only: one listing per product.
		grantedBy := map[string][]string{}
		if len(perks.Items) > 0 {
			products, err := catalog.ListProducts(ctx, app, projectID)
			if err != nil {
				return err
			}
			granted, err := cli.Each(ctx, products.Items, 8, func(ctx context.Context, product api.ProductJsonEncoding) (cli.List[api.PerkJsonEncoding], error) {
				return catalog.ListProductPerks(ctx, app, projectID, product.Id)
			})
			if err != nil {
				return err
			}
			for index, product := range products.Items {
				for _, perk := range granted[index].Items {
					grantedBy[perk.Id] = append(grantedBy[perk.Id], product.Slug)
				}
			}
		}
		cli.PrintTable(app, []cli.Column[api.PerkJsonEncoding]{
			{Header: "NAME", Cell: func(perk api.PerkJsonEncoding) string { return perk.Name }},
			{Header: "SLUG", Cell: func(perk api.PerkJsonEncoding) string { return perk.Slug }},
			{Header: "GRANTED BY", Cell: func(perk api.PerkJsonEncoding) string {
				if len(grantedBy[perk.Id]) == 0 {
					return "-"
				}
				return strings.Join(grantedBy[perk.Id], ", ")
			}},
			{Header: "ID", Cell: func(perk api.PerkJsonEncoding) string { return perk.Id }},
		}, perks.Items, "No perks yet. Create one with 'voidhash perk create'.")
		return nil
	}
	return cmd
}

const createUsage = "voidhash perk create --name <name> [--product <product>]..."

func newCreate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a perk, the access your app checks for.",
		Long:  "Create a perk, the access your app checks for, and optionally the products that grant it. Asks for what is missing in a terminal.",
		Example: `voidhash perk create --name Premium
voidhash perk create --name "Offline mode" --product pro-annual --product lifetime`,
	}
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "What people see, such as Premium")
	slug := cmd.Flags().String("slug", "", "How your code checks for it, such as premium (default: made from the name)")
	productInputs := cli.AddStringsFlag(cmd, "product", "", "A product that grants it: its slug, name or id; repeat for each")
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
		projectID := target.Project.Id
		perkName, err := app.RequireText(ctx, *name, cli.TextPrompt{What: "--name", Message: "Name, as people see it", Usage: createUsage})
		if err != nil {
			return err
		}
		perkSlug := *slug
		if perkSlug == "" {
			perkSlug = catalog.SlugFrom(perkName)
			if app.IsInteractive() {
				perkSlug, err = app.RequireText(ctx, "", cli.TextPrompt{
					What: "--slug", Message: "Slug, as your code checks for it", Usage: createUsage, Initial: perkSlug,
				})
				if err != nil {
					return err
				}
			}
		}
		// Find the products first, so a typo creates nothing.
		var granting []api.ProductJsonEncoding
		if len(*productInputs) > 0 {
			all, err := catalog.ListProducts(ctx, app, projectID)
			if err != nil {
				return err
			}
			for _, input := range *productInputs {
				product, err := cli.FindItem(catalog.ProductKind, all.Items, input)
				if err != nil {
					return err
				}
				granting = append(granting, product)
			}
		}

		created, err := cli.Fetch[api.PerkJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PerksCreate(ctx, projectID, api.CreatePerkBodyJsonEncoding{Name: perkName, Slug: perkSlug})
		})
		if err != nil {
			return cli.APIError(err, map[string]string{"perk_slug_taken": slugTakenHint(perkSlug)})
		}
		for _, product := range granting {
			if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ProductsAddPerk(ctx, projectID, product.Id, created.Value.Id)
			}); err != nil {
				return err
			}
		}
		first := "Created " + catalog.PerkKind.Label(created.Value)
		if len(granting) > 0 {
			slugs := make([]string, len(granting))
			for index, product := range granting {
				slugs[index] = product.Slug
			}
			first += ", granted by " + strings.Join(slugs, ", ")
		}
		lines := []string{first + ".", "Next:"}
		if len(granting) == 0 {
			lines = append(lines, fmt.Sprintf("  Choose the products that grant it: 'voidhash product perks set <product> %s'", created.Value.Slug))
		}
		lines = append(lines, fmt.Sprintf("  Check for %s in your app after 'voidhash types generate'.", created.Value.Slug))
		return app.PrintItem(mode, created, strings.Join(lines, "\n"))
	}
	return cmd
}

func newEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Rename a perk or change the slug your app checks for.",
		Long:  "Rename a perk or change the slug your app checks for. Without --name or --slug it asks for both in a terminal.",
		Example: `voidhash perk edit premium --name "Premium access"
voidhash perk edit legacy --slug classic`,
	}
	cli.SetArgs(cmd, perkArg)
	project := cli.AddProjectFlag(cmd)
	name := cmd.Flags().String("name", "", "Its new name")
	slug := cmd.Flags().String("slug", "", "Its new slug")
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
		projectID := target.Project.Id
		perks, err := catalog.ListPerks(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := catalog.Require(ctx, app, catalog.PerkKind, perks, cli.ArgAt(args, 0), "voidhash perk edit <perk> --name <name>")
		if err != nil {
			return err
		}
		askedName, askedSlug := *name, *slug
		if askedName == "" && askedSlug == "" {
			if !app.IsInteractive() {
				return cli.Usagef("Nothing to change.").WithHint("Pass --name or --slug.")
			}
			if askedName, err = app.RequireText(ctx, "", cli.TextPrompt{Message: "Name", Initial: found.Value.Name}); err != nil {
				return err
			}
			if askedSlug, err = app.RequireText(ctx, "", cli.TextPrompt{Message: "Slug", Initial: found.Value.Slug}); err != nil {
				return err
			}
		}
		body := map[string]any{}
		if askedName != "" && askedName != found.Value.Name {
			body["name"] = askedName
		}
		changesSlug := false
		if askedSlug != "" && askedSlug != found.Value.Slug {
			body["slug"], changesSlug = askedSlug, true
		}
		if len(body) == 0 {
			return app.PrintItem(mode, found, "Nothing changed.")
		}
		updated, err := cli.Fetch[api.PerkJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PerksUpdateWithBody(ctx, projectID, found.Value.Id, catalog.JSON, catalog.Body(body))
		})
		if err != nil {
			taken := found.Value.Slug
			if changesSlug {
				taken = askedSlug
			}
			return cli.APIError(err, map[string]string{"perk_slug_taken": slugTakenHint(taken)})
		}
		human := fmt.Sprintf("Updated %s.", catalog.PerkKind.Label(updated.Value))
		if changesSlug {
			human += fmt.Sprintf("\nApps that check for %s must check for %s now; run 'voidhash types generate' in your app.", found.Value.Slug, updated.Value.Slug)
		}
		return app.PrintItem(mode, updated, human)
	}
	return cmd
}

func newDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a perk, which everyone who has it loses.",
		Long:    "Delete a perk: every product stops granting it and everyone loses it. Asks first; --yes skips that.",
		Example: "voidhash perk delete legacy --yes",
	}
	cli.SetArgs(cmd, perkArg)
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
		projectID := target.Project.Id
		perks, err := catalog.ListPerks(ctx, app, projectID)
		if err != nil {
			return err
		}
		found, err := catalog.Require(ctx, app, catalog.PerkKind, perks, cli.ArgAt(args, 0), "voidhash perk delete <perk> --yes")
		if err != nil {
			return err
		}
		label := catalog.PerkKind.Label(found.Value)
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete %s from %s? Every product stops granting it, and everyone who has it loses it.", label, target.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PerksDelete(ctx, projectID, found.Value.Id)
		}); err != nil {
			return err
		}
		return app.PrintItem(mode, found, "Deleted "+label+".")
	}
	return cmd
}
