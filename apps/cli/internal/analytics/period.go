// Package reports holds what the events, insights, analytics and ads
// commands share: the period a report covers, how its numbers read, and the
// request bodies reports are asked for with.
//
// A period is a range of whole calendar days. `--last 30d` is the 30
// complete days before today, since today is still accruing; `--from` and
// `--to` name an explicit range whose end defaults to today. "Today" is the
// date in the report's time zone.
package reports

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

const dayLayout = "2006-01-02"

// Period is the calendar days From to To (YYYY-MM-DD, inclusive), and how
// the period was said: "last 30 days".
type Period struct {
	From  string
	To    string
	Label string
}

func parseDay(day string) time.Time {
	parsed, _ := time.Parse(dayLayout, day)
	return parsed
}

// IsDay reports whether day is a real YYYY-MM-DD date (not 2026-02-30).
func IsDay(day string) bool {
	_, err := time.Parse(dayLayout, day)
	return err == nil && len(day) == len(dayLayout)
}

// AddDays is day moved by days calendar days.
func AddDays(day string, days int) string {
	return parseDay(day).AddDate(0, 0, days).Format(dayLayout)
}

// addMonths is day moved by months calendar months, the day of the month
// clamped to the target month: a month before March 31 is the last day of
// February.
func addMonths(day string, months int) string {
	from := parseDay(day)
	first := time.Date(from.Year(), from.Month()+time.Month(months), 1, 0, 0, 0, 0, time.UTC)
	lastDay := first.AddDate(0, 1, -1).Day()
	return first.AddDate(0, 0, min(from.Day(), lastDay)-1).Format(dayLayout)
}

// DaysIn is the number of days of a period, both ends included.
func DaysIn(period Period) int {
	return int(parseDay(period.To).Sub(parseDay(period.From)).Hours()/24+0.5) + 1
}

// PreviousPeriod is the days of the same length that end the day before
// period starts.
func PreviousPeriod(period Period) Period {
	return Period{From: AddDays(period.From, -DaysIn(period)), To: AddDays(period.From, -1)}
}

// DefaultGranularity is the bucket width that keeps a series of days
// readable when the command names none: by day up to a quarter (92 days),
// by week up to a year (366 days), then by month.
func DefaultGranularity(days int) string {
	switch {
	case days <= 92:
		return "day"
	case days <= 366:
		return "week"
	default:
		return "month"
	}
}

// TodayIn is the date of now in timezone, an IANA name such as
// Europe/Prague; in UTC when the zone is empty or not known.
func TodayIn(now time.Time, timezone string) string {
	location := time.UTC
	if timezone != "" {
		if loaded, err := time.LoadLocation(timezone); err == nil {
			location = loaded
		}
	}
	return now.In(location).Format(dayLayout)
}

// spanUnits maps every spelling of a unit `--last` takes to its letter.
var spanUnits = map[string]byte{
	"d": 'd', "day": 'd', "days": 'd',
	"w": 'w', "week": 'w', "weeks": 'w',
	"m": 'm', "mo": 'm', "month": 'm', "months": 'm',
	"y": 'y', "year": 'y', "years": 'y',
}

var spanNames = map[byte]string{'d': "day", 'w': "week", 'm': "month", 'y': "year"}

// LastSpan is the days `--last <span>` names, ending yesterday: 7d, 4w, 3m
// or 1y, also spelled out ("4 weeks"). ok is false when span is not a span.
// A month or a year goes back to the same day of the month, clamped to a
// shorter month.
func LastSpan(span, today string) (period Period, ok bool) {
	text := strings.ToLower(strings.TrimSpace(span))
	digits := 0
	for digits < len(text) && text[digits] >= '0' && text[digits] <= '9' {
		digits++
	}
	if digits < 1 || digits > 4 {
		return Period{}, false
	}
	count, _ := strconv.Atoi(text[:digits])
	unit, known := spanUnits[strings.TrimLeft(text[digits:], " \t")]
	if !known || count < 1 {
		return Period{}, false
	}
	var from string
	switch unit {
	case 'd':
		from = AddDays(today, -count)
	case 'w':
		from = AddDays(today, -7*count)
	case 'm':
		from = addMonths(today, -count)
	default:
		from = addMonths(today, -12*count)
	}
	name := spanNames[unit]
	if count != 1 {
		name += "s"
	}
	return Period{From: from, To: AddDays(today, -1), Label: fmt.Sprintf("last %d %s", count, name)}, true
}

// PeriodFlags are --last, --from and --to, the period flags every report
// takes.
type PeriodFlags struct {
	Last string
	From string
	To   string

	defaultLast string
}

// AddPeriodFlags adds --last, --from and --to to a report. defaultLast is
// the span reported on when none is passed, such as "30d".
func AddPeriodFlags(cmd *cobra.Command, defaultLast string) *PeriodFlags {
	flags := &PeriodFlags{defaultLast: defaultLast}
	cmd.Flags().StringVar(&flags.Last, "last", "", fmt.Sprintf("The complete days before today to report on: a `span` such as 7d, 4w, 3m or 1y (default: %s)", defaultLast))
	cmd.Flags().StringVar(&flags.From, "from", "", "First `day` to report on, YYYY-MM-DD (instead of --last)")
	cmd.Flags().StringVar(&flags.To, "to", "", "Last `day` to report on, YYYY-MM-DD (default: today; with --from)")
	return flags
}

const periodHint = "Pass --last 30d (or 7d, 4w, 3m, 1y), or --from YYYY-MM-DD [--to YYYY-MM-DD]."

// Period is the days the flags name, with today in the report's time zone
// (see [TodayIn]): --last, else --from and --to, else the default span. A
// combination or value that names no days is a usage error saying what to
// pass.
func (f *PeriodFlags) Period(today string) (Period, error) {
	usage := func(format string, args ...any) (Period, error) {
		return Period{}, cli.Usagef(format, args...).WithHint(periodHint)
	}
	if f.Last != "" {
		if f.From != "" || f.To != "" {
			return usage("--last cannot be combined with --from or --to.")
		}
		period, ok := LastSpan(f.Last, today)
		if !ok {
			return usage("%q is not a span of days.", f.Last)
		}
		return period, nil
	}
	if f.From == "" {
		if f.To != "" {
			return usage("--to needs --from.")
		}
		period, ok := LastSpan(f.defaultLast, today)
		if !ok {
			return usage("%q is not a span of days.", f.defaultLast)
		}
		return period, nil
	}
	to := f.To
	if to == "" {
		to = today
	}
	switch {
	case !IsDay(f.From):
		return usage("--from %s is not a date.", f.From)
	case !IsDay(to):
		return usage("--to %s is not a date.", to)
	case to < f.From:
		return usage("--to %s is before --from %s.", to, f.From)
	}
	label := f.From + " to " + to
	if f.From == to {
		label = f.From
	}
	return Period{From: f.From, To: to, Label: label}, nil
}

const instantLayout = "2006-01-02T15:04:05.000Z"

// Instants is a day range as the instants insights and charts take: from
// the start of From to the end of To (UTC), but not past now.
func Instants(period Period, now time.Time) (start, end string) {
	last := parseDay(period.To).AddDate(0, 0, 1)
	if now.Before(last) {
		last = now
	}
	return period.From + "T00:00:00.000Z", last.UTC().Format(instantLayout)
}
