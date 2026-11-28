package paywall

import (
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// newTemplate creates `voidhash paywall template`.
func newTemplate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "template",
		Short: "Templates a new paywall or onboarding flow can start from.",
		Long:  "Templates a new paywall or onboarding flow can start from: 'voidhash paywall create --template <template>' starts its design as one.",
	}
	cmd.AddCommand(newTemplateList(app))
	return cmd
}

// newTemplateList creates `voidhash paywall template list [--kind <kind>]`.
func newTemplateList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the templates, with the products each one sells.",
		Long:  "List the templates a new paywall or onboarding flow can start from, with what each holds and the slugs of the products it sells. A paywall made from one needs products with those slugs, or others chosen in the dashboard, before it can be deployed.",
		Example: `voidhash paywall template list
voidhash paywall template list --kind onboarding -q`,
	}
	kind := cli.AddChoiceFlag(cmd, "kind", "", []string{"paywall", "onboarding", "feedback", "reactivation", "custom"}, "", "Only the templates for flows of this purpose")
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
		templates, err := cli.ListAll[api.PaywallTemplateJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			params := &api.PaywallTemplatesListParams{Cursor: page.Cursor, Limit: page.Limit}
			if *kind != "" {
				purpose := api.PaywallTemplatesListParamsKind(*kind)
				params.Kind = &purpose
			}
			return c.PaywallTemplatesList(ctx, target.Project.Id, params)
		})
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(templates)
		case cli.Quiet:
			app.PrintIDs(templates)
			return nil
		}
		cli.PrintTable(app, []cli.Column[api.PaywallTemplateJsonEncoding]{
			{Header: "ID", Cell: func(t api.PaywallTemplateJsonEncoding) string { return t.Id }},
			{Header: "NAME", Cell: func(t api.PaywallTemplateJsonEncoding) string { return t.Name }},
			{Header: "KIND", Cell: func(t api.PaywallTemplateJsonEncoding) string { return string(t.Kind) }},
			{Header: "SELLS", Cell: func(t api.PaywallTemplateJsonEncoding) string {
				if len(t.ProductSlugs) == 0 {
					return "-"
				}
				return strings.Join(t.ProductSlugs, ", ")
			}},
			{Header: "DESCRIPTION", Cell: func(t api.PaywallTemplateJsonEncoding) string { return t.Description }},
		}, templates.Items, "No templates for that purpose. 'voidhash paywall create' starts a blank one.")
		return nil
	}
	return cmd
}
