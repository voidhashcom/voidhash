package analytics

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// chartsJSON is the catalog of the project's built-in charts, one object
// per chart in the order Studio's built-in dashboards show them. It is the catalog
// in packages/lib/src/analytics-charts.ts (without the charts the dashboard
// keeps for itself), which is where a chart is added or changed; charts.json
// is then written again from it with `go generate`, and a test fails while
// the two name different charts.
//
//go:generate node ../../../scripts/generate-charts.mjs
//go:embed charts.json
var chartsJSON []byte

// chart is the part of a catalog entry the commands read; --json prints the
// whole entry.
type chart struct {
	ID             string            `json:"id"`
	Section        string            `json:"section"`
	Title          string            `json:"title"`
	Labels         map[string]string `json:"labels"`
	IsCurrentState bool              `json:"isCurrentState"`
}

// catalog decodes the embedded charts once, when a command first needs them.
var catalog = sync.OnceValue(func() cli.List[chart] {
	list := cli.List[chart]{}
	// The file is checked by the package's tests, so it always decodes.
	_ = json.Unmarshal(chartsJSON, &list.Raw)
	list.Items = make([]chart, len(list.Raw))
	for index, raw := range list.Raw {
		_ = json.Unmarshal(raw, &list.Items[index])
	}
	return list
})

var sections = []string{"overview", "revenue", "subscribers", "trials", "churn", "audience", "paywalls", "acquisition", "web", "app", "locations", "push", "health"}

// newCharts creates `voidhash analytics charts [--section]`.
func newCharts(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "charts",
		Short: "List the built-in charts.",
		Long:  "List the built-in charts, by section: the built-in dashboard in Studio a chart is on, or overview for the charts of the whole business that are on none. 'voidhash analytics chart <chart>' runs one. --json also has what each measures, and the dimensions and metrics it takes.",
		Example: `voidhash analytics charts
voidhash analytics charts --section paywalls
voidhash analytics charts --json`,
	}
	section := cli.AddChoiceFlag(cmd, "section", "", sections, "", "Only the charts of one built-in dashboard, or overview")
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(*cobra.Command, []string) error {
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		charts := catalog().Filter(func(item chart) bool { return *section == "" || item.Section == *section })
		switch mode {
		case cli.JSON:
			return app.PrintJSON(charts)
		case cli.Quiet:
			app.PrintIDs(charts)
			return nil
		}
		cli.PrintTable(app, []cli.Column[chart]{
			{Header: "CHART", Cell: func(item chart) string { return item.ID }},
			{Header: "SECTION", Cell: func(item chart) string { return item.Section }},
			{Header: "TITLE", Cell: func(item chart) string { return item.Title }},
		}, charts.Items, "No charts.")
		app.Notef("Run one with 'voidhash analytics chart <chart>'.")
		return nil
	}
	return cmd
}

