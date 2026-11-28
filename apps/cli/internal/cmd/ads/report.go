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

// newReport creates `voidhash ads report`.
func newReport(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "report",
		Short: "Ads reports: performance, creatives and cohorts.",
		Long:  "Ads reports: what campaigns, ad groups and ads spent and earned, which creatives work, and how cohorts pay back. Days are cut in the ad accounts' time zone unless --timezone says otherwise.",
	}
	cmd.AddCommand(newPerformance(app), newCreatives(app), newReportCohorts(app))
	return cmd
}

// reportFlags are what every ads report takes besides its period.
type reportFlags struct {
	currency, timezone, environment *string
	asJSON                          *bool
}

func addReportFlags(cmd *cobra.Command) reportFlags {
	return reportFlags{
		currency: cmd.Flags().String("currency", "", "ISO 4217 `code` money is reported in (default: the ad accounts' currency)"),
		timezone: cmd.Flags().String("timezone", "", "IANA time `zone` days are cut in (default: the ad accounts' time zone)"),
		environment: cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "sandbox", "test"}, "",
			"Purchases revenue is read from: production, sandbox (App Store and Google Play sandbox) or test (debug builds' simulated purchases and test modes such as Stripe's) (default: production)"),
		asJSON: cmd.Flags().Bool("json", false, "Print the API report as JSON, for scripts"),
	}
}

func (f reportFlags) fill(body reports.Body) {
	body.Text("currency", *f.currency).Text("timezone", *f.timezone).Text("environment", *f.environment)
}

// today is the date in the time zone ads reports cut days in: --timezone,
// else the one every connected account shares, else UTC.
func (f reportFlags) today(ctx context.Context, app *cli.App, projectID string) (string, error) {
	if *f.timezone != "" {
		return reports.TodayIn(app.Now(), *f.timezone), nil
	}
	accounts, err := listAccounts(ctx, app, projectID)
	if err != nil {
		return "", err
	}
	zone := ""
	for index, item := range accounts.Items {
		if index > 0 && item.Timezone != zone {
			zone = ""
			break
		}
		zone = item.Timezone
	}
	return reports.TodayIn(app.Now(), zone), nil
}

// reportContext is what every ads report says about itself.
type reportContext struct {
	From              string    `json:"from"`
	To                string    `json:"to"`
	Currency          string    `json:"currency"`
	Timezone          string    `json:"timezone"`
	HasMeasuredAccess *bool     `json:"hasMeasuredAccess"`
	ProvisionalFrom   *string   `json:"provisionalFrom"`
	Warnings          []warning `json:"warnings"`
}

// warning is a caveat of a report. Which fields it carries depends on its
// code.
type warning struct {
	Code        string   `json:"code"`
	AccountName *string  `json:"accountName"`
	Reason      *string  `json:"reason"`
	Currencies  []string `json:"currencies"`
}

func (w warning) String() string {
	what := strings.ReplaceAll(w.Code, "_", " ")
	switch {
	case w.AccountName != nil:
		reason := ""
		if w.Reason != nil {
			reason = " (" + *w.Reason + ")"
		}
		return *w.AccountName + ": " + what + reason
	case w.Currencies != nil:
		return what + ": " + strings.Join(w.Currencies, ", ")
	}
	return what
}

// printNotes prints a report's caveats, one line each, on standard error.
func (c reportContext) printNotes(app *cli.App) {
	if c.HasMeasuredAccess != nil && !*c.HasMeasuredAccess {
		app.Notef("Signups, payers and revenue are not shown: your access does not include analytics.")
	}
	for _, caveat := range c.Warnings {
		app.Notef("Note: %s.", cli.Printable(caveat.String()))
	}
	if c.ProvisionalFrom != nil {
		app.Notef("Note: numbers from %s on are provisional and can still grow.", cli.Printable(*c.ProvisionalFrom))
	}
}

type reportedMetrics struct {
	Spend      float64  `json:"spend"`
	LinkClicks float64  `json:"linkClicks"`
	CTR        *float64 `json:"ctr"`
}

type measuredMetrics struct {
	Signups          float64  `json:"signups"`
	Payers           float64  `json:"payers"`
	NetRevenue       float64  `json:"netRevenue"`
	Roas             *float64 `json:"roas"`
	ReturningRevenue *float64 `json:"returningRevenue"`
}

