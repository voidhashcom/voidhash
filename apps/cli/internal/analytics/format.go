package reports

import (
	"bytes"
	"encoding/json"
	"math"
	"strconv"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// roundHalfUp rounds to the nearest whole number, halves toward positive
// infinity.
func roundHalfUp(value float64) float64 { return math.Floor(value + 0.5) }

// FormatNumber is a number as people read it, with thousands separators and
// at most maxFractionDigits decimals, trailing zeros dropped: 12,345.5.
func FormatNumber(value float64, maxFractionDigits int) string {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return "-"
	}
	// Halves round away from zero, as people expect of 3.25 at one decimal.
	scale := math.Pow10(maxFractionDigits)
	text := strconv.FormatFloat(math.Round(math.Abs(value)*scale)/scale, 'f', maxFractionDigits, 64)
	whole, fraction, _ := strings.Cut(text, ".")
	fraction = strings.TrimRight(fraction, "0")
	var out strings.Builder
	if value < 0 && (strings.Trim(whole, "0") != "" || fraction != "") {
		out.WriteByte('-')
	}
	for index, digit := range whole {
		if index > 0 && (len(whole)-index)%3 == 0 {
			out.WriteByte(',')
		}
		out.WriteRune(digit)
	}
	if fraction != "" {
		out.WriteString("." + fraction)
	}
	return out.String()
}

// FormatCount is a count as people read it: "12,345".
func FormatCount(value float64) string { return FormatNumber(value, 2) }

// FormatRate is a decimal rate as a percentage: 0.0125 is "1.25%"; "-" for
// none.
func FormatRate(rate *float64) string {
	if rate == nil {
		return "-"
	}
	return FormatCount(roundHalfUp(*rate*10_000)/100) + "%"
}

// FormatRoas is a return on spend, such as "1.49x"; "-" for none.
func FormatRoas(roas *float64) string {
	if roas == nil {
		return "-"
	}
	return strconv.FormatFloat(roundHalfUp(*roas*100)/100, 'f', 2, 64) + "x"
}

// FormatChange is the relative change from previous to current: "+12.5%",
// "no change", or "-" when there is nothing to compare with.
func FormatChange(current, previous float64) string {
	if previous == 0 {
		if current == 0 {
			return "no change"
		}
		return "-"
	}
	change := roundHalfUp((current-previous)/math.Abs(previous)*1000) / 10
	sign := ""
	if change > 0 {
		sign = "+"
	}
	return sign + FormatCount(change) + "%"
}

// FormatMoney is an amount in minor units of currency as people read it.
// Reports carry amounts as numbers that may hold a fraction of a minor
// unit, such as an average; it is rounded.
func FormatMoney(amount float64, currency string) string {
	return cli.FormatMoney(int64(math.Round(amount)), currency)
}

// Body is the JSON body of a report request. Fields that were not passed
// are left out, so the API applies its own defaults.
type Body map[string]any

// Text sets key to value when value is not empty.
func (b Body) Text(key, value string) Body {
	if value != "" {
		b[key] = value
	}
	return b
}

// Reader is the body encoded, to send with an operation's WithBody variant.
func (b Body) Reader() *bytes.Reader {
	// A map of strings, numbers, booleans and their lists always encodes.
	encoded, _ := json.Marshal(b)
	return bytes.NewReader(encoded)
}

// ContentType is the content type of a [Body].
const ContentType = "application/json"

// JSONField is one field of a JSON object, with its value as it was sent.
type JSONField struct {
	Key   string
	Value json.RawMessage
}

// OrderedFields is the fields of a JSON object in the order the server sent
// them, which a Go map would lose. It is empty for anything that is not an
// object.
func OrderedFields(object json.RawMessage) []JSONField {
	decoder := json.NewDecoder(bytes.NewReader(object))
	if opening, err := decoder.Token(); err != nil || opening != json.Delim('{') {
		return nil
	}
	var fields []JSONField
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			return fields
		}
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			return fields
		}
		name, _ := key.(string)
		fields = append(fields, JSONField{Key: name, Value: value})
	}
	return fields
}
