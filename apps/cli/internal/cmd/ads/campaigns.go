package ads

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// delivery is how a campaign, ad group or ad delivers, with the platform's
// reasons when it does not.
type delivery struct {
	DeliveryStatus  string `json:"deliveryStatus"`
	DeliveryReasons []struct {
		Message string `json:"message"`
	} `json:"deliveryReasons"`
}

// deliveryStatuses are the ways an ad object delivers, as --delivery spells
// them and as people read them. The API spells them with underscores.
var deliveryStatuses = []struct{ flag, label string }{
	{"delivering", "delivering"},
	{"learning", "learning"},
	{"learning-limited", "learning limited"},
	{"not-delivering", "not delivering"},
	{"in-review", "in review"},
	{"rejected", "rejected"},
	{"paused", "paused"},
	{"off-by-parent", "off (parent off)"},
	{"scheduled", "scheduled"},
	{"ended", "ended"},
	{"account-issue", "account issue"},
}

// underscored is a dashed flag value as the API spells it.
func underscored(value string) string { return strings.ReplaceAll(value, "-", "_") }

func deliveryLabel(status string) string {
	for _, known := range deliveryStatuses {
		if underscored(known.flag) == status {
			return known.label
		}
	}
	return strings.ReplaceAll(status, "_", " ")
}

// String is the delivery with its first reason: "rejected: Ad copy violates policy".
func (d delivery) String() string {
	label := deliveryLabel(d.DeliveryStatus)
	if len(d.DeliveryReasons) > 0 {
		label += ": " + d.DeliveryReasons[0].Message
	}
	return label
}

type budget struct {
	Amount   float64 `json:"amount"`
	Currency string  `json:"currency"`
	Period   string  `json:"period"`
}

func budgetOf(b *budget) string {
	if b == nil {
		return "-"
	}
	return reports.FormatMoney(b.Amount, b.Currency) + " " + b.Period
}

type campaign struct {
	delivery
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Objective   *string `json:"objective"`
	Destination *string `json:"destination"`
	Budget      *budget `json:"budget"`
	PlatformURL string  `json:"platformUrl"`
}

type adGroup struct {
	delivery
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Budget   *budget `json:"budget"`
	Learning *struct {
		Events       float64 `json:"events"`
		EventsNeeded float64 `json:"eventsNeeded"`
	} `json:"learning"`
}

type ad struct {
	delivery
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	AdGroupID *string `json:"adGroupId"`
	// MissingTrackingParameters are the tracking parameters the ad's links
	// lack; empty when none, or for app store ads.
	MissingTrackingParameters []string `json:"missingTrackingParameters"`
}

var campaignKind = cli.ItemKind[campaign]{
	Noun:        "campaign",
	ID:          func(item campaign) string { return item.ID },
	Label:       func(item campaign) string { return item.Name + " (" + item.ID + ")" },
	ListCommand: "voidhash ads campaigns",
	Names:       func(item campaign) []string { return []string{item.Name} },
}

// objectFilter narrows a listing of campaigns, ad groups or ads; the three
// take the same filters.
type objectFilter struct {
	adAccountID, status, deliveryStatus, destination, search, campaignID string
}

func optional[T ~string](value string) *T {
	if value == "" {
		return nil
	}
	typed := T(value)
	return &typed
}

func listCampaigns(ctx context.Context, app *cli.App, projectID string, filter objectFilter) (cli.List[campaign], error) {
	return cli.ListAll[campaign](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.AdsListCampaigns(ctx, projectID, &api.AdsListCampaignsParams{
			Cursor: page.Cursor, Limit: page.Limit,
			AdAccountId:    optional[string](filter.adAccountID),
			Status:         optional[api.AdStatus](filter.status),
			DeliveryStatus: optional[api.AdDeliveryStatus](filter.deliveryStatus),
			Destination:    optional[api.AdDestination](filter.destination),
			Search:         optional[string](filter.search),
		})
	})
}