type modeledMetrics struct {
	NetRevenueHigh float64  `json:"netRevenueHigh"`
	RoasHigh       *float64 `json:"roasHigh"`
	VisitCoverage  float64  `json:"visitCoverage"`
}

type performanceRow struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	DeliveryStatus string           `json:"deliveryStatus"`
	Reported       reportedMetrics  `json:"reported"`
	Measured       *measuredMetrics `json:"measured"`
	Modeled        *modeledMetrics  `json:"modeled"`
	Breakdown      []struct {
		Value    string           `json:"value"`
		Reported *reportedMetrics `json:"reported"`
		Measured *measuredMetrics `json:"measured"`
	} `json:"breakdown"`
}

type performanceReport struct {
	reportContext
	Level    string           `json:"level"`
	Data     []performanceRow `json:"data"`
	PageInfo api.PageInfo     `json:"pageInfo"`
	Totals   struct {
		Reported reportedMetrics  `json:"reported"`
		Measured *measuredMetrics `json:"measured"`
		Modeled  *modeledMetrics  `json:"modeled"`
	} `json:"totals"`
	Unallocated *struct {
		Spend float64 `json:"spend"`
	} `json:"unallocated"`
}

var performanceSorts = []string{"spend", "name", "impressions", "link-clicks", "ctr", "platform-roas", "signups", "payers", "cost-per-payer", "net-revenue", "roas"}

