package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// OutputMode is how a command prints its result.
type OutputMode int

const (
	// Human prints aligned tables and short summaries for people.
	Human OutputMode = iota
	// JSON prints the API objects, the stable shape for scripts.
	JSON
	// Quiet prints only ids, one per line, for piping into another command.
	Quiet
)

// Style renders text styles. Every function returns its text unchanged when
// the stream is not a terminal, NO_COLOR is set or --no-color was passed.
type Style struct {
	Bold, Dim, Green, Yellow, Red, Cyan func(text string) string
}

func makeStyle(enabled bool) Style {
	ansi := func(code int) func(string) string {
		if !enabled {
			return func(text string) string { return text }
		}
		return func(text string) string { return fmt.Sprintf("\x1b[%dm%s\x1b[0m", code, text) }
	}
	return Style{Bold: ansi(1), Dim: ansi(2), Green: ansi(32), Yellow: ansi(33), Red: ansi(31), Cyan: ansi(36)}
}

func (a *App) colorAllowed() bool {
	return !a.NoColor && a.Getenv("NO_COLOR") == "" && a.Getenv("TERM") != "dumb"
}

// Style is the [Style] for standard output.
func (a *App) Style() Style { return makeStyle(a.StdoutTTY && a.colorAllowed()) }

// ErrStyle is the [Style] for standard error.
func (a *App) ErrStyle() Style { return makeStyle(a.StderrTTY && a.colorAllowed()) }

// Printable is text from the server without control characters, or the
// characters that reorder text, so it cannot move the cursor, change what
// the terminal shows or hand the terminal commands. Names, emails and
// distinct ids come from the end users of an app, so anything the CLI shows
// people passes through this. [PrintTable], [FormatFields] and [PrintItem]
// apply it themselves.
func Printable(text string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || (r >= 0x202A && r <= 0x202E) || (r >= 0x2066 && r <= 0x2069) {
			return -1
		}
		return r
	}, text)
}

// PrintableLines is [Printable] text that keeps its line breaks, for a
// message of several lines.
func PrintableLines(text string) string {
	lines := strings.Split(text, "\n")
	for index, line := range lines {
		lines[index] = Printable(line)
	}
	return strings.Join(lines, "\n")
}

// rawJSON is implemented by what the API helpers return: [Object], [List]
// and [Session] carry the server's JSON as it was sent.
type rawJSON interface {
	RawJSON() json.RawMessage
}

// PrintJSON prints value as JSON indented by two spaces. An [Object], a
// [List] or a [Session] prints the server's JSON as it was sent, with its
// key order and nulls; anything else is encoded, with <, > and & left as
// they are: the output is read in a terminal and by scripts, not in HTML.
func (a *App) PrintJSON(value any) error {
	var raw []byte
	if carrier, ok := value.(rawJSON); ok {
		raw = carrier.RawJSON()
	} else {
		var encoded bytes.Buffer
		encoder := json.NewEncoder(&encoded)
		encoder.SetEscapeHTML(false)
		if err := encoder.Encode(value); err != nil {
			return err
		}
		raw = bytes.TrimSuffix(encoded.Bytes(), []byte("\n"))
	}
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return err
	}
	a.Println(out.String())
	return nil
}

// identified is implemented by [Object] and [List].
type identified interface {
	IDs() []string
}

// PrintIDs prints the ids of an [Object] or a [List], one per line, for
// --quiet. Nothing is printed for an empty list.
func (a *App) PrintIDs(value interface{ IDs() []string }) {
	for _, id := range value.IDs() {
		a.Println(id)
	}
}

// Column is a table column: its header and each row's cell.
type Column[T any] struct {
	Header string
	Cell   func(item T) string
}

