// Package insights holds `voidhash insights`: the built-in revenue,
// subscription, trial and churn metrics, listed and run over a period.
package insights

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash insights`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "insights",
		Aliases: []string{"insight"},
		Short:   "Revenue, subscription, trial and churn metrics.",
		Long:    "Revenue, subscription, trial and churn metrics: list and run the built-in insights.",
	}
	cmd.AddCommand(newList(app), newRun(app))
	return cmd
}

// insight is one built-in insight, as the CLI describes it. Summary is how
// its one number combines the buckets of a period: their total, the value
// at the end, their average, or the change over it.
type insight struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Unit        string `json:"unit"`
	Summary     string `json:"summary"`
	Description string `json:"description"`
}

// insights are the built-in insights every project can run.
var insights = []insight{
	{"revenue", "Revenue", "money", "total", "Purchases and renewals minus refunds"},
	{"mrr", "MRR", "money", "end", "Monthly recurring revenue"},
	{"arr", "ARR", "money", "end", "Annual run rate, 12 × MRR"},
	{"mrr_growth_rate", "MRR growth rate", "percent", "change", "Change in MRR"},
	{"new_mrr", "New MRR", "money", "total", "MRR added by new subscriptions, other than those of returning subscribers"},
	{"expansion_mrr", "Expansion MRR", "money", "total", "MRR added by upgrades"},
	{"contraction_mrr", "Contraction MRR", "money", "total", "MRR lost to downgrades"},
	{"reactivation_mrr", "Reactivation MRR", "money", "total", "MRR from returning subscribers"},
	{"churned_revenue", "Churned revenue", "money", "total", "MRR lost to subscriptions that ended"},
	{"net_new_mrr", "Net new MRR", "money", "total", "New, expansion and reactivation minus lost MRR"},
	{"active_subscriptions", "Active subscriptions", "count", "end", "Paid subscriptions active"},
	{"new_subscriptions", "New subscriptions", "count", "total", "Paid subscriptions started"},
	{"churned_subscriptions", "Churned subscriptions", "count", "total", "Subscriptions that ended"},
	{"active_subscribers_growth", "Subscriber growth", "percent", "average", "Change in active paid subscriptions"},
	{"churn_rate", "Churn rate", "percent", "average", "Paid subscriptions that ended, of those active"},
	{"retention", "Retention", "percent", "average", "Paid subscriptions that did not end"},
	{"active_trials", "Active trials", "count", "end", "Subscriptions in a free trial"},
	{"trials", "Trials", "count", "total", "Free trials started"},
	{"trial_conversions", "Trial conversions", "count", "total", "Trials that converted to paid"},
	{"trial_conversion_rate", "Trial conversion rate", "percent", "average", "Trial conversions of trials started"},
	{"arpu", "ARPU", "money", "total", "Revenue per active person"},
	{"arppu", "ARPPU", "money", "total", "Revenue per paying person"},
	{"subscriber_lifetime_value", "Subscriber lifetime value", "money", "total", "ARPU divided by churn rate"},
	{"person_count", "Persons", "count", "end", "Persons ever seen"},
	{"new_persons", "New persons", "count", "total", "Persons seen for the first time"},
}

var summaryLabels = map[string]string{"total": "total", "end": "at the end", "average": "average", "change": "change"}

// withoutEnvironment are the insights without a store environment: persons
// are counted wherever they come from.
var withoutEnvironment = map[string]bool{"person_count": true, "new_persons": true}

var insightKind = cli.ItemKind[insight]{
	Noun:        "insight",
	ID:          func(item insight) string { return item.ID },
	Label:       func(item insight) string { return item.Name + " (" + item.ID + ")" },
	ListCommand: "voidhash insights list",
	Keys:        func(item insight) []string { return []string{strings.ReplaceAll(item.ID, "_", "-")} },
	Names:       func(item insight) []string { return []string{item.Name} },
}

var productKind = cli.ItemKind[api.ProductJsonEncoding]{
	Noun:          "product",
	ID:            func(product api.ProductJsonEncoding) string { return product.Id },
	Label:         func(product api.ProductJsonEncoding) string { return product.Name + " (" + product.Slug + ")" },
	ListCommand:   "voidhash product list",
	CreateCommand: "voidhash product create",
	Keys:          func(product api.ProductJsonEncoding) []string { return []string{product.Slug} },
	Names:         func(product api.ProductJsonEncoding) []string { return []string{product.Name} },
}

// environments are the stored purchase environments each --environment
// counts: production (1), store sandbox (2) or test (3); `all` leaves them
// unfiltered.
var environments = map[string]int{"production": 1, "sandbox": 2, "test": 3}

// newList creates `voidhash insights list`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the built-in insights 'voidhash insights run' takes.",
		Long:    "List the built-in insights 'voidhash insights run' takes: what each measures, its unit, and how its one number sums up a period (the total, the value at the end, the average or the change).",
		Example: `voidhash insights list`,
	}
	asJSON := cmd.Flags().Bool("json", false, "Print the insights as JSON, for scripts")
	cmd.RunE = func(*cobra.Command, []string) error {
		if *asJSON {
			return app.PrintJSON(insights)
		}
		cli.PrintTable(app, []cli.Column[insight]{
			{Header: "INSIGHT", Cell: func(item insight) string { return item.ID }},
			{Header: "NAME", Cell: func(item insight) string { return item.Name }},
			{Header: "UNIT", Cell: func(item insight) string { return item.Unit }},
			{Header: "SUMMARY", Cell: func(item insight) string { return summaryLabels[item.Summary] }},
			{Header: "MEASURES", Cell: func(item insight) string { return item.Description }},
		}, insights, "")
		app.Notef("Run one with 'voidhash insights run <insight> --last 30d'.")
		return nil
	}
	return cmd
}

// formatValue is a value of item as people read it.
func formatValue(item insight, value float64, currency string) string {
	switch item.Unit {
	case "money":
		if currency == "" {
			currency = "USD"
		}
		return reports.FormatMoney(value, currency)
	case "percent":
		return reports.FormatCount(math.Floor(value*100+0.5)/100) + "%"
	}
	return reports.FormatCount(value)
}

type point struct {
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

// result is the part of one insight's answer the summary and the series
// table read. A metric answers with a sparkline, a trend with a series.
type result struct {
	Key    string `json:"key"`
	Result struct {
		Summary *struct {
			Value    float64 `json:"value"`
			Currency *string `json:"currency"`
		} `json:"summary"`
		Sparkline []point `json:"sparkline"`
		Series    []point `json:"series"`
	} `json:"result"`
}

// newRun creates `voidhash insights run [insight...]`.
func newRun(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "run",
		Short: "Run built-in insights over a period.",
		Long: `Run built-in insights over a period: each one's summary, and its value in every bucket of the period.