// newPerformance creates `voidhash ads report performance`.
func newPerformance(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "performance",
		Short: "What each campaign, ad group or ad spent and got.",
		Long: `What each campaign, ad group or ad spent and got: the platform's clicks next to the signups, payers and revenue Voidhash measured, with an estimate of what the clicks it could not see may have earned.

The period is the last 7 complete days unless --last or --from says otherwise. Rows sort by spend, highest first; name and cost-per-payer sort lowest first.`,
		Example: `voidhash ads report performance
voidhash ads report performance --level ad --campaign "Spring sale" --sort roas
voidhash ads report performance --last 30d --breakdown country --json`,
	}
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "7d")
	level := cli.AddChoiceFlag(cmd, "level", "", []string{"campaign", "ad-group", "ad"}, "campaign", "One row per campaign, ad group or ad (default: campaign)")
	campaigns := cli.AddStringsFlag(cmd, "campaign", "", "Only this campaign (its name or id), or the ad groups and ads in it; repeat for each")
	deliveryFlag := cli.AddChoiceFlag(cmd, "delivery", "", []string{"active", "needs-attention"}, "", "Only delivering or learning rows, or those that need attention")
	sort := cli.AddChoiceFlag(cmd, "sort", "", performanceSorts, "spend", "What rows are sorted by (default: spend)")
	breakdown := cli.AddChoiceFlag(cmd, "breakdown", "", []string{"placement", "surface", "country", "age", "gender", "device"}, "", "Also split each row by this")
	limit := cmd.Flags().Int("limit", 50, "Rows to show (default: 50, at most 200)")
	flags := addReportFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if *limit < 1 || *limit > 200 {
			return cli.Usagef("--limit must be from 1 to 200.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		today, err := flags.today(ctx, app, projectID)
		if err != nil {
			return err
		}
		period, err := periodFlags.Period(today)
		if err != nil {
			return err
		}
		direction := "desc"
		if *sort == "name" || *sort == "cost-per-payer" {
			direction = "asc"
		}
		body := reports.Body{
			"from": period.From, "to": period.To, "level": underscored(*level), "limit": *limit,
			"sort": reports.Body{"field": underscored(*sort), "direction": direction},
		}
		if len(*campaigns) > 0 {
			all, err := listCampaigns(ctx, app, projectID, objectFilter{})
			if err != nil {
				return err
			}
			ids := make([]string, len(*campaigns))
			for index, input := range *campaigns {
				found, err := cli.FindItem(campaignKind, all.Items, input)
				if err != nil {
					return err
				}
				ids[index] = found.ID
			}
			body["campaignIds"] = ids
		}
		body.Text("delivery", underscored(*deliveryFlag)).Text("breakdown", *breakdown)
		flags.fill(body)
		fetched, err := cli.Fetch[performanceReport](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdsReportPerformanceWithBody(ctx, projectID, reports.ContentType, body.Reader())
		})
		if err != nil {
			return err
		}
		if *flags.asJSON {
			return app.PrintJSON(fetched)
		}
		report := fetched.Value
		money := func(amount float64) string { return reports.FormatMoney(amount, report.Currency) }
		app.Println(cli.Printable(fmt.Sprintf("Ads by %s, %s (%s to %s, %s):",
			strings.ReplaceAll(report.Level, "_", " "), period.Label, report.From, report.To, report.Timezone)))
		app.Println("")

		// A row, then one indented row per slice of its breakdown.
		var rows []performanceRow
		for _, row := range report.Data {
			rows = append(rows, row)
			for _, slice := range row.Breakdown {
				part := row
				part.Name = "  " + slice.Value
				part.Reported = reportedMetrics{}
				if slice.Reported != nil {
					part.Reported = *slice.Reported
				}
				part.Measured = slice.Measured
				// The estimate is of the whole row; a slice has none.
				part.Modeled = nil
				rows = append(rows, part)
			}
		}
		// measured is a cell of a measured number: "-" without measured
		// access or without the step.
		measured := func(pick func(*measuredMetrics) *float64, format func(float64) string) func(performanceRow) string {
			return func(row performanceRow) string {
				if row.Measured == nil {
					return "-"
				}
				if value := pick(row.Measured); value != nil {
					return format(*value)
				}
				return "-"
			}
		}
		roas := func(value float64) string { return reports.FormatRoas(&value) }
		cli.PrintTable(app, []cli.Column[performanceRow]{
			{Header: "NAME", Cell: func(row performanceRow) string { return row.Name }},
			{Header: "DELIVERY", Cell: func(row performanceRow) string { return deliveryLabel(row.DeliveryStatus) }},
			{Header: "SPEND", Cell: func(row performanceRow) string { return money(row.Reported.Spend) }},
			{Header: "CLICKS", Cell: func(row performanceRow) string { return reports.FormatCount(row.Reported.LinkClicks) }},
			{Header: "CTR", Cell: func(row performanceRow) string { return reports.FormatRate(row.Reported.CTR) }},
			{Header: "SIGNUPS", Cell: measured(func(m *measuredMetrics) *float64 { return &m.Signups }, reports.FormatCount)},
			{Header: "PAYERS", Cell: measured(func(m *measuredMetrics) *float64 { return &m.Payers }, reports.FormatCount)},
			{Header: "NET REVENUE", Cell: measured(func(m *measuredMetrics) *float64 { return &m.NetRevenue }, money)},
			{Header: "ROAS", Cell: measured(func(m *measuredMetrics) *float64 { return m.Roas }, roas)},
			{Header: "EST. ROAS UP TO", Cell: func(row performanceRow) string {
				if row.Modeled == nil {
					return "-"
				}
				return reports.FormatRoas(row.Modeled.RoasHigh)
			}},
			{Header: "RETURNING REVENUE", Cell: measured(func(m *measuredMetrics) *float64 { return m.ReturningRevenue }, money)},
			{Header: "ID", Cell: func(row performanceRow) string { return row.ID }},
		}, rows, "No delivery in this period.")

		totals := report.Totals
		total := fmt.Sprintf("%s spend, %s link clicks", money(totals.Reported.Spend), reports.FormatCount(totals.Reported.LinkClicks))
		if totals.Measured != nil {
			total += fmt.Sprintf(", %s signups, %s payers, %s net revenue (ROAS %s)", reports.FormatCount(totals.Measured.Signups),
				reports.FormatCount(totals.Measured.Payers), money(totals.Measured.NetRevenue), reports.FormatRoas(totals.Measured.Roas))
		}
		fields := []cli.Field{{Label: "Total", Value: total}}
		if totals.Measured != nil && totals.Measured.ReturningRevenue != nil && *totals.Measured.ReturningRevenue != 0 {
			fields = append(fields, cli.Field{Label: "Returning", Value: money(*totals.Measured.ReturningRevenue) + " from people reached again after signing up; not in net revenue or ROAS"})
		}
		if totals.Modeled != nil {
			fields = append(fields, cli.Field{Label: "Estimate", Value: fmt.Sprintf(
				"up to %s net revenue (ROAS %s), visits seen for %s of web-bound link clicks. Assumes those clicks Voidhash could not see converted like the ones it could, capped by the net revenue of the people who converted in the period with no credited touch; measured revenue is the floor",
				money(totals.Modeled.NetRevenueHigh), reports.FormatRoas(totals.Modeled.RoasHigh), reports.FormatRate(&totals.Modeled.VisitCoverage))})
		}
		if report.Unallocated != nil && report.Unallocated.Spend != 0 {
			fields = append(fields, cli.Field{Label: "Not by ad", Value: money(report.Unallocated.Spend) + " spend no ad accounts for"})
		}
		app.Println("\n" + cli.FormatFields(fields))
		if report.PageInfo.HasNextPage {
			app.Notef("Showing the first %d rows; --limit shows more (up to 200).", len(report.Data))
		}
		report.printNotes(app)
		return nil
	}
	return cmd
}

