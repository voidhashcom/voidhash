package flag

import (
	"bytes"
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/flags"
)

// What people type on the command line, read into what the API takes: a
// share of end users, a variant's value, who an end user is, a rule's
// condition, and a rule's id.

// parsePercent reads a share of end users: "25%", "25" or "12.5", kept to
// two decimals.
func parsePercent(input string) (float64, error) {
	text := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(input), "%"))
	value, err := strconv.ParseFloat(text, 64)
	// The comparison also refuses NaN, which is neither.
	if err != nil || !(value >= 0 && value <= 100) {
		return 0, cli.Usagef("%q is not a share of end users.", input).
			WithHint("Give a percentage from 0 to 100, such as 25%.")
	}
	return math.Round(value*100) / 100, nil
}

// parseValue reads a variant value as the flag's type needs it, as the JSON
// the API stores: a number for a number flag, any JSON for a json flag, and
// the text itself otherwise.
func parseValue(flagType, input string) (json.RawMessage, error) {
	switch flagType {
	case "number":
		value, err := strconv.ParseFloat(strings.TrimSpace(input), 64)
		if err != nil || math.IsInf(value, 0) || math.IsNaN(value) {
			return nil, cli.Usagef("%q is not a number.", input).WithHint("A number flag's variants are numbers.")
		}
		return json.Marshal(value)
	case "json":
		if !json.Valid([]byte(input)) {
			return nil, cli.Usagef("%q is not JSON.", input).
				WithHint(`Quote it for your shell, such as '{"color":"blue"}'.`)
		}
		return json.RawMessage(strings.TrimSpace(input)), nil
	default:
		return marshalPlain(input), nil
	}
}

// marshalPlain is JSON as people read it: without the escapes that only
// matter inside HTML.
func marshalPlain(value any) json.RawMessage {
	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return json.RawMessage("null")
	}
	return bytes.TrimSpace(out.Bytes())
}

// formatValue is a variant's value on one line, in one spelling whatever
// the spacing, number format or key order it was written with, so two
// values can be compared by it.
func formatValue(value json.RawMessage) string {
	if len(bytes.TrimSpace(value)) == 0 {
		return "null"
	}
	var decoded any
	if err := json.Unmarshal(value, &decoded); err != nil {
		return string(value)
	}
	return string(marshalPlain(decoded))
}

type identity struct {
	Type  string
	Value string
}

var prefixedIdentity = regexp.MustCompile(`^(person_id|distinct_id|email|external_id):(.+)$`)

// parseIdentity reads who an end user is: a typed prefix says it; without
// one a person id, an email, or else a distinct id.
func parseIdentity(input string) identity {
	value := strings.TrimSpace(input)
	if match := prefixedIdentity.FindStringSubmatch(value); match != nil {
		return identity{Type: match[1], Value: match[2]}
	}
	switch {
	case strings.HasPrefix(value, "person_"):
		return identity{Type: "person_id", Value: value}
	case strings.Contains(value, "@"):
		return identity{Type: "email", Value: value}
	default:
		return identity{Type: "distinct_id", Value: value}
	}
}

// segment is the identity as the override routes take it in their path. The
// API client escapes it.
func (i identity) segment() string { return i.Type + ":" + i.Value }

// label is the identity as messages name it: "distinct id device-1".
func (i identity) label() string { return identityLabel(i.Type, i.Value) }

func identityLabel(identityType, value string) string {
	return strings.Replace(identityType, "_", " ", 1) + " " + value
}

// What --when compares, as it is typed; a trait is trait:<key>.
var conditionAttributes = []string{"platform", "app_version", "os_version", "country", "locale"}

// How --when compares, as it is typed (in words or signs) and as the API
// names it. The order matters: the longer of two that start alike is first.
var conditionOperators = []struct{ typed, op string }{
	{"is not set", "is_not_set"},
	{"is_not_set", "is_not_set"},
	{"is set", "is_set"},
	{"is_set", "is_set"},
	{"not in", "not_in"},
	{"not_in", "not_in"},
	{"in", "in"},
	{">=", "gte"},
	{"gte", "gte"},
	{"<", "lt"},
	{"lt", "lt"},
}

const whenHint = "Write it as '<what> <how> [<values>]': what is platform, app_version, os_version, country, locale or trait:<key>; how is in, not in, >=, <, is set or is not set; values are separated by commas. Such as 'country in DE,AT', 'app_version >= 2.4' or 'trait:beta is set'."

// parseCondition reads a --when condition, such as "country in DE,AT" or
// "trait:plan is set". Only its shape is read here; the API says what a
// condition's values must be.
func parseCondition(input string) (flags.Condition, error) {
	refuse := func(format string, args ...any) (flags.Condition, error) {
		return flags.Condition{}, cli.Usagef(format, args...).WithHint(whenHint)
	}
	what, how := "", ""
	if fields := strings.Fields(input); len(fields) > 0 {
		what, how = fields[0], strings.Join(fields[1:], " ")
	}
	isTrait := strings.HasPrefix(strings.ToLower(what), "trait:")
	condition := flags.Condition{Values: []string{}}
	if isTrait {
		key := what[len("trait:"):]
		if key == "" {
			return refuse("--when '%s' names no trait: write trait:<key>, such as trait:plan.", input)
		}
		condition.Attribute, condition.Key = "trait", &key
	} else {
		for _, candidate := range conditionAttributes {
			if candidate == strings.ToLower(what) {
				condition.Attribute = candidate
			}
		}
		if condition.Attribute == "" {
			return refuse("--when '%s' compares %q, which is not something a rule can ask.", input, what)
		}
	}
	if strings.HasPrefix(how, "<=") || (strings.HasPrefix(how, ">") && !strings.HasPrefix(how, ">=")) {
		return refuse("--when '%s' compares with a sign a rule does not take: use >= (that version or newer) or < (older than it).", input)
	}
	lower := strings.ToLower(how)
	for _, operator := range conditionOperators {
		// A sign may touch its value (">=2.4"); a word is followed by a space or ends the condition.
		isSign := strings.Trim(operator.typed, "<>=") == ""
		if isSign && !strings.HasPrefix(how, operator.typed) {
			continue
		}
		if !isSign && lower != operator.typed && !strings.HasPrefix(lower, operator.typed+" ") {
			continue
		}
		condition.Op = operator.op
		for _, value := range strings.Split(how[len(operator.typed):], ",") {
			if value = strings.TrimSpace(value); value != "" {
				condition.Values = append(condition.Values, value)
			}
		}
		return condition, nil
	}
	return refuse("--when '%s' does not say how to compare %s.", input, what)
}

var notSlug = regexp.MustCompile(`[^a-z0-9]+`)

// ruleIDFor makes a rule's id from its name, such as "beta-testers", or
// from its place in the list when it has none.
func ruleIDFor(name string, position int) string {
	slug := strings.Trim(notSlug.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if len(slug) > 48 {
		slug = slug[:48]
	}
	if slug == "" {
		return "rule-" + strconv.Itoa(position)
	}
	return slug
}
