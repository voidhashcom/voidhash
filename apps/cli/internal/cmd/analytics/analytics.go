// Package analytics holds `voidhash analytics`: who campaigns and other
// touches brought in, how their revenue grows, whether tracking works, the
// built-in charts, and alerts on events that look broken.
package analytics

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// New creates `voidhash analytics`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "analytics",
		Short: "Acquisition, cohorts, tracking health, charts and alerts.",
		Long:  "Who your campaigns and other touches brought in, how their revenue grows, whether tracking works, every built-in chart, and alerts on events that look broken.",
	}
	cmd.AddCommand(newAcquisition(app), newCohorts(app), newHealth(app), newCharts(app), newChart(app), newAlerts(app))
	return cmd
}

// reportFlags narrow an acquisition report, and say how it counts.
type reportFlags struct {
	network, campaign, adset, currency, timezone, environment *string
	attributionWindowDays                                     *int
}

func addReportFlags(cmd *cobra.Command) reportFlags {
	return reportFlags{
		network:               cmd.Flags().String("network", "", "Only people whose credited touch came from this network, such as meta"),
		campaign:              cmd.Flags().String("campaign", "", "Only people whose credited touch carried this campaign `id`"),
		adset:                 cmd.Flags().String("adset", "", "Only people whose credited touch carried this ad set `id`"),
		attributionWindowDays: cmd.Flags().Int("attribution-window-days", 0, "How long before a signup a campaign touch may be credited with it, in `days` from 1 to 90 (default: the project's setting)"),
		currency:              cmd.Flags().String("currency", "", "ISO 4217 `code` money is reported in (default: USD)"),
		timezone:              cmd.Flags().String("timezone", "", "IANA time `zone` days are cut in, such as Europe/Prague (default: UTC)"),
		environment: cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "sandbox", "test"}, "",
			"Purchases revenue is read from: production, sandbox (App Store and Google Play sandbox) or test (debug builds' simulated purchases and test modes such as Stripe's) (default: production)"),
	}
}

// check refuses values the API would, before any request.
func (f reportFlags) check(cmd *cobra.Command) error {
	if cli.Changed(cmd, "attribution-window-days") && (*f.attributionWindowDays < 1 || *f.attributionWindowDays > 90) {
		return cli.Usagef("--attribution-window-days must be from 1 to 90.")
	}
	return nil
}

// fill adds the flags that were passed to a report's request.
func (f reportFlags) fill(cmd *cobra.Command, body reports.Body) {
	body.Text("network", *f.network).Text("campaignId", *f.campaign).Text("adsetId", *f.adset).
		Text("currency", *f.currency).Text("timezone", *f.timezone).Text("environment", *f.environment)
	if cli.Changed(cmd, "attribution-window-days") {
		body["attributionWindowDays"] = *f.attributionWindowDays
	}
}

// firstOf is the first of names that is set, else fallback.
func firstOf(fallback string, names ...*string) string {
	for _, name := range names {
		if name != nil {
			return *name
		}
	}
	return fallback
}

// outcomes are what a group of acquired people went on to do.
type outcomes struct {
	Visits         float64 `json:"visits"`
	PeopleAcquired float64 `json:"peopleAcquired"`
	TrialStarters  float64 `json:"trialStarters"`
	PayingPeople   float64 `json:"payingPeople"`
	KeyConversions float64 `json:"keyConversions"`
	NetRevenue     float64 `json:"netRevenue"`
}

type acquisitionGroup struct {
	outcomes
	Network      *string `json:"network"`
	Surface      *string `json:"surface"`
	CampaignID   *string `json:"campaignId"`
	CampaignName *string `json:"campaignName"`
	AdsetID      *string `json:"adsetId"`
	AdsetName    *string `json:"adsetName"`
	AdID         *string `json:"adId"`
	AdName       *string `json:"adName"`
}

type acquisitionReport struct {
	Level                 string             `json:"level"`
	Currency              string             `json:"currency"`
	Timezone              string             `json:"timezone"`
	Environment           string             `json:"environment"`
	KeyConversion         string             `json:"keyConversion"`
	AttributionWindowDays int                `json:"attributionWindowDays"`
	From                  string             `json:"from"`
	To                    string             `json:"to"`
	Groups                []acquisitionGroup `json:"groups"`
	Unattributed          *outcomes          `json:"unattributed"`
	Totals                outcomes           `json:"totals"`
	Coverage              struct {
		TotalRevenue float64  `json:"totalRevenue"`
		Share        *float64 `json:"share"`
	} `json:"coverage"`
}