type creativeRow struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Format       string   `json:"format"`
	AdCount      float64  `json:"adCount"`
	Spend        float64  `json:"spend"`
	CTR          *float64 `json:"ctr"`
	HookRate     *float64 `json:"hookRate"`
	Frequency    *float64 `json:"frequency"`
	Roas         *float64 `json:"roas"`
	CostPerPayer *float64 `json:"costPerPayer"`
	Fatigue      *struct {
		Frequency float64 `json:"frequency"`
		CTRChange float64 `json:"ctrChange"`
		Days      int     `json:"days"`
	} `json:"fatigue"`
}

// newCreatives creates `voidhash ads report creatives`.
func newCreatives(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "creatives",
		Short: "Which creatives spend the most, what they earn, and which show fatigue.",
		Long:  "Which creatives spend the most, what they earn, and which show fatigue: a click-through rate that falls as frequency rises. HOOK is the share of impressions that watched a video's first seconds. The period is the last 30 complete days unless --last or --from says otherwise.",
		Example: `voidhash ads report creatives
voidhash ads report creatives --format video --last 90d
voidhash ads report creatives --search "summer" --json`,
	}
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "30d")
	formats := cmd.Flags().StringArray("format", nil, "Only creatives of this `format`: image, video or carousel; repeat for each")
	search := cmd.Flags().String("search", "", "Only creatives whose name contains this `text`")
	limit := cmd.Flags().Int("limit", 25, "Creatives to show (default: 25, at most 100)")
	flags := addReportFlags(cmd)
	_ = cmd.RegisterFlagCompletionFunc("format", func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
		return []string{"image", "video", "carousel"}, cobra.ShellCompDirectiveNoFileComp
	})

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if *limit < 1 || *limit > 100 {
			return cli.Usagef("--limit must be from 1 to 100.")
		}
		for _, format := range *formats {
			if !slices.Contains([]string{"image", "video", "carousel"}, format) {
				return cli.Usagef("--format %s is not a format.", format).WithHint("Pass image, video or carousel.")
			}
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		today, err := flags.today(ctx, app, projectID)
		if err != nil {
			return err
		}
		period, err := periodFlags.Period(today)
		if err != nil {
			return err
		}
		body := reports.Body{"from": period.From, "to": period.To, "limit": *limit}
		if len(*formats) > 0 {
			body["formats"] = *formats
		}
		body.Text("search", *search)
		flags.fill(body)
		fetched, err := cli.Fetch[struct {
			reportContext
			Data     []creativeRow `json:"data"`
			PageInfo api.PageInfo  `json:"pageInfo"`
		}](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdsReportCreativesWithBody(ctx, projectID, reports.ContentType, body.Reader())
		})
		if err != nil {
			return err
		}
		if *flags.asJSON {
			return app.PrintJSON(fetched)
		}
		report := fetched.Value
		money := func(amount float64) string { return reports.FormatMoney(amount, report.Currency) }
		app.Println(cli.Printable(fmt.Sprintf("Creatives by spend, %s (%s to %s, %s):", period.Label, report.From, report.To, report.Timezone)))
		app.Println("")
		cli.PrintTable(app, []cli.Column[creativeRow]{
			{Header: "NAME", Cell: func(row creativeRow) string { return row.Name }},
			{Header: "FORMAT", Cell: func(row creativeRow) string { return row.Format }},
			{Header: "ADS", Cell: func(row creativeRow) string { return reports.FormatCount(row.AdCount) }},
			{Header: "SPEND", Cell: func(row creativeRow) string { return money(row.Spend) }},
			{Header: "CTR", Cell: func(row creativeRow) string { return reports.FormatRate(row.CTR) }},
			{Header: "HOOK", Cell: func(row creativeRow) string { return reports.FormatRate(row.HookRate) }},
			{Header: "FREQ", Cell: func(row creativeRow) string {
				if row.Frequency == nil {
					return "-"
				}
				return reports.FormatCount(*row.Frequency)
			}},
			{Header: "ROAS", Cell: func(row creativeRow) string { return reports.FormatRoas(row.Roas) }},
			{Header: "COST/PAYER", Cell: func(row creativeRow) string {
				if row.CostPerPayer == nil {
					return "-"
				}
				return money(*row.CostPerPayer)
			}},
			{Header: "FATIGUE", Cell: func(row creativeRow) string {
				if row.Fatigue == nil {
					return "-"
				}
				return fmt.Sprintf("CTR %s over %dd, frequency %s", reports.FormatRate(&row.Fatigue.CTRChange), row.Fatigue.Days, reports.FormatCount(row.Fatigue.Frequency))
			}},
			{Header: "ID", Cell: func(row creativeRow) string { return row.ID }},
		}, report.Data, "No creative delivered in this period.")
		if report.PageInfo.HasNextPage {
			app.Notef("Showing the first %d; --limit shows more (up to 100).", len(report.Data))
		}
		report.printNotes(app)
		return nil
	}
	return cmd
}