// newChart creates `voidhash analytics chart <chart>`.
func newChart(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "chart",
		Short: "Run one of the built-in charts.",
		Long: `Run one of the built-in charts Studio shows: retention, paywalls, web traffic, installs, countries and more. 'voidhash analytics charts' lists them.

A time series reads as one number per line: the total of counts and money, the latest value of rates and stocks. Tables show their first 25 rows. --json has the whole result.`,
		Example: `voidhash analytics chart mrr_trend --last 90d --by week
voidhash analytics chart revenue_by_placement
voidhash analytics chart top_pages --timezone Europe/Prague --json`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "chart", Help: "The chart's id, as 'voidhash analytics charts' lists it"})
	project := cli.AddProjectFlag(cmd)
	periodFlags := reports.AddPeriodFlags(cmd, "30d")
	by := cli.AddChoiceFlag(cmd, "by", "", []string{"hour", "day", "week", "month"}, "", "Bucket width of a time series (default: day)")
	dimension := cmd.Flags().String("dimension", "", "What a chart with dimensions groups by")
	metric := cmd.Flags().String("metric", "", "What a chart with metrics shows")
	timezone := cmd.Flags().String("timezone", "", "IANA time `zone` days are cut in, such as Europe/Prague (default: UTC)")
	asJSON := cmd.Flags().Bool("json", false, "Print the API result as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		charts := catalog().Items
		index := slices.IndexFunc(charts, func(item chart) bool { return item.ID == args[0] })
		if index < 0 {
			message := fmt.Sprintf("There is no chart %s.", args[0])
			wanted := strings.ToLower(strings.NewReplacer("-", "_", " ", "_").Replace(strings.TrimSpace(args[0])))
			var close []string
			for _, item := range charts {
				if len(close) < 5 && wanted != "" && strings.Contains(item.ID, wanted) {
					close = append(close, item.ID)
				}
			}
			if len(close) > 0 {
				message += "\nDid you mean " + strings.Join(close, ", ") + "?"
			}
			return cli.Usagef("%s", message).WithHint("List them with 'voidhash analytics charts'.")
		}
		found := charts[index]
		zone := *timezone
		if zone == "" {
			zone = "UTC"
		}
		now := app.Now()
		period, err := periodFlags.Period(reports.TodayIn(now, zone))
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		start, end := reports.Instants(period, now)
		query := reports.Body{
			"chartId":   found.ID,
			"key":       found.ID,
			"timeRange": reports.Body{"preset": "custom", "start": start, "end": end},
			"timezone":  zone,
			"options":   reports.Body{}.Text("dimension", *dimension).Text("metric", *metric),
		}
		query.Text("granularity", *by)
		report, err := cli.Fetch[struct {
			Results []json.RawMessage `json:"results"`
		}](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsReportChartsWithBody(ctx, target.Project.Id, reports.ContentType, reports.Body{"queries": []reports.Body{query}}.Reader())
		})
		if err != nil {
			return err
		}
		item := json.RawMessage("null")
		if len(report.Value.Results) > 0 {
			item = report.Value.Results[0]
		}
		if *asJSON {
			return app.PrintJSON(item)
		}
		var answer struct {
			Currency *string         `json:"currency"`
			Result   json.RawMessage `json:"result"`
		}
		// Without a result there are no lines, which reads as no data.
		_ = json.Unmarshal(item, &answer)
		when := period.Label
		if found.IsCurrentState {
			when = "as of now"
		}
		app.Println(fmt.Sprintf("%s, %s:", found.Title, when))
		lines := resultLines(found, answer.Result, firstOf("", answer.Currency))
		if len(lines) == 0 {
			app.Println("  No data in this period.")
			return nil
		}
		for _, line := range lines {
			app.Println("  " + cli.Printable(line))
		}
		return nil
	}
	return cmd
}

// textRows is how many rows of a long result are shown; --json has them all.
const textRows = 25

// formatChartNumber is a chart's number as text: money from minor units of
// currency, a rate as a percentage; "n/a" for none.
func formatChartNumber(value *float64, unit, currency string) string {
	if value == nil {
		return "n/a"
	}
	number := *value
	switch unit {
	case "money":
		if currency == "" {
			currency = "USD"
		}
		return reports.FormatMoney(number, currency)
	case "rate":
		return reports.FormatNumber(number*100, 1) + "%"
	case "ratio":
		return reports.FormatNumber(number, 2)
	case "score":
		return reports.FormatNumber(number, 3)
	case "milliseconds":
		return reports.FormatNumber(number, 0) + " ms"
	case "seconds":
		return reports.FormatNumber(number, 1) + " s"
	case "minutes":
		return reports.FormatNumber(number, 1) + " min"
	case "days":
		return reports.FormatNumber(number, 1) + " days"
	}
	if number < 10 {
		return reports.FormatNumber(number, 1)
	}
	return reports.FormatNumber(number, 0)
}