func listAdGroups(ctx context.Context, app *cli.App, projectID string, filter objectFilter) (cli.List[adGroup], error) {
	return cli.ListAll[adGroup](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.AdsListAdGroups(ctx, projectID, &api.AdsListAdGroupsParams{
			Cursor: page.Cursor, Limit: page.Limit,
			DeliveryStatus: optional[api.AdDeliveryStatus](filter.deliveryStatus),
			CampaignId:     optional[string](filter.campaignID),
		})
	})
}

func listAds(ctx context.Context, app *cli.App, projectID string, filter objectFilter) (cli.List[ad], error) {
	return cli.ListAll[ad](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.AdsListAds(ctx, projectID, &api.AdsListAdsParams{
			Cursor: page.Cursor, Limit: page.Limit,
			Status:         optional[api.AdStatus](filter.status),
			DeliveryStatus: optional[api.AdDeliveryStatus](filter.deliveryStatus),
			CampaignId:     optional[string](filter.campaignID),
		})
	})
}

// newCampaigns creates `voidhash ads campaigns [campaign]`.
func newCampaigns(app *cli.App) *cobra.Command {
	deliveries := make([]string, len(deliveryStatuses))
	for index, status := range deliveryStatuses {
		deliveries[index] = status.flag
	}
	cmd := &cobra.Command{
		Use:   "campaigns",
		Short: "List the campaigns synced from your ad accounts, or show one.",
		Long:  "List the campaigns synced from your ad accounts, or show one campaign with its ad groups and ads. Voidhash reads them from the ad platform; change them there.",
		Example: `voidhash ads campaigns
voidhash ads campaigns --delivery not-delivering
voidhash ads campaigns "Spring sale"
voidhash ads campaigns --account act_1234567890 --status on --json`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "campaign", Help: "A campaign's name or id: show its ad groups and ads", Optional: true})
	project := cli.AddProjectFlag(cmd)
	accountFlag := cmd.Flags().String("account", "", "Only this ad account's campaigns: its name, act_ id or id")
	status := cli.AddChoiceFlag(cmd, "status", "", []string{"on", "paused", "removed"}, "", "Only campaigns set to this status")
	deliveryFlag := cli.AddChoiceFlag(cmd, "delivery", "", deliveries, "", "Only campaigns that deliver like this")
	destination := cli.AddChoiceFlag(cmd, "destination", "", []string{"website", "app-store", "web-to-app", "mixed"}, "", "Only campaigns sending people here")
	search := cmd.Flags().String("search", "", "Only campaigns whose name contains this `text`")
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
		if named := cli.ArgAt(args, 0); named != "" {
			// Usually a name: the API narrows the listing to it. An id is not
			// in any name, so it is looked for among all of them.
			candidates, err := listCampaigns(ctx, app, projectID, objectFilter{search: named})
			if err != nil {
				return err
			}
			if len(cli.ItemsNamedBy(campaignKind, candidates.Items, named)) == 0 {
				if candidates, err = listCampaigns(ctx, app, projectID, objectFilter{}); err != nil {
					return err
				}
			}
			found, err := cli.FindItem(campaignKind, candidates.Items, named)
			if err != nil {
				return err
			}
			for index, item := range candidates.Items {
				if item.ID == found.ID {
					return printCampaignTree(ctx, app, target, found, candidates.Raw[index], mode)
				}
			}
		}
		filter := objectFilter{status: *status, deliveryStatus: underscored(*deliveryFlag), destination: underscored(*destination), search: *search}
		if *accountFlag != "" {
			accounts, err := listAccounts(ctx, app, projectID)
			if err != nil {
				return err
			}
			found, err := cli.FindItem(accountKind, accounts.Items, *accountFlag)
			if err != nil {
				return err
			}
			filter.adAccountID = found.ID
		}
		campaigns, err := listCampaigns(ctx, app, projectID, filter)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(campaigns)
		case cli.Quiet:
			app.PrintIDs(campaigns)
			return nil
		}
		cli.PrintTable(app, []cli.Column[campaign]{
			{Header: "NAME", Cell: func(item campaign) string { return item.Name }},
			{Header: "DELIVERY", Cell: func(item campaign) string { return deliveryLabel(item.DeliveryStatus) }},
			{Header: "OBJECTIVE", Cell: func(item campaign) string { return orDash(item.Objective) }},
			{Header: "DESTINATION", Cell: func(item campaign) string { return orDash(item.Destination) }},
			{Header: "BUDGET", Cell: func(item campaign) string { return budgetOf(item.Budget) }},
			{Header: "ID", Cell: func(item campaign) string { return item.ID }},
		}, campaigns.Items, "No campaigns match. Campaigns appear once a connected ad account has synced; 'voidhash ads accounts' shows the syncs.")
		return nil
	}
	return cmd
}