// cohortDaysShown are the days since acquisition the cohorts table shows;
// --json has every day.
var cohortDaysShown = []int{0, 7, 30, 90, 180, 365}

// paybackHorizonDay is the day a group's chance of paying back is judged at.
const paybackHorizonDay = 365

type projectedValue struct {
	Value     float64 `json:"value"`
	Low       float64 `json:"low"`
	High      float64 `json:"high"`
	IsPartial bool    `json:"isPartial"`
}

// String is the value a cohort is expected to reach: "~1.30x", with "+"
// when some renewals could not be projected.
func (p projectedValue) String() string {
	partial := ""
	if p.IsPartial {
		partial = "+"
	}
	return "~" + reports.FormatRoas(&p.Value) + partial
}

type cohortValue struct {
	Day        int             `json:"day"`
	Value      *float64        `json:"value"`
	IsMaturing bool            `json:"isMaturing"`
	Projected  *projectedValue `json:"projected"`
}

type adsCohort struct {
	Start  string        `json:"start"`
	Spend  float64       `json:"spend"`
	People float64       `json:"people"`
	Values []cohortValue `json:"values"`
}

type cohortGroup struct {
	Key                string        `json:"key"`
	Name               *string       `json:"name"`
	People             float64       `json:"people"`
	Values             []cohortValue `json:"values"`
	PaybackDay         *int          `json:"paybackDay"`
	PaybackProbability *float64      `json:"paybackProbability"`
}

func valueAt(values []cohortValue, day int) *cohortValue {
	for index := range values {
		if values[index].Day == day {
			return &values[index]
		}
	}
	return nil
}

