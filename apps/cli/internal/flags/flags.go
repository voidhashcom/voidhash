// Package flags holds what the `voidhash flag` and `voidhash experiment`
// commands share: a feature flag as the API sends it, how people name one,
// and how a share of end users reads.
package flags

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"strconv"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// Serve is what a share of end users gets: the share, and the variant when
// one is fixed for them.
type Serve struct {
	RolloutPercentage float64 `json:"rolloutPercentage"`
	VariantKey        *string `json:"variantKey"`
}

// Identity names one end user: by person id, distinct id, email or
// external id.
type Identity struct {
	IdentityType  string `json:"identityType"`
	IdentityValue string `json:"identityValue"`
}

// Override fixes a flag for one end user in an environment.
type Override struct {
	IdentityType  string  `json:"identityType"`
	IdentityValue string  `json:"identityValue"`
	IsEnabled     bool    `json:"isEnabled"`
	VariantKey    *string `json:"variantKey"`
	Note          *string `json:"note"`
}

// Condition is one thing a rule asks of an end user or their app.
type Condition struct {
	Attribute string   `json:"attribute"`
	Key       *string  `json:"key"`
	Op        string   `json:"op"`
	Values    []string `json:"values"`
}

// Rule says what the end users it matches get: those it names, and everyone
// all its conditions hold for.
type Rule struct {
	ID         string      `json:"id"`
	Name       *string     `json:"name"`
	Identities []Identity  `json:"identities"`
	Conditions []Condition `json:"conditions"`
	Serve      Serve       `json:"serve"`
}

// Environment is a flag's configuration in production or in test, read top
// to bottom: the switch, the overrides, the rules, then everyone else.
type Environment struct {
	IsEnabled   bool       `json:"isEnabled"`
	Overrides   []Override `json:"overrides"`
	Rules       []Rule     `json:"rules"`
	Fallthrough Serve      `json:"fallthrough"`
}

// Body is the environment as the API takes it whole: every list present,
// since a missing one would read as "none" only by accident.
func (e Environment) Body() Environment {
	body := e
	body.Overrides = append([]Override{}, e.Overrides...)
	body.Rules = make([]Rule, len(e.Rules))
	for index, rule := range e.Rules {
		rule.Identities = append([]Identity{}, rule.Identities...)
		conditions := make([]Condition, len(rule.Conditions))
		for at, condition := range rule.Conditions {
			condition.Values = append([]string{}, condition.Values...)
			conditions[at] = condition
		}
		rule.Conditions = conditions
		body.Rules[index] = rule
	}
	return body
}

// Environments are a flag's two configurations. Test is nil while it
// follows production.
type Environments struct {
	Production Environment  `json:"production"`
	Test       *Environment `json:"test"`
}

// Flag is a feature flag as the API sends it.
type Flag struct {
	ID           string       `json:"id"`
	Key          string       `json:"key"`
	Description  *string      `json:"description"`
	Type         string       `json:"type"`
	Environments Environments `json:"environments"`
	IsArchived   bool         `json:"isArchived"`
	ExperimentID *string      `json:"experimentId"`
}

// In is the configuration that decides in environment ("production" or
// "test"): test follows production until it has its own.
func (f Flag) In(environment string) Environment {
	if environment == "test" && f.Environments.Test != nil {
		return *f.Environments.Test
	}
	return f.Environments.Production
}

// Kind is how commands and messages name a feature flag: by its key or id.
var Kind = cli.ItemKind[Flag]{
	Noun:          "flag",
	ID:            func(flag Flag) string { return flag.ID },
	Label:         func(flag Flag) string { return flag.Key },
	ListCommand:   "voidhash flag list",
	CreateCommand: "voidhash flag create",
	Keys:          func(flag Flag) []string { return []string{flag.Key} },
}

// Percent is a share of end users as people read it: "25%", "12.5%".
func Percent(value float64) string {
	return strconv.FormatFloat(math.Round(value*100)/100, 'f', -1, 64) + "%"
}

// List reads the project's flags in use, or the archived ones.
func List(ctx context.Context, app *cli.App, projectID string, archived bool) (cli.List[Flag], error) {
	isArchived := api.FeatureFlagsListParamsIsArchived(strconv.FormatBool(archived))
	return cli.ListAll[Flag](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.FeatureFlagsList(ctx, projectID, &api.FeatureFlagsListParams{
			Cursor: page.Cursor, Limit: page.Limit, IsArchived: &isArchived,
		})
	})
}

// Concat is the items of first followed by those of second.
func Concat[T any](first, second cli.List[T]) cli.List[T] {
	return cli.List[T]{
		Items: append(append([]T{}, first.Items...), second.Items...),
		Raw:   append(append([]json.RawMessage{}, first.Raw...), second.Raw...),
	}
}

// RequireObject is [cli.RequireItem] for a command that also prints the
// item it found as the API sent it: it returns the item with its JSON.
func RequireObject[T any](ctx context.Context, app *cli.App, kind cli.ItemKind[T], list cli.List[T], input, usage string) (cli.Object[T], error) {
	found, err := cli.RequireItem(ctx, app, kind, list.Items, input, usage)
	if err != nil {
		return cli.Object[T]{}, err
	}
	for index, item := range list.Items {
		if kind.ID(item) == kind.ID(found) {
			return list.Object(index), nil
		}
	}
	return cli.NewObject(found), nil
}

// WithField is the JSON object with one more field at its end, for a
// command whose --json shows an API object together with what belongs to
// it. The object's own fields stay as the API sent them.
func WithField(object json.RawMessage, name string, value json.RawMessage) json.RawMessage {
	trimmed := bytes.TrimSpace(object)
	key, _ := json.Marshal(name)
	if len(trimmed) < 2 || trimmed[len(trimmed)-1] != '}' {
		return object
	}
	var out bytes.Buffer
	out.Write(bytes.TrimSpace(trimmed[:len(trimmed)-1]))
	if out.Len() > 1 {
		out.WriteByte(',')
	}
	out.Write(key)
	out.WriteByte(':')
	out.Write(value)
	out.WriteByte('}')
	return out.Bytes()
}
