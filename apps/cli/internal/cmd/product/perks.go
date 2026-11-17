package product

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

const perksSetUsage = "voidhash product perks set <product> <perk>..."

// choosePerks asks which of perks a product should grant: the ones it
// grants now are marked, and Enter keeps them.
func choosePerks(ctx context.Context, app *cli.App, product api.ProductJsonEncoding, perks []api.PerkJsonEncoding, isCurrent func(api.PerkJsonEncoding) bool) ([]api.PerkJsonEncoding, error) {
	labels := make([]string, len(perks))
	var current []int
	for index, perk := range perks {
		labels[index] = catalog.PerkKind.Label(perk)
		if isCurrent(perk) {
			current = append(current, index)
		}
	}
	indexes, err := cli.ChooseSeveral(ctx, app, fmt.Sprintf("Which perks should %s grant?", product.Name), labels, prompt.MultiSelectOptions{
		Selected:  current,
		AllowNone: true,
		Prompt:    "Numbers or slugs, separated by commas",
		Named: func(answer string) ([]int, bool) {
			named := cli.ItemsNamedBy(catalog.PerkKind, perks, answer)
			if len(named) != 1 {
				return nil, false
			}
			return []int{slices.IndexFunc(perks, func(perk api.PerkJsonEncoding) bool { return perk.Id == named[0].Id })}, true
		},
	})
	chosen := make([]api.PerkJsonEncoding, len(indexes))
	for position, index := range indexes {
		chosen[position] = perks[index]
	}
	return chosen, err
}

func newPerksSet(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "set",
		Short: "Make a product grant exactly these perks.",
		Long: `Make a product grant exactly these perks, adding and removing what differs. Without perks it asks in a terminal; --none grants none.

Removing a perk asks first, since people who bought the product lose it; --yes skips that. Running it again finishes a change that failed halfway.`,
		Example: `voidhash product perks set pro-monthly premium ad-free
voidhash product perks set pro-monthly premium --dry-run
voidhash product perks set lifetime --none --yes`,
	}
	cli.SetArgs(cmd, productArg, cli.Arg{
		Name: "perk", Help: "Every perk the product should grant: its slug, name or id", Optional: true, Variadic: true,
	})
	none := cmd.Flags().Bool("none", false, "Grant no perks at all")
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	dryRun := cli.AddDryRunFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		var named []string
		if len(args) > 1 {
			named = args[1:]
		}
		if *none && len(named) > 0 {
			return cli.Usagef("--none grants no perks, so it takes none.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		products, err := catalog.ListProducts(ctx, app, projectID)
		if err != nil {
			return err
		}
		allPerks, err := catalog.ListPerks(ctx, app, projectID)
		if err != nil {
			return err
		}
		product, err := cli.RequireItem(ctx, app, catalog.ProductKind, products.Items, cli.ArgAt(args, 0), perksSetUsage)
		if err != nil {
			return err
		}
		current, err := catalog.ListProductPerks(ctx, app, projectID, product.Id)
		if err != nil {
			return err
		}
		isCurrent := func(perk api.PerkJsonEncoding) bool {
			for _, granted := range current.Items {
				if granted.Id == perk.Id {
					return true
				}
			}
			return false
		}

		var picked []api.PerkJsonEncoding
		switch {
		case *none:
		case len(named) > 0:
			for _, input := range named {
				perk, err := cli.FindItem(catalog.PerkKind, allPerks.Items, input)
				if err != nil {
					return err
				}
				picked = append(picked, perk)
			}
		case !app.IsInteractive():
			return cli.MissingInput("the perks", perksSetUsage+", or --none to grant none")
		case len(allPerks.Items) == 0:
			return &cli.UserError{
				Message:  "There are no perks yet.",
				Hint:     "Create one with 'voidhash perk create'.",
				ExitCode: cli.ExitNotFound,
			}
		default:
			if picked, err = choosePerks(ctx, app, product, allPerks.Items, isCurrent); err != nil {
				return err
			}
		}
		// The perks wanted, each once, as the server sent them.
		wanted := cli.List[api.PerkJsonEncoding]{}
		isWanted := func(perk api.PerkJsonEncoding) bool {
			for _, other := range wanted.Items {
				if other.Id == perk.Id {
					return true
				}
			}
			return false
		}
		for _, perk := range picked {
			if !isWanted(perk) {
				found, _ := catalog.Find(catalog.PerkKind, allPerks, perk.Id)
				wanted = catalog.Append(wanted, found)
			}
		}
		toAdd := wanted.Filter(func(perk api.PerkJsonEncoding) bool { return !isCurrent(perk) })
		toRemove := current.Filter(func(perk api.PerkJsonEncoding) bool { return !isWanted(perk) })
		var changes []string
		for _, perk := range toAdd.Items {
			changes = append(changes, "  + "+catalog.PerkKind.Label(perk))
		}
		for _, perk := range toRemove.Items {
			changes = append(changes, "  - "+catalog.PerkKind.Label(perk))
		}
		printPerks := func(perks cli.List[api.PerkJsonEncoding], human string) error {
			switch mode {
			case cli.JSON:
				return app.PrintJSON(perks)
			case cli.Quiet:
				app.PrintIDs(perks)
			default:
				app.Println(cli.PrintableLines(human))
			}
			return nil
		}

		if len(changes) == 0 {
			return printPerks(current, fmt.Sprintf("%s already grants %s.", product.Name, slugs(current.Items)))
		}
		if *dryRun {
			if mode == cli.JSON {
				return app.PrintJSON(catalog.RawObject(
					catalog.RawField{Name: "add", Value: toAdd.RawJSON()},
					catalog.RawField{Name: "remove", Value: toRemove.RawJSON()},
				))
			}
			app.Println(cli.PrintableLines(strings.Join(append(append(
				[]string{fmt.Sprintf("%s would grant %s:", product.Name, slugs(wanted.Items))},
				changes...), "Nothing changed (--dry-run)."), "\n")))
			return nil
		}
		if len(toRemove.Items) > 0 {
			lost := "those perks unless something else grants them"
			if len(toRemove.Items) == 1 {
				lost = "that perk unless something else grants it"
			}
			if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("%s will stop granting %s, and people who bought it lose %s. Continue?",
				product.Name, slugs(toRemove.Items), lost)); err != nil {
				return err
			}
		}
		for _, perk := range toAdd.Items {
			if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ProductsAddPerk(ctx, projectID, product.Id, perk.Id)
			}); err != nil {
				return err
			}
		}
		for _, perk := range toRemove.Items {
			err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
				return c.ProductsRemovePerk(ctx, projectID, product.Id, perk.Id)
			})
			// Someone removed it meanwhile: it is as asked.
			if err != nil && cli.APIErrorCode(err) != "perk_not_granted" {
				return err
			}
		}
		return printPerks(wanted, strings.Join(append(
			[]string{fmt.Sprintf("%s now grants %s:", product.Name, slugs(wanted.Items))}, changes...), "\n"))
	}
	return cmd
}