// newReportCohorts creates `voidhash ads report cohorts`.
func newReportCohorts(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cohorts",
		Short: "Payback by acquisition cohort.",
		Long: `Payback by acquisition cohort: ROAS, revenue per payer or payers by day since people's first ad touch, for the people acquired each week or month.

A cell marked * is still maturing, ~ is projected from the project's renewal and trial history, and + is a projection that is likely low. The period is the last 13 complete weeks unless --last or --from says otherwise.`,
		Example: `voidhash ads report cohorts
voidhash ads report cohorts --by campaign --unit month --last 6m
voidhash ads report cohorts --metric payers --json`,
	}
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "13w")
	by := cli.AddChoiceFlag(cmd, "by", "", []string{"platform", "surface", "campaign", "ad-group"}, "platform", "What the groups are (default: platform)")
	unit := cli.AddChoiceFlag(cmd, "unit", "", []string{"week", "month"}, "week", "Cohort size (default: week)")
	metric := cli.AddChoiceFlag(cmd, "metric", "", []string{"roas", "revenue-per-payer", "payers"}, "roas", "What the cells show (default: roas)")
	flags := addReportFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		today, err := flags.today(ctx, app, projectID)
		if err != nil {
			return err
		}
		period, err := periodFlags.Period(today)
		if err != nil {
			return err
		}
		body := reports.Body{"from": period.From, "to": period.To, "groupBy": underscored(*by), "unit": *unit, "metric": underscored(*metric)}
		flags.fill(body)
		fetched, err := cli.Fetch[struct {
			reportContext
			GroupBy string      `json:"groupBy"`
			Unit    string      `json:"unit"`
			Metric  string      `json:"metric"`
			Cohorts []adsCohort `json:"cohorts"`
			Average struct {
				Values []cohortValue `json:"values"`
			} `json:"average"`
			Groups []cohortGroup `json:"groups"`
		}](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AdsReportCohortsWithBody(ctx, projectID, reports.ContentType, body.Reader())
		})
		if err != nil {
			return err
		}
		if *flags.asJSON {
			return app.PrintJSON(fetched)
		}
		report := fetched.Value
		money := func(amount float64) string { return reports.FormatMoney(amount, report.Currency) }
		format := func(value *float64) string {
			switch {
			case value == nil:
				return "-"
			case report.Metric == "roas":
				return reports.FormatRoas(value)
			case report.Metric == "revenue_per_payer":
				return money(*value)
			}
			return reports.FormatCount(*value)
		}
		metric := "ROAS"
		if report.Metric != "roas" {
			metric = strings.ReplaceAll(report.Metric, "_", " ")
			metric = strings.ToUpper(metric[:1]) + metric[1:]
		}
		app.Println(cli.Printable(fmt.Sprintf("%s by day since acquisition, %sly cohorts acquired %s (%s to %s):",
			metric, report.Unit, period.Label, report.From, report.To)))
		app.Println("")
		columns := []cli.Column[adsCohort]{
			{Header: "COHORT", Cell: func(item adsCohort) string { return item.Start }},
			{Header: "SPEND", Cell: func(item adsCohort) string { return money(item.Spend) }},
			{Header: "PEOPLE", Cell: func(item adsCohort) string { return reports.FormatCount(item.People) }},
		}
		for _, day := range cohortDaysShown {
			if valueAt(report.Average.Values, day) == nil {
				continue
			}
			columns = append(columns, cli.Column[adsCohort]{Header: fmt.Sprintf("DAY %d", day), Cell: func(item adsCohort) string {
				cell := valueAt(item.Values, day)
				switch {
				case cell == nil:
					return "-"
				case cell.Projected != nil:
					// A day the cohort has not completed shows what it is expected to reach.
					return cell.Projected.String()
				case cell.IsMaturing:
					return format(cell.Value) + "*"
				}
				return format(cell.Value)
			}})
		}
		cli.PrintTable(app, columns, report.Cohorts, "No cohorts: nobody was acquired by a connected platform's ads in this period.")
		if len(report.Groups) > 0 {
			app.Println("")
			app.Println(cli.Printable(fmt.Sprintf("By %s:", strings.ReplaceAll(report.GroupBy, "_", " "))))
			groupColumns := []cli.Column[cohortGroup]{
				{Header: "GROUP", Cell: func(group cohortGroup) string {
					if group.Name != nil {
						return *group.Name
					}
					return group.Key
				}},
				{Header: "PEOPLE", Cell: func(group cohortGroup) string { return reports.FormatCount(group.People) }},
				{Header: "PAYBACK", Cell: func(group cohortGroup) string {
					if group.PaybackDay == nil {
						return "not yet"
					}
					return fmt.Sprintf("day %d", *group.PaybackDay)
				}},
			}
			if report.Metric == "roas" {
				groupColumns = append(groupColumns,
					cli.Column[cohortGroup]{Header: fmt.Sprintf("DAY %d", paybackHorizonDay), Cell: func(group cohortGroup) string {
						value := valueAt(group.Values, paybackHorizonDay)
						switch {
						case value == nil:
							return "-"
						case value.Projected == nil:
							return format(value.Value)
						}
						return fmt.Sprintf("%s (%s-%s)", value.Projected, reports.FormatRoas(&value.Projected.Low), reports.FormatRoas(&value.Projected.High))
					}},
					cli.Column[cohortGroup]{Header: "PAYBACK CHANCE", Cell: func(group cohortGroup) string { return reports.FormatRate(group.PaybackProbability) }},
				)
			}
			cli.PrintTable(app, groupColumns, report.Groups, "")
		}
		if len(report.Cohorts) > 0 {
			app.Notef("* still maturing: it can still grow.")
			if report.Metric == "roas" {
				app.Notef("~ projected from the project's renewal and trial history, with its 80%% range; --json has every day.")
				app.Notef("+ partial: some renewals cannot be projected yet, so likely low.")
			}
		}
		report.printNotes(app)
		return nil
	}
	return cmd
}