// printCampaignTree prints one campaign with its ad groups and ads. With
// --json it is the campaign's object with `adGroups` and `ads` added.
func printCampaignTree(ctx context.Context, app *cli.App, target *cli.ProjectContext, found campaign, raw json.RawMessage, mode cli.OutputMode) error {
	if mode == cli.Quiet {
		app.Println(found.ID)
		return nil
	}
	projectID := target.Project.Id
	adGroups, err := listAdGroups(ctx, app, projectID, objectFilter{campaignID: found.ID})
	if err != nil {
		return err
	}
	ads, err := listAds(ctx, app, projectID, objectFilter{campaignID: found.ID})
	if err != nil {
		return err
	}
	if mode == cli.JSON {
		// The campaign as the server sent it, with two fields after its own.
		object := bytes.TrimSuffix(bytes.TrimSpace(raw), []byte("}"))
		var out bytes.Buffer
		out.Write(object)
		out.WriteString(`,"adGroups":`)
		out.Write(adGroups.RawJSON())
		out.WriteString(`,"ads":`)
		out.Write(ads.RawJSON())
		out.WriteString("}")
		return app.PrintJSON(json.RawMessage(out.Bytes()))
	}
	adLine := func(item ad) string {
		line := fmt.Sprintf("      Ad %s (%s): %s", item.Name, item.ID, item.delivery)
		if len(item.MissingTrackingParameters) > 0 {
			line += "; links lack " + strings.Join(item.MissingTrackingParameters, ", ")
		}
		return cli.Printable(line)
	}
	fields := []cli.Field{
		{Label: "Delivery", Value: found.delivery.String()},
		{Label: "Objective", Value: orDash(found.Objective)},
		{Label: "Destination", Value: orDash(found.Destination)},
		{Label: "Budget", Value: budgetOf(found.Budget)},
		{Label: "Manage", Value: found.PlatformURL},
	}
	if settings, err := app.Config(); err == nil {
		if address, ok := cli.DashboardURL(settings.WebURL, target, "ads/campaigns/"+found.ID); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
	}
	lines := []string{cli.Printable(campaignKind.Label(found)), cli.FormatFields(fields), ""}
	if len(adGroups.Items) == 0 {
		lines = append(lines, "    No ad groups.")
	}
	for _, group := range adGroups.Items {
		line := fmt.Sprintf("    Ad group %s (%s): %s", group.Name, group.ID, group.delivery)
		if group.Budget != nil {
			line += ", budget " + budgetOf(group.Budget)
		}
		if group.Learning != nil {
			line += fmt.Sprintf(", learning %s/%s", reports.FormatCount(group.Learning.Events), reports.FormatCount(group.Learning.EventsNeeded))
		}
		lines = append(lines, cli.Printable(line))
		for _, item := range ads.Items {
			if item.AdGroupID != nil && *item.AdGroupID == group.ID {
				lines = append(lines, adLine(item))
			}
		}
	}
	for _, item := range ads.Items {
		if item.AdGroupID == nil {
			lines = append(lines, adLine(item))
		}
	}
	app.Println(strings.Join(lines, "\n"))
	return nil
}
