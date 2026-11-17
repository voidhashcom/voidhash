package location

import (
	"fmt"
	"slices"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

// condition is one thing a rule asks of an end user, as the API names it.
type condition struct {
	Attribute string   `json:"attribute"`
	Key       *string  `json:"key"`
	Op        string   `json:"op"`
	Values    []string `json:"values"`
}

// What --when compares, as it is typed; a trait is trait:<key>.
var conditionAttributes = []string{"platform", "app_version", "os_version", "country", "locale"}

// How --when compares, as it is typed (in words or signs) and as the API
// names it. A longer spelling comes before one it starts with.
var conditionOperators = [][2]string{
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
func parseCondition(input string) (condition, error) {
	refuse := func(format string, args ...any) (condition, error) {
		return condition{}, cli.Usagef(format, args...).WithHint(whenHint)
	}
	words := strings.Fields(input)
	what := ""
	if len(words) > 0 {
		what = words[0]
	}
	how := strings.Join(words[min(1, len(words)):], " ")
	parsed := condition{Attribute: strings.ToLower(what), Values: []string{}}
	if strings.HasPrefix(parsed.Attribute, "trait:") {
		key := what[len("trait:"):]
		if key == "" {
			return refuse("--when '%s' names no trait: write trait:<key>, such as trait:plan.", input)
		}
		parsed.Attribute, parsed.Key = "trait", &key
	} else if !slices.Contains(conditionAttributes, parsed.Attribute) {
		return refuse("--when '%s' compares %q, which is not something a rule can ask.", input, what)
	}
	if strings.HasPrefix(how, "<=") || (strings.HasPrefix(how, ">") && !strings.HasPrefix(how, ">=")) {
		return refuse("--when '%s' compares with a sign a rule does not take: use >= (that version or newer) or < (older than it).", input)
	}
	lower := strings.ToLower(how)
	for _, operator := range conditionOperators {
		typed := operator[0]
		// A sign may touch its value (">=2.4"); a word is followed by a space or ends the condition.
		isSign := typed == ">=" || typed == "<"
		if (isSign && strings.HasPrefix(how, typed)) || (!isSign && (lower == typed || strings.HasPrefix(lower, typed+" "))) {
			parsed.Op = operator[1]
			for _, value := range strings.Split(how[len(typed):], ",") {
				if value = strings.TrimSpace(value); value != "" {
					parsed.Values = append(parsed.Values, value)
				}
			}
			return parsed, nil
		}
	}
	return refuse("--when '%s' does not say how to compare %s.", input, what)
}

var conditionSubjects = map[string]string{
	"platform":    "platform",
	"app_version": "app version",
	"os_version":  "OS version",
	"country":     "country",
	"locale":      "locale",
}

// describeCondition is a condition in words: "country is DE or AT", "app
// version is 2.4 or newer".
func describeCondition(asked condition) string {
	subject := conditionSubjects[asked.Attribute]
	if asked.Attribute == "trait" {
		subject = "trait ?"
		if asked.Key != nil {
			subject = "trait " + *asked.Key
		}
	} else if subject == "" {
		subject = asked.Attribute
	}
	first := "?"
	if len(asked.Values) > 0 {
		first = asked.Values[0]
	}
	switch asked.Op {
	case "in":
		return subject + " is " + strings.Join(asked.Values, " or ")
	case "not_in":
		return subject + " is not " + strings.Join(asked.Values, " or ")
	case "gte":
		return subject + " is " + first + " or newer"
	case "lt":
		return subject + " is older than " + first
	case "is_set":
		return subject + " is set"
	case "is_not_set":
		return subject + " is not set"
	}
	return fmt.Sprintf("%s %s %s", subject, asked.Op, strings.Join(asked.Values, ", "))
}

func describeConditions(asked []condition) string {
	described := make([]string, len(asked))
	for index, one := range asked {
		described[index] = describeCondition(one)
	}
	return strings.Join(described, " and ")
}

// identity names one end user: by person id, distinct id or email.
type identity struct {
	Type  string
	Value string
}

// parseIdentity reads an end user identity: a typed prefix, a person id, an
// email, or else a distinct id.
func parseIdentity(input string) identity {
	kind, value := paywalls.IdentityPrefix(input, "person_id", "distinct_id", "email", "external_id")
	switch {
	case kind != "":
		return identity{Type: kind, Value: value}
	case strings.HasPrefix(value, "person_"):
		return identity{Type: "person_id", Value: value}
	case strings.Contains(value, "@"):
		return identity{Type: "email", Value: value}
	}
	return identity{Type: "distinct_id", Value: value}
}

// identityLabel is "email ada@example.com", "distinct id user-42".
func identityLabel(kind, value string) string {
	return strings.Replace(kind, "_", " ", 1) + " " + value
}
