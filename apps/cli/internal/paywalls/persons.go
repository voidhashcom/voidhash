package paywalls

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// How commands find the end user a person names. A project can hold millions
// of persons, so they are looked up exactly through the API's filters (id,
// distinct id, email) rather than listed and searched.

// Person is an end user of the project's apps.
type Person = api.PersonJsonEncoding

// PersonName is who a person is, as people say it: "Ada <ada@example.com>",
// or their distinct id. The app's end users chose these, so the text is
// [cli.Printable].
func PersonName(person Person) string {
	switch {
	case person.Name != nil && person.Email != nil:
		return cli.Printable(*person.Name + " <" + *person.Email + ">")
	case person.Name != nil:
		return cli.Printable(*person.Name)
	case person.Email != nil:
		return cli.Printable(*person.Email)
	default:
		return cli.Printable(person.DistinctId)
	}
}

// PersonKind is how messages call a person: "Ada <ada@example.com> (user-42)".
var PersonKind = cli.ItemKind[Person]{
	Noun: "person",
	ID:   func(person Person) string { return person.Id },
	Label: func(person Person) string {
		name, distinctID := PersonName(person), cli.Printable(person.DistinctId)
		if name == distinctID {
			return distinctID
		}
		return name + " (" + distinctID + ")"
	},
	ListCommand: "voidhash person list",
	Keys: func(person Person) []string {
		keys := []string{person.DistinctId}
		if person.Email != nil {
			keys = append(keys, *person.Email)
		}
		return keys
	},
	Names: func(person Person) []string {
		if person.Name == nil {
			return nil
		}
		return []string{*person.Name}
	},
}

// PersonsMatchedExactly says how persons are found, for the hint of a miss.
const PersonsMatchedExactly = "Persons are found by their exact email, distinct id or id; names and parts of an email cannot be searched. 'voidhash person list' shows the newest."

// NoPerson is the failure of naming a person nobody is.
func NoPerson(input string) *cli.UserError {
	return &cli.UserError{
		Message:  fmt.Sprintf("No person has the email, distinct id or id %q.", cli.Printable(strings.TrimSpace(input))),
		Hint:     PersonsMatchedExactly,
		ExitCode: cli.ExitNotFound,
	}
}

// IdentityPrefix splits a prefix that says what input is ("person_id:",
// "distinct_id:", "email:", and "external_id:" when allowed) from the rest.
// kind is empty when input has no such prefix.
func IdentityPrefix(input string, kinds ...string) (kind, value string) {
	value = strings.TrimSpace(input)
	for _, candidate := range kinds {
		if rest, ok := strings.CutPrefix(value, candidate+":"); ok && rest != "" {
			return candidate, rest
		}
	}
	return "", value
}

// PersonsMatching finds the persons input names exactly. A prefix
// ("person_id:", "distinct_id:", "email:") says which it is; without one, a
// "person_" id is looked up as an id, and every input as a distinct id and,
// when it has an "@", as an email. A distinct id can look like an email, so
// every lookup runs and the matches are merged. wanted is the input without
// its prefix.
func PersonsMatching(ctx context.Context, app *cli.App, projectID, input string) (wanted string, persons cli.List[Person], err error) {
	kind, wanted := IdentityPrefix(input, "person_id", "distinct_id", "email")
	if kind != "" {
		wanted = strings.TrimSpace(wanted)
	}
	seen := map[string]bool{}
	add := func(found cli.List[Person]) {
		for index, person := range found.Items {
			if !seen[person.Id] {
				seen[person.Id] = true
				persons.Items = append(persons.Items, person)
				persons.Raw = append(persons.Raw, found.Raw[index])
			}
		}
	}

	if kind == "person_id" || (kind == "" && strings.HasPrefix(wanted, "person_")) {
		person, err := cli.Fetch[Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsGet(ctx, projectID, wanted)
		})
		switch {
		case err == nil:
			add(cli.List[Person]{Items: []Person{person.Value}, Raw: []json.RawMessage{person.Raw}})
		case cli.APIErrorCode(err) != "person_not_found":
			return wanted, persons, err
		}
	}
	if kind == "" || kind == "distinct_id" {
		found, _, err := cli.FetchPage[Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{DistinctId: &wanted})
		})
		if err != nil {
			return wanted, persons, err
		}
		add(found)
	}
	if kind == "email" || (kind == "" && strings.Contains(wanted, "@")) {
		limit := 20
		found, _, err := cli.FetchPage[Person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{Email: &wanted, Limit: &limit})
		})
		if err != nil {
			return wanted, persons, err
		}
		add(found)
	}
	return wanted, persons, nil
}

// FindPerson finds the one person input names (see [PersonsMatching]). It
// fails with exit 4 when nobody matches and lists the candidates (exit 2)
// when several do, such as persons sharing an email.
func FindPerson(ctx context.Context, app *cli.App, projectID, input string) (cli.Object[Person], error) {
	wanted, persons, err := PersonsMatching(ctx, app, projectID, input)
	if err != nil {
		return cli.Object[Person]{}, err
	}
	switch len(persons.Items) {
	case 0:
		return cli.Object[Person]{}, NoPerson(input)
	case 1:
		// An id or distinct id names one person.
		return persons.Object(0), nil
	}
	// FindItem lists the candidates of a shared email.
	found, err := cli.FindItem(PersonKind, persons.Items, wanted)
	if err != nil {
		return cli.Object[Person]{}, err
	}
	for index, person := range persons.Items {
		if person.Id == found.Id {
			return persons.Object(index), nil
		}
	}
	return cli.NewObject(found), nil
}

// RequirePerson finds the person a command's argument names, asked for on a
// terminal (see [FindPerson]). usage shows how to pass it.
func RequirePerson(ctx context.Context, app *cli.App, projectID, input, usage string) (cli.Object[Person], error) {
	query, err := app.RequireText(ctx, input, cli.TextPrompt{
		What:    "the person",
		Message: "Their email, distinct id or id",
		Usage:   usage,
	})
	if err != nil {
		return cli.Object[Person]{}, err
	}
	return FindPerson(ctx, app, projectID, query)
}