An insight is named by its id (mrr, churn_rate or churn-rate) or its name ("Churn rate"); 'voidhash insights list' shows them. The period is the last 30 complete days in UTC unless --last or --from says otherwise. Purchases of production are counted unless --environment says otherwise.`,
		Example: `voidhash insights run mrr
voidhash insights run mrr churn-rate --last 90d --by week
voidhash insights run revenue --from 2026-10-01 --to 2026-10-31 --compare
voidhash insights run new-subscriptions --product pro-monthly --json`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "insight", Help: `Insights to run, such as mrr or "trial conversion rate"`, Optional: true, Variadic: true})
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "30d")
	by := cli.AddChoiceFlag(cmd, "by", "", []string{"hour", "day", "week", "month", "quarter", "year"}, "",
		"Bucket width of the series (default: by the period's length)")
	products := cli.AddStringsFlag(cmd, "product", "", "Only purchases of this product: its slug, name or id; repeat for each")
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "sandbox", "test", "all"}, "production",
		"Purchases counted: production, sandbox (App Store and Google Play sandbox), test (debug builds' simulated purchases and test modes such as Stripe's) or all (default: production)")
	compare := cmd.Flags().Bool("compare", false, "Also run the period of the same length before it")
	asJSON := cmd.Flags().Bool("json", false, "Print the API results as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		// What can be wrong on the command line, before any request.
		now := app.Now()
		period, err := periodFlags.Period(reports.TodayIn(now, "UTC"))
		if err != nil {
			return err
		}
		var chosen []insight
		for _, name := range args {
			found, err := cli.FindItem(insightKind, insights, name)
			if err != nil {
				return err
			}
			chosen = append(chosen, found)
		}
		if len(chosen) == 0 {
			if !app.IsInteractive() {
				return cli.MissingInput("the insight", "voidhash insights run <insight> --last 30d")
			}
			picked, err := cli.ChooseItem(ctx, app, insightKind, insights, "")
			if err != nil {
				return err
			}
			chosen = []insight{picked}
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id

		var productIDs, productSlugs []string
		if len(*products) > 0 {
			all, err := cli.ListAll[api.ProductJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.ProductsList(ctx, projectID, &api.ProductsListParams{Cursor: page.Cursor, Limit: page.Limit})
			})
			if err != nil {
				return err
			}
			for _, input := range *products {
				product, err := cli.FindItem(productKind, all.Items, input)
				if err != nil {
					return err
				}
				productIDs = append(productIDs, product.Id)
				productSlugs = append(productSlugs, product.Slug)
			}
		}
		granularity := *by
		if granularity == "" {
			granularity = reports.DefaultGranularity(reports.DaysIn(period))
		}

		// filterFor is the filter of item's query: the environment it counts,
		// and the products.
		filterFor := func(item insight) any {
			var predicates []any
			if code, ok := environments[*environment]; ok && !withoutEnvironment[item.ID] {
				predicates = append(predicates, reports.Body{"type": "predicate", "field": "provider.environment", "op": "in", "value": []int{code}})
			}
			if len(productIDs) > 0 {
				predicates = append(predicates, reports.Body{"type": "predicate", "field": "product.id", "op": "in", "value": productIDs})
			}
			switch len(predicates) {
			case 0:
				return nil
			case 1:
				return predicates[0]
			}
			return reports.Body{"type": "and", "filters": predicates}
		}
		queryFor := func(item insight, over reports.Period, key string) reports.Body {
			start, end := reports.Instants(over, now)
			query := reports.Body{
				"key":         key,
				"insightId":   item.ID,
				"granularity": granularity,
				"timeRange":   reports.Body{"preset": "custom", "start": start, "end": end},
			}
			if filter := filterFor(item); filter != nil {
				query["filter"] = filter
			}
			return query
		}
		previous := reports.PreviousPeriod(period)
		var queries []reports.Body
		for _, item := range chosen {
			queries = append(queries, queryFor(item, period, item.ID))
			if *compare {
				queries = append(queries, queryFor(item, previous, item.ID+":previous"))
			}
		}
		report, err := cli.Fetch[struct {
			Results json.RawMessage `json:"results"`
		}](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsReportInsightsWithBody(ctx, projectID, reports.ContentType, reports.Body{"queries": queries}.Reader())
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(report.Value.Results)
		}
		var results []result
		if err := json.Unmarshal(report.Value.Results, &results); err != nil {
			return cli.Failf("The Voidhash API sent results the CLI could not read.")
		}
		byKey := map[string]result{}
		for _, item := range results {
			byKey[item.Key] = item
		}

		scope := ""
		if len(productSlugs) > 0 {
			scope = ", " + strings.Join(productSlugs, ", ")
		}
		printed := 0
		for _, item := range chosen {
			answer, ok := byKey[item.ID]
			if !ok {
				continue
			}
			if printed++; printed > 1 {
				app.Println("")
			}
			value, currency := 0.0, ""
			if summary := answer.Result.Summary; summary != nil {
				value = summary.Value
				if summary.Currency != nil {
					currency = *summary.Currency
				}
			}
			counted := ", " + *environment
			if withoutEnvironment[item.ID] {
				counted = ""
			}
			app.Println(cli.Printable(fmt.Sprintf("%s, %s (%s to %s UTC%s%s)", item.Name, period.Label, period.From, period.To, counted, scope)))
			fields := []cli.Field{{Label: summaryLabels[item.Summary], Value: formatValue(item, value, currency)}}
			if before := byKey[item.ID+":previous"].Result.Summary; before != nil {
				fields = append(fields, cli.Field{
					Label: "previous",
					Value: fmt.Sprintf("%s (%s to %s), %s", formatValue(item, before.Value, currency), previous.From, previous.To, reports.FormatChange(value, before.Value)),
				})
			}
			app.Println(cli.FormatFields(fields))
			app.Println("")
			points := answer.Result.Sparkline
			if points == nil {
				points = answer.Result.Series
			}
			cli.PrintTable(app, []cli.Column[point]{
				{Header: strings.ToUpper(granularity), Cell: func(at point) string {
					if granularity == "hour" && len(at.Timestamp) >= 16 {
						return strings.Replace(at.Timestamp[:16], "T", " ", 1)
					}
					return at.Timestamp[:min(10, len(at.Timestamp))]
				}},
				{Header: "VALUE", Cell: func(at point) string { return formatValue(item, at.Value, currency) }},
			}, points, "  No data in this period.")
		}
		return nil
	}
	return cmd
}