// chartResult is every shape a chart's result takes, read by its `shape`.
type chartResult struct {
	Shape string `json:"shape"`
	Unit  string `json:"unit"`
	// series and curves
	Series []struct {
		Key    string     `json:"key"`
		Label  *string    `json:"label"`
		Size   float64    `json:"size"`
		Values []*float64 `json:"values"`
	} `json:"series"`
	// table rows, and the row names of a heatmap
	Rows        json.RawMessage `json:"rows"`
	IsTruncated bool            `json:"isTruncated"`
	// table columns, and the column names of a heatmap
	Columns json.RawMessage `json:"columns"`
	// funnel
	Steps []struct {
		Key   string  `json:"key"`
		Label *string `json:"label"`
		Count float64 `json:"count"`
	} `json:"steps"`
	// cohorts and curves
	Period  string    `json:"period"`
	Axis    string    `json:"axis"`
	Offsets []float64 `json:"offsets"`
	Cohorts []struct {
		Start  string     `json:"start"`
		Size   float64    `json:"size"`
		Values []*float64 `json:"values"`
	} `json:"cohorts"`
	// histogram
	Bins []struct {
		Lower float64  `json:"lower"`
		Upper *float64 `json:"upper"`
		Count float64  `json:"count"`
	} `json:"bins"`
	Median *float64 `json:"median"`
	Total  float64  `json:"total"`
	// heatmap
	Values [][]float64 `json:"values"`
	// flow
	Nodes []struct {
		Key   string  `json:"key"`
		Label *string `json:"label"`
	} `json:"nodes"`
	Links []flowLink `json:"links"`
	// stats
	Stats []struct {
		Key      string          `json:"key"`
		Unit     string          `json:"unit"`
		Value    *float64        `json:"value"`
		Previous json.RawMessage `json:"previous"`
	} `json:"stats"`
	// points
	Points []struct {
		Key   string  `json:"key"`
		Label *string `json:"label"`
		Value float64 `json:"value"`
	} `json:"points"`
}

type flowLink struct {
	Source string  `json:"source"`
	Target string  `json:"target"`
	Value  float64 `json:"value"`
}

type tableRow struct {
	Key    string                     `json:"key"`
	Label  *string                    `json:"label"`
	Values map[string]json.RawMessage `json:"values"`
	Text   json.RawMessage            `json:"text"`
}