// FormatTable lays items out as rows under columns, each padded to its
// widest cell. Cells are [Printable], since they show what end users and
// teammates named things. bold styles the header row.
func FormatTable[T any](columns []Column[T], items []T, bold func(string) string) string {
	rows := make([][]string, 0, len(items)+1)
	header := make([]string, len(columns))
	for index, column := range columns {
		header[index] = column.Header
	}
	rows = append(rows, header)
	for _, item := range items {
		row := make([]string, len(columns))
		for index, column := range columns {
			row[index] = Printable(column.Cell(item))
		}
		rows = append(rows, row)
	}
	lines := alignRows(rows)
	if bold != nil {
		lines[0] = bold(lines[0])
	}
	return strings.Join(lines, "\n")
}

// FormatRows lays rows out in columns without a header, each padded to its
// widest cell, for a short list inside a [Field] value, such as the
// variants of a flag. Cells are [Printable].
func FormatRows(rows [][]string) string {
	printable := make([][]string, len(rows))
	for index, row := range rows {
		printable[index] = make([]string, len(row))
		for cell, text := range row {
			printable[index][cell] = Printable(text)
		}
	}
	return strings.Join(alignRows(printable), "\n")
}

func alignRows(rows [][]string) []string {
	var widths []int
	for _, row := range rows {
		for index, cell := range row {
			if index == len(widths) {
				widths = append(widths, 0)
			}
			widths[index] = max(widths[index], utf8.RuneCountInString(cell))
		}
	}
	lines := make([]string, len(rows))
	for rowIndex, row := range rows {
		var line strings.Builder
		for index, cell := range row {
			if index > 0 {
				line.WriteString("  ")
			}
			line.WriteString(cell)
			line.WriteString(strings.Repeat(" ", widths[index]-utf8.RuneCountInString(cell)))
		}
		lines[rowIndex] = strings.TrimRight(line.String(), " ")
	}
	return lines
}

// PrintTable prints items as a table for people, with a bold header on a
// terminal, or empty when there are none; say there how to create the first
// one.
func PrintTable[T any](a *App, columns []Column[T], items []T, empty string) {
	if len(items) == 0 {
		a.Println(PrintableLines(empty))
		return
	}
	a.Println(FormatTable(columns, items, a.Style().Bold))
}

// PrintItem prints one object the way mode asks: human for people, as
// [Printable] lines; the object as JSON; or its id.
func (a *App) PrintItem(mode OutputMode, item interface {
	rawJSON
	identified
}, human string) error {
	switch mode {
	case JSON:
		return a.PrintJSON(item)
	case Quiet:
		a.PrintIDs(item)
	default:
		a.Println(PrintableLines(human))
	}
	return nil
}

// Field is one line of a [FormatFields] summary.
type Field struct {
	Label string
	Value string
}

// FormatFields lays out `label  value` lines with the values aligned, for a
// summary of one object. A value of several lines continues under itself;
// each line is [Printable].
func FormatFields(fields []Field) string {
	width := 0
	for _, field := range fields {
		width = max(width, utf8.RuneCountInString(field.Label))
	}
	var lines []string
	for _, field := range fields {
		for index, line := range strings.Split(field.Value, "\n") {
			label := ""
			if index == 0 {
				label = field.Label
			}
			padding := strings.Repeat(" ", width-utf8.RuneCountInString(label))
			lines = append(lines, strings.TrimRight("  "+label+padding+"  "+Printable(line), " "))
		}
	}
	return strings.Join(lines, "\n")
}

func parseTime(iso string) (time.Time, bool) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, iso); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

// FormatDate is an ISO time as people read it, in the time zone loc: "Oct
// 28, 2026, 2:05 PM". Text that is not a time is returned as it is.
// [App.FormatDate] uses the person's time zone.
func FormatDate(iso string, loc *time.Location) string {
	parsed, ok := parseTime(iso)
	if !ok {
		return iso
	}
	return parsed.In(loc).Format("Jan 2, 2006, 3:04 PM")
}