// newAcquisition creates `voidhash analytics acquisition`.
func newAcquisition(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "acquisition",
		Short: "Report the people each campaign or other touch brought in, and what they paid.",
		Long: `Report the people each network, campaign, ad set, ad or surface brought in, and what they went on to pay.

A person is credited to the touch that brought them within the attribution window before they signed up. The period is the last 30 complete days unless --last or --from says otherwise, with days cut in --timezone.`,
		Example: `voidhash analytics acquisition
voidhash analytics acquisition --by network --last 90d
voidhash analytics acquisition --by ad --campaign 120210000000000 --timezone Europe/Prague
voidhash analytics acquisition --from 2026-10-01 --to 2026-10-31 --json`,
	}
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "30d")
	by := cli.AddChoiceFlag(cmd, "by", "", []string{"network", "campaign", "adset", "ad", "surface"}, "campaign", "What people are grouped by (default: campaign)")
	filters := addReportFlags(cmd)
	ad := cmd.Flags().String("ad", "", "Only people whose credited touch carried this ad `id`")
	keyConversion := cli.AddChoiceFlag(cmd, "key-conversion", "", []string{"signup", "trial", "payer"}, "", "The conversion counted as KEY (default: the project's setting)")
	asJSON := cmd.Flags().Bool("json", false, "Print the API report as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if err := filters.check(cmd); err != nil {
			return err
		}
		period, err := periodFlags.Period(reports.TodayIn(app.Now(), *filters.timezone))
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		body := reports.Body{"from": period.From, "to": period.To, "level": *by}
		filters.fill(cmd, body)
		body.Text("adId", *ad).Text("keyConversion", *keyConversion)
		fetched, err := cli.Fetch[acquisitionReport](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsReportAcquisitionWithBody(ctx, target.Project.Id, reports.ContentType, body.Reader())
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(fetched)
		}
		report := fetched.Value
		money := func(amount float64) string { return reports.FormatMoney(amount, report.Currency) }
		app.Println(cli.Printable(fmt.Sprintf("People acquired %s (%s to %s, %s), by %s, %s revenue, %d-day attribution window:",
			period.Label, report.From, report.To, report.Timezone, report.Level, report.Environment, report.AttributionWindowDays)))
		app.Println("")
		cli.PrintTable(app, []cli.Column[acquisitionGroup]{
			{Header: strings.ToUpper(report.Level), Cell: func(group acquisitionGroup) string {
				return firstOf("(no network)", group.AdName, group.AdsetName, group.CampaignName, group.Surface, group.Network)
			}},
			{Header: "VISITS", Cell: func(group acquisitionGroup) string { return reports.FormatCount(group.Visits) }},
			{Header: "PEOPLE", Cell: func(group acquisitionGroup) string { return reports.FormatCount(group.PeopleAcquired) }},
			{Header: "TRIALS", Cell: func(group acquisitionGroup) string { return reports.FormatCount(group.TrialStarters) }},
			{Header: "PAYERS", Cell: func(group acquisitionGroup) string { return reports.FormatCount(group.PayingPeople) }},
			{Header: "KEY (" + report.KeyConversion + ")", Cell: func(group acquisitionGroup) string { return reports.FormatCount(group.KeyConversions) }},
			{Header: "NET REVENUE", Cell: func(group acquisitionGroup) string { return money(group.NetRevenue) }},
			{Header: "ID", Cell: func(group acquisitionGroup) string { return firstOf("-", group.AdID, group.AdsetID, group.CampaignID) }},
		}, report.Groups, "No signup was credited to a campaign touch in this period.")
		fields := []cli.Field{{Label: "Total", Value: fmt.Sprintf("%s people, %s payers, %s net revenue",
			reports.FormatCount(report.Totals.PeopleAcquired), reports.FormatCount(report.Totals.PayingPeople), money(report.Totals.NetRevenue))}}
		if report.Unattributed != nil {
			fields = append(fields, cli.Field{Label: "Unattributed", Value: fmt.Sprintf("%s people, %s net revenue",
				reports.FormatCount(report.Unattributed.PeopleAcquired), money(report.Unattributed.NetRevenue))})
		}
		fields = append(fields, cli.Field{Label: "Coverage", Value: fmt.Sprintf("%s of %s revenue came from people whose signup was credited to a touch",
			reports.FormatRate(report.Coverage.Share), money(report.Coverage.TotalRevenue))})
		app.Println("\n" + cli.FormatFields(fields))
		return nil
	}
	return cmd
}

// cohortDays are the days since the credited touch the cohorts table shows.
var cohortDays = []int{0, 7, 30, 90, 180, 365}

