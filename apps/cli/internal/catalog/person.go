package catalog

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// A project can hold millions of persons, so they are looked up exactly
// through the API's filters (id, distinct id, email) rather than listed and
// searched.

// PersonName is who a person is, as people say it: "Ada <ada@example.com>",
// or their distinct id. The app's end users chose these, so the text is
// made printable.
func PersonName(person api.PersonJsonEncoding) string {
	switch {
	case person.Name != nil && person.Email != nil:
		return cli.Printable(*person.Name + " <" + *person.Email + ">")
	case person.Name != nil:
		return cli.Printable(*person.Name)
	case person.Email != nil:
		return cli.Printable(*person.Email)
	}
	return cli.Printable(person.DistinctId)
}

// PersonLabel is a person with their distinct id: "Ada <ada@example.com>
// (user-42)".
func PersonLabel(person api.PersonJsonEncoding) string {
	name, distinctID := PersonName(person), cli.Printable(person.DistinctId)
	if name == distinctID {
		return distinctID
	}
	return name + " (" + distinctID + ")"
}

var personKind = cli.ItemKind[api.PersonJsonEncoding]{
	Noun:        "person",
	ID:          func(person api.PersonJsonEncoding) string { return person.Id },
	Label:       PersonLabel,
	ListCommand: "voidhash person list",
	Keys: func(person api.PersonJsonEncoding) []string {
		keys := []string{person.DistinctId}
		if person.Email != nil {
			keys = append(keys, *person.Email)
		}
		return keys
	},
	Names: func(person api.PersonJsonEncoding) []string {
		if person.Name == nil {
			return nil
		}
		return []string{*person.Name}
	},
}

const personsMatchedExactly = "Persons are found by their exact email, distinct id or id; names and parts of an email cannot be searched. 'voidhash person list' shows the newest."

var prefixedPerson = regexp.MustCompile(`^(person_id|distinct_id|email):(.+)$`)

// FindPerson returns the one person input names exactly. A prefix
// (`person_id:`, `distinct_id:`, `email:`) says which it is; without one, a
// `person_` id is looked up as an id, and every input as a distinct id and,
// when it has an `@`, as an email. A distinct id can look like an email, so
// every lookup runs and the matches are merged. It fails with exit 4 when
// nobody matches and lists the candidates (exit 2) when several do, such as
// persons sharing an email.
func FindPerson(ctx context.Context, app *cli.App, projectID, input string) (api.PersonJsonEncoding, error) {
	var none api.PersonJsonEncoding
	wanted, kind := strings.TrimSpace(input), ""
	if match := prefixedPerson.FindStringSubmatch(wanted); match != nil {
		kind, wanted = match[1], strings.TrimSpace(match[2])
	}
	looksUp := func(which string) bool { return kind == "" || kind == which }

	var persons []api.PersonJsonEncoding
	add := func(found ...api.PersonJsonEncoding) {
		for _, person := range found {
			known := false
			for _, existing := range persons {
				known = known || existing.Id == person.Id
			}
			if !known {
				persons = append(persons, person)
			}
		}
	}
	if looksUp("person_id") && (kind != "" || strings.HasPrefix(wanted, "person_")) {
		person, err := cli.Fetch[api.PersonJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsGet(ctx, projectID, wanted)
		})
		switch {
		case err == nil:
			add(person.Value)
		case cli.APIErrorCode(err) != "person_not_found":
			return none, err
		}
	}
	if looksUp("distinct_id") {
		found, _, err := cli.FetchPage[api.PersonJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{DistinctId: &wanted})
		})
		if err != nil {
			return none, err
		}
		add(found.Items...)
	}
	if looksUp("email") && (kind != "" || strings.Contains(wanted, "@")) {
		limit := 20
		found, _, err := cli.FetchPage[api.PersonJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{Email: &wanted, Limit: &limit})
		})
		if err != nil {
			return none, err
		}
		add(found.Items...)
	}

	switch len(persons) {
	case 0:
		return none, &cli.UserError{
			Message:  fmt.Sprintf("No person has the email, distinct id or id %q.", cli.Printable(strings.TrimSpace(input))),
			Hint:     personsMatchedExactly,
			ExitCode: cli.ExitNotFound,
		}
	case 1:
		// An id or distinct id names one person.
		return persons[0], nil
	}
	// The candidates of a shared email.
	return cli.FindItem(personKind, persons, wanted)
}

// RequirePerson returns the person a command's argument names (see
// [FindPerson]), asking for them on a terminal when it is missing.
func RequirePerson(ctx context.Context, app *cli.App, projectID, input, usage string) (api.PersonJsonEncoding, error) {
	query, err := app.RequireText(ctx, input, cli.TextPrompt{
		What:    "the person",
		Message: "Their email, distinct id or id",
		Usage:   usage,
	})
	if err != nil {
		return api.PersonJsonEncoding{}, err
	}
	return FindPerson(ctx, app, projectID, query)
}