// FormatTimeAgo says how long before now an ISO time was: "just now", "5
// minutes ago", "3 days ago", or the date once it is a month old.
// [App.FormatTimeAgo] uses the run's clock and time zone.
func FormatTimeAgo(iso string, now time.Time, loc *time.Location) string {
	parsed, ok := parseTime(iso)
	if !ok {
		return iso
	}
	elapsed := now.Sub(parsed)
	count := func(unit time.Duration, name string) string {
		amount := int(elapsed / unit)
		if amount == 1 {
			return "1 " + name + " ago"
		}
		return strconv.Itoa(amount) + " " + name + "s ago"
	}
	const day = 24 * time.Hour
	switch {
	case elapsed < time.Minute:
		return "just now"
	case elapsed < time.Hour:
		return count(time.Minute, "minute")
	case elapsed < day:
		return count(time.Hour, "hour")
	case elapsed < 30*day:
		return count(day, "day")
	default:
		return parsed.In(loc).Format("Jan 2, 2006")
	}
}

// FormatDate is [FormatDate] in the person's time zone.
func (a *App) FormatDate(iso string) string { return FormatDate(iso, a.Location) }

// FormatTimeAgo is [FormatTimeAgo] from the run's clock, in the person's
// time zone.
func (a *App) FormatTimeAgo(iso string) string { return FormatTimeAgo(iso, a.Now(), a.Location) }

// Currencies whose minor unit is not a hundredth (ISO 4217).
var currencyDecimals = map[string]int{
	"BIF": 0, "CLP": 0, "DJF": 0, "GNF": 0, "ISK": 0, "JPY": 0, "KMF": 0, "KRW": 0, "PYG": 0,
	"RWF": 0, "UGX": 0, "UYI": 0, "VND": 0, "VUV": 0, "XAF": 0, "XOF": 0, "XPF": 0,
	"BHD": 3, "IQD": 3, "JOD": 3, "KWD": 3, "LYD": 3, "OMR": 3, "TND": 3,
	"CLF": 4, "UYW": 4,
}

// The currencies written with a symbol in American English; the rest are
// written with their code.
var currencySymbols = map[string]string{
	"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "CAD": "CA$", "AUD": "A$", "NZD": "NZ$",
	"MXN": "MX$", "BRL": "R$", "CNY": "CN¥", "HKD": "HK$", "TWD": "NT$", "ILS": "₪", "INR": "₹",
	"KRW": "₩", "VND": "₫", "PHP": "₱", "XAF": "FCFA", "XOF": "F CFA", "XPF": "CFPF", "XCD": "EC$",
}

// CurrencyDecimals is how many decimals the ISO 4217 currency's minor unit
// takes: 2 for USD, 0 for JPY, 3 for KWD.
func CurrencyDecimals(currency string) int {
	if decimals, ok := currencyDecimals[strings.ToUpper(currency)]; ok {
		return decimals
	}
	return 2
}

// FormatMoney is an amount of money as people read it: amount minor units
// (cents for USD, yen for JPY) of the ISO 4217 currency, so
// FormatMoney(999, "USD") is "$9.99" and FormatMoney(1234500, "CZK") is
// "CZK 12,345.00".
func FormatMoney(amount int64, currency string) string {
	currency = strings.ToUpper(currency)
	decimals, ok := currencyDecimals[currency]
	if !ok {
		decimals = 2
	}
	negative := amount < 0
	magnitude := uint64(amount)
	if negative {
		magnitude = uint64(-amount)
	}
	scale := uint64(math.Pow10(decimals))
	whole := strconv.FormatUint(magnitude/scale, 10)
	var grouped strings.Builder
	for index, digit := range whole {
		if index > 0 && (len(whole)-index)%3 == 0 {
			grouped.WriteByte(',')
		}
		grouped.WriteRune(digit)
	}
	number := grouped.String()
	if decimals > 0 {
		number += fmt.Sprintf(".%0*d", decimals, magnitude%scale)
	}
	symbol, ok := currencySymbols[currency]
	if !ok {
		symbol = currency + " "
	}
	if negative {
		return "-" + symbol + number
	}
	return symbol + number
}