// resultLines is a chart's result as lines of text: what a series came to,
// a table's rows, a funnel's steps. A rate or a stock reads its latest
// value, anything else its total. No lines means nothing to say.
func resultLines(of chart, raw json.RawMessage, currency string) []string {
	var result chartResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil
	}
	name := func(key string, label *string) string {
		if named, ok := of.Labels[key]; ok {
			return named
		}
		return firstOf(key, label)
	}
	count := func(value float64) string { return formatChartNumber(&value, "count", "") }
	format := func(value float64) string { return formatChartNumber(&value, result.Unit, currency) }
	offset := func(index int) string {
		if index < len(result.Offsets) {
			return reports.FormatNumber(result.Offsets[index], 2)
		}
		return "?"
	}
	var lines []string
	switch result.Shape {
	case "series":
		adds := result.Unit == "count" || result.Unit == "money"
		for _, item := range result.Series {
			var shown *float64
			total := 0.0
			for _, value := range item.Values {
				if value != nil {
					shown = value
					total += *value
				}
			}
			suffix := ", latest"
			if adds {
				shown, suffix = &total, " in total"
			}
			lines = append(lines, name(item.Key, item.Label)+": "+formatChartNumber(shown, result.Unit, currency)+suffix)
		}
	case "table":
		var rows []tableRow
		var columns []struct{ Key, Unit string }
		_ = json.Unmarshal(result.Rows, &rows)
		_ = json.Unmarshal(result.Columns, &columns)
		for _, row := range rows[:min(textRows, len(rows))] {
			cells := []string{name(row.Key, row.Label)}
			for _, field := range reports.OrderedFields(row.Text) {
				var text string
				_ = json.Unmarshal(field.Value, &text)
				cells = append(cells, name(field.Key, nil)+" "+text)
			}
			for _, column := range columns {
				var value *float64
				_ = json.Unmarshal(row.Values[column.Key], &value)
				cells = append(cells, name(column.Key, nil)+" "+formatChartNumber(value, column.Unit, currency))
			}
			lines = append(lines, strings.Join(cells, ", "))
		}
		if len(rows) > textRows || result.IsTruncated {
			lines = append(lines, "Only the first rows are shown; --json has every row the API returned.")
		}
	case "funnel":
		for _, step := range result.Steps {
			lines = append(lines, name(step.Key, step.Label)+": "+count(step.Count))
		}
	case "cohorts":
		for _, item := range result.Cohorts[:min(textRows, len(result.Cohorts))] {
			var cells []string
			for index, value := range item.Values {
				if value != nil {
					cells = append(cells, fmt.Sprintf("%s %s %s", result.Period, offset(index), format(*value)))
				}
			}
			lines = append(lines, fmt.Sprintf("%s (%s): %s", day(item.Start), count(item.Size), strings.Join(cells, ", ")))
		}
	case "curves":
		for _, item := range result.Series {
			last := -1
			for index, value := range item.Values {
				if value != nil {
					last = index
				}
			}
			if last < 0 {
				lines = append(lines, name(item.Key, item.Label)+": no data yet")
				continue
			}
			lines = append(lines, fmt.Sprintf("%s: %s at %s %s, from %s", name(item.Key, item.Label), format(*item.Values[last]), result.Axis, offset(last), count(item.Size)))
		}
	case "histogram":
		lines = append(lines, "Median "+formatChartNumber(result.Median, result.Unit, currency)+" of "+count(result.Total))
		for _, bin := range result.Bins {
			if bin.Count == 0 {
				continue
			}
			upTo := " and up"
			if bin.Upper != nil {
				upTo = " to " + format(*bin.Upper)
			}
			lines = append(lines, format(bin.Lower)+upTo+": "+count(bin.Count))
		}
	case "heatmap":
		var rows, columns []string
		_ = json.Unmarshal(result.Rows, &rows)
		_ = json.Unmarshal(result.Columns, &columns)
		type cell struct {
			at    string
			value float64
		}
		var cells []cell
		for rowIndex, row := range rows {
			for columnIndex, column := range columns {
				value := 0.0
				if rowIndex < len(result.Values) && columnIndex < len(result.Values[rowIndex]) {
					value = result.Values[rowIndex][columnIndex]
				}
				cells = append(cells, cell{row + " " + column, value})
			}
		}
		slices.SortStableFunc(cells, func(a, b cell) int { return compareDescending(a.value, b.value) })
		for _, item := range cells[:min(5, len(cells))] {
			if item.value > 0 {
				lines = append(lines, item.at+": "+format(item.value))
			}
		}
	case "flow":
		labels := map[string]string{}
		for _, node := range result.Nodes {
			labels[node.Key] = firstOf(node.Key, node.Label)
		}
		labelOf := func(key string) string {
			if label, ok := labels[key]; ok {
				return label
			}
			return key
		}
		links := slices.Clone(result.Links)
		slices.SortStableFunc(links, func(a, b flowLink) int { return compareDescending(a.Value, b.Value) })
		for _, link := range links[:min(textRows, len(links))] {
			lines = append(lines, labelOf(link.Source)+" to "+labelOf(link.Target)+": "+count(link.Value))
		}
	case "stats":
		for _, stat := range result.Stats {
			line := name(stat.Key, nil) + ": " + formatChartNumber(stat.Value, stat.Unit, currency)
			// A stat without a comparison has no `previous` at all; one that
			// had nothing to compare with has null.
			if stat.Previous != nil {
				var previous *float64
				_ = json.Unmarshal(stat.Previous, &previous)
				line += ", was " + formatChartNumber(previous, stat.Unit, currency)
			}
			lines = append(lines, line)
		}
	case "points":
		for _, point := range result.Points[:min(textRows, len(result.Points))] {
			lines = append(lines, firstOf(point.Key, point.Label)+": "+format(point.Value))
		}
	}
	return lines
}

func compareDescending(a, b float64) int {
	switch {
	case a > b:
		return -1
	case a < b:
		return 1
	}
	return 0
}