type cohort struct {
	Week   string  `json:"week"`
	People float64 `json:"people"`
	Cells  []struct {
		Day        int     `json:"day"`
		NetRevenue float64 `json:"netRevenue"`
		Maturity   string  `json:"maturity"`
	} `json:"cells"`
	Projections []struct {
		Day        int     `json:"day"`
		NetRevenue float64 `json:"netRevenue"`
		IsPartial  bool    `json:"isPartial"`
	} `json:"projections"`
}

// revenueBy is a cohort's cumulative net revenue by day: measured once the
// cohort completed it, otherwise projected ("~", "+" when partial) or
// measured so far ("*"), and "-" before it got there without a projection.
func (c cohort) revenueBy(day int, currency string) string {
	for _, projection := range c.Projections {
		if projection.Day == day {
			partial := ""
			if projection.IsPartial {
				partial = "+"
			}
			return "~" + reports.FormatMoney(projection.NetRevenue, currency) + partial
		}
	}
	for _, cell := range c.Cells {
		if cell.Day == day {
			maturing := ""
			if cell.Maturity == "maturing" {
				maturing = "*"
			}
			return reports.FormatMoney(cell.NetRevenue, currency) + maturing
		}
	}
	return "-"
}

type cohortsReport struct {
	GroupBy               string   `json:"groupBy"`
	Currency              string   `json:"currency"`
	Timezone              string   `json:"timezone"`
	AttributionWindowDays int      `json:"attributionWindowDays"`
	From                  string   `json:"from"`
	To                    string   `json:"to"`
	Total                 []cohort `json:"total"`
	Groups                []struct {
		Network      *string  `json:"network"`
		Surface      *string  `json:"surface"`
		CampaignName *string  `json:"campaignName"`
		AdsetName    *string  `json:"adsetName"`
		Cohorts      []cohort `json:"cohorts"`
	} `json:"groups"`
	// Projection is null when the project has too little history to project from.
	Projection *struct{} `json:"projection"`
}

// newCohorts creates `voidhash analytics cohorts`.
func newCohorts(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cohorts",
		Short: "Show how revenue from people acquired each week grows over time.",
		Long: `Show how revenue from people acquired each week grows by day 0, 7, 30, 90, 180 and 365 after the touch credited with their signup, projected for days the cohort has not reached.

A cell marked * is still maturing, ~ is projected from the project's renewal and trial history, and + is a projection that is likely low. --json has each group's cohorts and every projection's range.`,
		Example: `voidhash analytics cohorts
voidhash analytics cohorts --by campaign --last 26w
voidhash analytics cohorts --network meta --json`,
	}
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "13w")
	by := cli.AddChoiceFlag(cmd, "by", "", []string{"surface", "network", "campaign", "adset"}, "network", "What the groups are (default: network)")
	filters := addReportFlags(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the API report as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if err := filters.check(cmd); err != nil {
			return err
		}
		period, err := periodFlags.Period(reports.TodayIn(app.Now(), *filters.timezone))
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		body := reports.Body{"from": period.From, "to": period.To, "groupBy": *by}
		filters.fill(cmd, body)
		fetched, err := cli.Fetch[cohortsReport](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsReportAcquisitionCohortsWithBody(ctx, target.Project.Id, reports.ContentType, body.Reader())
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(fetched)
		}
		report := fetched.Value
		app.Println(cli.Printable(fmt.Sprintf("Weekly cohorts acquired %s (%s to %s, %s, %d-day attribution window): cumulative net revenue by day since the credited touch.",
			period.Label, report.From, report.To, report.Timezone, report.AttributionWindowDays)))
		app.Println("")
		columns := []cli.Column[cohort]{
			{Header: "WEEK", Cell: func(item cohort) string { return item.Week }},
			{Header: "PEOPLE", Cell: func(item cohort) string { return reports.FormatCount(item.People) }},
		}
		for _, day := range cohortDays {
			columns = append(columns, cli.Column[cohort]{
				Header: fmt.Sprintf("DAY %d", day),
				Cell:   func(item cohort) string { return item.revenueBy(day, report.Currency) },
			})
		}
		cli.PrintTable(app, columns, report.Total, "No signup was credited to a campaign touch in this period.")
		if len(report.Groups) > 0 {
			groups := make([]string, len(report.Groups))
			for index, group := range report.Groups {
				people := 0.0
				for _, item := range group.Cohorts {
					people += item.People
				}
				// A visitor chooses the campaign name a link they followed carries.
				name := cli.Printable(firstOf("(none)", group.CampaignName, group.AdsetName, group.Surface, group.Network))
				groups[index] = name + " " + reports.FormatCount(people) + " people"
			}
			app.Println(fmt.Sprintf("\nBy %s: %s. --json has each group's cohorts.", cli.Printable(report.GroupBy), strings.Join(groups, ", ")))
		}
		if len(report.Total) > 0 {
			app.Notef("* still maturing: some of the cohort's people are not that many days in yet.")
			if report.Projection != nil {
				app.Notef("~ projected from the project's renewal and trial history; --json has each 80%% range.")
				app.Notef("+ partial: some renewals cannot be projected yet, so likely low.")
			}
		}
		return nil
	}
	return cmd
}

