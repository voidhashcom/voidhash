package push

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// How `push send --to` finds the end users it names. A project can hold
// millions of persons, so they are looked up exactly through the API's
// filters (id, distinct id, email) rather than listed and searched.

type person = api.PersonJsonEncoding

// personName is who a person is, as people say it: "Ada <ada@example.com>",
// or their distinct id.
func personName(p person) string {
	switch {
	case p.Name != nil && p.Email != nil:
		return *p.Name + " <" + *p.Email + ">"
	case p.Name != nil:
		return *p.Name
	case p.Email != nil:
		return *p.Email
	}
	return p.DistinctId
}

var personKind = cli.ItemKind[person]{
	Noun: "person",
	ID:   func(p person) string { return p.Id },
	Label: func(p person) string {
		if name := personName(p); name != p.DistinctId {
			return name + " (" + p.DistinctId + ")"
		}
		return p.DistinctId
	},
	ListCommand: "voidhash person list",
	Keys: func(p person) []string {
		if p.Email != nil {
			return []string{p.DistinctId, *p.Email}
		}
		return []string{p.DistinctId}
	},
	Names: func(p person) []string {
		if p.Name != nil {
			return []string{*p.Name}
		}
		return nil
	},
}

var prefixed = regexp.MustCompile(`^(person_id|distinct_id|email):(.+)$`)

// findPerson returns the one person input names. A prefix (`person_id:`,
// `distinct_id:`, `email:`) says which it is; without one, a `person_` id is
// looked up as an id, and every input as a distinct id and, when it has an
// `@`, as an email. A distinct id can look like an email, so every lookup
// runs and the matches are merged. It fails with exit 4 when nobody matches,
// and lists the candidates (exit 2) when several do, such as persons sharing
// an email.
func findPerson(ctx context.Context, app *cli.App, projectID, input string) (person, error) {
	wanted, kind := strings.TrimSpace(input), ""
	if match := prefixed.FindStringSubmatch(wanted); match != nil {
		kind, wanted = match[1], strings.TrimSpace(match[2])
	}
	lookUp := func(which string) bool { return kind == "" || kind == which }

	var found []person
	add := func(persons ...person) {
		for _, candidate := range persons {
			known := false
			for _, existing := range found {
				known = known || existing.Id == candidate.Id
			}
			if !known {
				found = append(found, candidate)
			}
		}
	}
	if lookUp("person_id") && (kind != "" || strings.HasPrefix(wanted, "person_")) {
		byID, err := cli.Fetch[person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsGet(ctx, projectID, wanted)
		})
		switch {
		case err == nil:
			add(byID.Value)
		case cli.APIErrorCode(err) != "person_not_found":
			return person{}, err
		}
	}
	if lookUp("distinct_id") {
		byDistinctID, _, err := cli.FetchPage[person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{DistinctId: &wanted})
		})
		if err != nil {
			return person{}, err
		}
		add(byDistinctID.Items...)
	}
	if lookUp("email") && (kind != "" || strings.Contains(wanted, "@")) {
		limit := 20
		byEmail, _, err := cli.FetchPage[person](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PersonsList(ctx, projectID, &api.PersonsListParams{Email: &wanted, Limit: &limit})
		})
		if err != nil {
			return person{}, err
		}
		add(byEmail.Items...)
	}

	switch len(found) {
	case 0:
		return person{}, &cli.UserError{
			Message:  fmt.Sprintf("No person has the email, distinct id or id %q.", strings.TrimSpace(input)),
			Hint:     "Persons are found by their exact email, distinct id or id; names and parts of an email cannot be searched. 'voidhash person list' shows the newest.",
			ExitCode: cli.ExitNotFound,
		}
	case 1:
		// An id or a distinct id names one person.
		return found[0], nil
	}
	return cli.FindItem(personKind, found, wanted)
}