type sdkVersion struct {
	SDK     *string `json:"sdk"`
	Version *string `json:"version"`
}

type trackingHealth struct {
	Start string `json:"start"`
	End   string `json:"end"`
	Web   struct {
		LastEventAt *string      `json:"lastEventAt"`
		SDKVersions []sdkVersion `json:"sdkVersions"`
		Hosts       []struct {
			Host      string  `json:"host"`
			Pageviews float64 `json:"pageviews"`
		} `json:"hosts"`
	} `json:"web"`
	Apps []struct {
		Platform    string       `json:"platform"`
		Events      float64      `json:"events"`
		LastEventAt string       `json:"lastEventAt"`
		SDKVersions []sdkVersion `json:"sdkVersions"`
	} `json:"apps"`
	Handoff struct {
		AppPeople      float64  `json:"appPeople"`
		WebFirstPeople float64  `json:"webFirstPeople"`
		Share          *float64 `json:"share"`
	} `json:"handoff"`
}

// sdksOf lists the SDK versions that reported, in parentheses.
func sdksOf(versions []sdkVersion) string {
	if len(versions) == 0 {
		return ""
	}
	seen := make([]string, len(versions))
	for index, version := range versions {
		seen[index] = firstOf("SDK", version.SDK) + " " + firstOf("?", version.Version)
	}
	return " (" + strings.Join(seen, ", ") + ")"
}

func day(iso string) string { return iso[:min(10, len(iso))] }

// newHealth creates `voidhash analytics health`.
func newHealth(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "health",
		Short:   "Check that web and app tracking report what measuring ads relies on.",
		Long:    "Check what measuring ads relies on, over the last 7 days: web page views by host, app SDKs and their versions, and how many app users came from the web.",
		Example: `voidhash analytics health`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the API report as JSON, for scripts")
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		fetched, err := cli.Fetch[trackingHealth](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsReportTrackingHealth(ctx, target.Project.Id)
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(fetched)
		}
		health := fetched.Value
		web := "no events"
		if health.Web.LastEventAt != nil {
			web = "last event " + app.FormatTimeAgo(*health.Web.LastEventAt) + sdksOf(health.Web.SDKVersions)
		}
		hosts := "none with page views"
		if len(health.Web.Hosts) > 0 {
			lines := make([]string, len(health.Web.Hosts))
			for index, host := range health.Web.Hosts {
				lines[index] = fmt.Sprintf("%s (%s page views)", host.Host, reports.FormatCount(host.Pageviews))
			}
			hosts = strings.Join(lines, "\n")
		}
		apps := "no events"
		if len(health.Apps) > 0 {
			lines := make([]string, len(health.Apps))
			for index, item := range health.Apps {
				platform := "Android"
				if item.Platform == "ios" {
					platform = "iOS"
				}
				lines[index] = fmt.Sprintf("%s %s events, last %s%s", platform, reports.FormatCount(item.Events), app.FormatTimeAgo(item.LastEventAt), sdksOf(item.SDKVersions))
			}
			apps = strings.Join(lines, "\n")
		}
		app.Println(fmt.Sprintf("Tracking over the last 7 days (%s to %s):", cli.Printable(day(health.Start)), cli.Printable(day(health.End))))
		app.Println(cli.FormatFields([]cli.Field{
			{Label: "Web", Value: web},
			{Label: "Web hosts", Value: hosts},
			{Label: "Apps", Value: apps},
			{Label: "Web to app", Value: fmt.Sprintf("%s of %s app users came from the web (%s)",
				reports.FormatCount(health.Handoff.WebFirstPeople), reports.FormatCount(health.Handoff.AppPeople), reports.FormatRate(health.Handoff.Share))},
		}))
		var next []string
		if health.Web.LastEventAt == nil && len(health.Apps) == 0 {
			next = append(next, "No SDK sent events this week: set up the SDK in your app ('voidhash init' in its root), then open the app.")
		}
		if health.Web.LastEventAt != nil && len(health.Web.Hosts) == 0 {
			next = append(next, "The web SDK sends events but no page views: call its page view tracking on each page.")
		}
		if len(next) == 0 {
			app.Notef("Watch events arrive with 'voidhash events tail'.")
			return nil
		}
		app.Println("\nNext:\n  " + strings.Join(next, "\n  "))
		return nil
	}
	return cmd
}
