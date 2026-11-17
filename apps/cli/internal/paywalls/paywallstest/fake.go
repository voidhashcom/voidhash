// Package paywallstest is a project's paywalls and locations on the fake
// API, for the tests of the commands that change them.
package paywallstest

import (
	"fmt"
	"net/url"
	"sort"
	"strings"
	"testing"

	"github.com/voidhashcom/voidhash/apps/cli/internal/clitest"
)

// M is a JSON object.
type M = clitest.M

// DaysAgo is the time that many days before [clitest.Now], as the API writes it.
func DaysAgo(days int) string {
	return clitest.Now.AddDate(0, 0, -days).UTC().Format("2006-01-02T15:04:05.000Z")
}

// Project is the paywalls of the project proj_app, changed by the commands
// under test.
type Project struct {
	Paywalls  []M
	Builds    []M
	Locations []M
	// Pins are the end users pinned to a paywall at a location, newest first.
	Pins []M
	// Rules are the rules of each location and environment.
	Rules []M
	// NextBuild is what a new build is when it is read back.
	NextBuild string
	nextID    int
}

func paywall(id, slug, name string) M {
	return M{
		"id": id, "projectId": "proj_app", "name": name, "slug": slug, "kind": "paywall", "isArchived": false,
		"archivedAt": nil, "thumbnailUrl": nil, "createdAt": DaysAgo(30), "updatedAt": nil,
	}
}

func build(paywallID string, number int) M {
	return M{
		"id": fmt.Sprintf("pw_build_%s_%d", paywallID, number), "paywallId": paywallID, "number": number, "status": "ready",
		"documentVersion": number * 5, "isDeployed": false, "deployedAt": nil, "flowPackage": nil, "failure": nil,
		"createdByUserId": "user_1", "createdAt": DaysAgo(10 - number), "finishedAt": DaysAgo(10 - number),
	}
}

// showing is what a location shows: a paywall's build, or an experiment's
// flag when paywallID is empty.
func showing(locationID, paywallID string, buildNumber int, flagID string) M {
	shown := M{
		"id": "pw_loc_show_" + locationID, "paywallLocationId": locationID, "type": "paywall", "environment": "production",
		"paywallId": paywallID, "buildNumber": buildNumber, "featureFlagId": nil,
		"startedAt": DaysAgo(5), "endedAt": nil, "createdByUserId": nil,
	}
	if paywallID == "" {
		shown["type"], shown["paywallId"], shown["buildNumber"], shown["featureFlagId"] = "feature_flag", nil, nil, flagID
	}
	return shown
}

func location(id, slug, name string, shown any) M {
	return M{
		"id": id, "projectId": "proj_app", "name": name, "slug": slug, "description": nil, "isArchived": false,
		"archivedAt": nil, "showing": shown, "testShowing": nil, "createdAt": nil, "updatedAt": nil,
	}
}

// NewProject is a project with the paywalls Pro (live at Home, with a newer
// failed build), Summer sale (never built) and the archived onboarding flow
// Welcome, and the locations Home, Onboarding end (showing nothing) and
// Upgrade (running the experiment Upgrade test).
func NewProject() *Project {
	welcome := paywall("pw_welcome", "welcome", "Welcome")
	welcome["kind"], welcome["isArchived"] = "onboarding", true
	live := build("pw_pro", 1)
	live["isDeployed"], live["deployedAt"] = true, DaysAgo(2)
	failed := build("pw_pro", 2)
	failed["status"] = "failed"
	failed["failure"] = M{"message": "The paywall cannot be released.", "diagnostics": []any{
		M{"code": "unknown_product", "message": "No product pro-weekly.", "nodeId": "node_9"},
	}}
	return &Project{
		Paywalls: []M{paywall("pw_pro", "pro", "Pro"), paywall("pw_sale", "summer-sale", "Summer sale"), welcome},
		Builds:   []M{live, failed},
		Locations: []M{
			location("pw_loc_home", "home", "Home", showing("pw_loc_home", "pw_pro", 1, "")),
			location("pw_loc_end", "onboarding-end", "Onboarding end", nil),
			location("pw_loc_upgrade", "upgrade", "Upgrade", showing("pw_loc_upgrade", "", 0, "ff_upgrade")),
		},
		NextBuild: "ready",
		nextID:    1,
	}
}

// Location is the location with the id, or nil.
func (p *Project) Location(id string) M { return find(p.Locations, id) }

// Paywall is the paywall with the id, or nil.
func (p *Project) Paywall(id string) M { return find(p.Paywalls, id) }

func find(items []M, id string) M {
	for _, item := range items {
		if item["id"] == id {
			return item
		}
	}
	return nil
}

func anyOf(items []M) []any {
	out := make([]any, len(items))
	for index, item := range items {
		out[index] = item
	}
	return out
}

func filter(items []M, keep func(M) bool) []M {
	kept := []M{}
	for _, item := range items {
		if keep(item) {
			kept = append(kept, item)
		}
	}
	return kept
}

func (p *Project) liveBuild(paywallID string) M {
	for _, candidate := range p.Builds {
		if candidate["paywallId"] == paywallID && candidate["isDeployed"] == true {
			return candidate
		}
	}
	return nil
}

func (p *Project) id() int {
	p.nextID++
	return p.nextID - 1
}

// Install answers the paywall, location and experiment routes of proj_app
// from the project.
func (p *Project) Install(api *clitest.FakeAPI) {
	const base = "/api/v1/projects/proj_app"
	notDeployed := clitest.Failure(409, "conflict", "paywall_not_deployed", "It has no deployed build.")
	environment := func(r *clitest.Request) string {
		if r.Query.Get("environment") == "test" {
			return "test"
		}
		return "production"
	}

	api.Handle("GET "+base+"/paywalls", func(r *clitest.Request) clitest.Answer { return clitest.Paginate(r, anyOf(p.Paywalls)) })
	api.Handle("POST "+base+"/paywalls", func(r *clitest.Request) clitest.Answer {
		for _, existing := range p.Paywalls {
			if existing["slug"] == r.Text("slug") {
				return clitest.Failure(409, "conflict", "paywall_slug_taken", "Another paywall already uses that slug.")
			}
		}
		created := paywall(fmt.Sprintf("pw_new%d", p.id()), r.Text("slug"), r.Text("name"))
		if r.Text("kind") == "onboarding" {
			created["kind"] = "onboarding"
		}
		p.Paywalls = append(p.Paywalls, created)
		return clitest.JSON(201, created)
	})
	withPaywall := func(handler func(r *clitest.Request, found M) clitest.Answer) func(r *clitest.Request) clitest.Answer {
		return func(r *clitest.Request) clitest.Answer {
			found := p.Paywall(r.Param("paywallId"))
			if found == nil {
				return clitest.NotFound("paywall_not_found", "No such paywall.")
			}
			return handler(r, found)
		}
	}
	api.Handle("PATCH "+base+"/paywalls/{paywallId}", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		found["name"] = r.Text("name")
		return clitest.OK(found)
	}))
	api.Handle("DELETE "+base+"/paywalls/{paywallId}", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		p.Paywalls = filter(p.Paywalls, func(candidate M) bool { return candidate["id"] != found["id"] })
		return clitest.NoContent()
	}))
	api.Handle("POST "+base+"/paywalls/{paywallId}/archive", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		found["isArchived"] = true
		return clitest.OK(found)
	}))
	api.Handle("POST "+base+"/paywalls/{paywallId}/unarchive", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		found["isArchived"] = false
		return clitest.OK(found)
	}))
	buildsOf := func(paywallID any) []M {
		builds := filter(p.Builds, func(candidate M) bool { return candidate["paywallId"] == paywallID })
		sort.Slice(builds, func(a, b int) bool { return builds[a]["number"].(int) > builds[b]["number"].(int) })
		return builds
	}
	api.Handle("GET "+base+"/paywalls/{paywallId}/builds", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		return clitest.Paginate(r, anyOf(buildsOf(found["id"])))
	}))
	api.Handle("POST "+base+"/paywalls/{paywallId}/builds", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		number := 1
		if builds := buildsOf(found["id"]); len(builds) > 0 {
			number = builds[0]["number"].(int) + 1
		}
		started := build(found["id"].(string), number)
		started["id"], started["status"], started["documentVersion"] = fmt.Sprintf("pw_build_new%d", p.id()), "building", 12
		started["createdAt"], started["finishedAt"] = DaysAgo(0), nil
		p.Builds = append(p.Builds, started)
		return clitest.JSON(202, started)
	}))
	api.Handle("GET "+base+"/paywalls/{paywallId}/builds/{buildId}", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		target := find(p.Builds, r.Param("buildId"))
		if target == nil {
			return clitest.NotFound("paywall_build_not_found", "No such build.")
		}
		if target["status"] == "building" && p.NextBuild != "building" {
			target["status"] = p.NextBuild
			if p.NextBuild == "failed" {
				target["failure"] = M{"message": "The paywall cannot be released.", "diagnostics": []any{
					M{"code": "empty_screen", "message": "Screen 2 is empty.", "nodeId": "node_2"},
				}}
			}
		}
		return clitest.OK(target)
	}))
	api.Handle("POST "+base+"/paywalls/{paywallId}/builds/{buildId}/deploy", withPaywall(func(r *clitest.Request, found M) clitest.Answer {
		target := find(p.Builds, r.Param("buildId"))
		if target == nil {
			return clitest.NotFound("paywall_build_not_found", "No such build.")
		}
		for _, candidate := range p.Builds {
			if candidate["paywallId"] == found["id"] {
				candidate["isDeployed"] = candidate["id"] == target["id"]
			}
		}
		target["deployedAt"] = DaysAgo(0)
		return clitest.OK(target)
	}))

	api.Handle("GET "+base+"/paywall-locations", func(r *clitest.Request) clitest.Answer {
		return clitest.Paginate(r, anyOf(p.Locations))
	})
	api.Handle("POST "+base+"/paywall-locations", func(r *clitest.Request) clitest.Answer {
		for _, existing := range p.Locations {
			if existing["slug"] == r.Text("slug") {
				return clitest.Failure(409, "conflict", "paywall_location_slug_taken", "Another location already uses that slug.")
			}
		}
		created := location(fmt.Sprintf("pw_loc_new%d", p.id()), r.Text("slug"), r.Text("name"), nil)
		if description, ok := r.Body["description"].(string); ok {
			created["description"] = description
		}
		p.Locations = append(p.Locations, created)
		return clitest.JSON(201, created)
	})
	withLocation := func(handler func(r *clitest.Request, found M) clitest.Answer) func(r *clitest.Request) clitest.Answer {
		return func(r *clitest.Request) clitest.Answer {
			found := p.Location(r.Param("locationId"))
			if found == nil {
				return clitest.NotFound("paywall_location_not_found", "No such location.")
			}
			return handler(r, found)
		}
	}
	one := base + "/paywall-locations/{locationId}"
	api.Handle("GET "+one, withLocation(func(r *clitest.Request, found M) clitest.Answer { return clitest.OK(found) }))
	api.Handle("PATCH "+one, withLocation(func(r *clitest.Request, found M) clitest.Answer {
		if name, ok := r.Body["name"].(string); ok {
			found["name"] = name
		}
		if description, sent := r.Body["description"]; sent {
			found["description"] = description
		}
		return clitest.OK(found)
	}))
	api.Handle("POST "+one+"/archive", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		found["isArchived"], found["showing"], found["testShowing"] = true, nil, nil
		return clitest.OK(found)
	}))
	api.Handle("PUT "+one+"/showing", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		live := p.liveBuild(r.Text("paywallId"))
		if live == nil {
			return notDeployed
		}
		shown := showing(found["id"].(string), r.Text("paywallId"), live["number"].(int), "")
		// Test's own showing sits beside production's, which stays as it is.
		if environment(r) == "test" {
			shown["id"], shown["environment"], shown["startedAt"] = shown["id"].(string)+"_test", "test", DaysAgo(0)
			found["testShowing"] = shown
		} else {
			found["showing"] = shown
		}
		return clitest.OK(shown)
	}))
	api.Handle("DELETE "+one+"/showing", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		if environment(r) == "test" {
			found["testShowing"] = nil
		} else {
			found["showing"] = nil
		}
		return clitest.NoContent()
	}))
	api.Handle("GET "+one+"/showings", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		past := showing(found["id"].(string), "pw_sale", 1, "")
		past["id"], past["startedAt"], past["endedAt"] = "pw_loc_show_old", DaysAgo(20), DaysAgo(5)
		showings := []any{}
		for _, key := range []string{"testShowing", "showing"} {
			if shown, ok := found[key].(M); ok {
				showings = append(showings, shown)
			}
		}
		return clitest.Paginate(r, append(showings, past))
	}))
	api.Handle("GET "+one+"/rules", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		return clitest.Paginate(r, anyOf(filter(p.Rules, func(rule M) bool { return rule["paywallLocationId"] == found["id"] })))
	}))
	api.Handle("PUT "+one+"/rules", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		env := environment(r)
		sent, _ := r.Body["rules"].([]any)
		saved := []M{}
		for position, raw := range sent {
			rule, _ := raw.(map[string]any)
			// Kept as sent: the CLI is what names the attribute and the operator.
			saved = append(saved, M{
				"id": fmt.Sprintf("pw_loc_rule_%s_%d", env, position), "paywallLocationId": found["id"], "environment": env,
				"position": position, "name": rule["name"], "conditions": rule["conditions"], "paywallId": rule["paywallId"],
			})
		}
		p.Rules = append(filter(p.Rules, func(rule M) bool {
			return rule["paywallLocationId"] != found["id"] || rule["environment"] != env
		}), saved...)
		return clitest.OK(M{"rules": saved})
	}))
	api.Handle("GET "+one+"/pins", withLocation(func(r *clitest.Request, found M) clitest.Answer {
		return clitest.Paginate(r, anyOf(filter(p.Pins, func(pin M) bool { return pin["paywallLocationId"] == found["id"] })))
	}))
	pinned := func(handler func(r *clitest.Request, found M, isPin func(M) bool, identityType, identityValue string) clitest.Answer) func(r *clitest.Request) clitest.Answer {
		return withLocation(func(r *clitest.Request, found M) clitest.Answer {
			identityType, value, _ := strings.Cut(r.Param("identity"), ":")
			if decoded, err := url.PathUnescape(value); err == nil {
				value = decoded
			}
			value = strings.ToLower(value)
			env := environment(r)
			return handler(r, found, func(pin M) bool {
				return pin["paywallLocationId"] == found["id"] && pin["environment"] == env &&
					pin["identityType"] == identityType && pin["identityValue"] == value
			}, identityType, value)
		})
	}
	api.Handle("DELETE "+one+"/pins/{identity}", pinned(func(r *clitest.Request, found M, isPin func(M) bool, _, _ string) clitest.Answer {
		if len(filter(p.Pins, isPin)) == 0 {
			return clitest.NotFound("paywall_location_pin_not_found", "No such pin.")
		}
		p.Pins = filter(p.Pins, func(pin M) bool { return !isPin(pin) })
		return clitest.NoContent()
	}))
	api.Handle("PUT "+one+"/pins/{identity}", pinned(func(r *clitest.Request, found M, isPin func(M) bool, identityType, identityValue string) clitest.Answer {
		if p.liveBuild(r.Text("paywallId")) == nil {
			return notDeployed
		}
		pin := M{
			"id": fmt.Sprintf("pw_loc_pin_%d", p.id()), "paywallLocationId": found["id"], "environment": environment(r),
			"identityType": identityType, "identityValue": identityValue, "paywallId": r.Text("paywallId"),
			"note": r.Body["note"], "createdAt": DaysAgo(0),
		}
		status := 201
		if existing := filter(p.Pins, isPin); len(existing) > 0 {
			pin["id"], status = existing[0]["id"], 200
		}
		p.Pins = append([]M{pin}, filter(p.Pins, func(candidate M) bool { return !isPin(candidate) })...)
		return clitest.JSON(status, pin)
	}))
	api.Handle("GET "+base+"/experiments", func(r *clitest.Request) clitest.Answer {
		return clitest.Page(M{
			"id": "exp_upgrade", "projectId": "proj_app", "name": "Upgrade test", "description": nil, "hypothesis": nil,
			"status": "running", "primaryMetricEventName": nil, "secondaryMetricEventNames": []any{},
			"paywallLocationIds": []any{"pw_loc_upgrade"}, "testedFeatureFlagIds": []any{}, "winningVariantId": nil,
			"featureFlagId": "ff_upgrade", "isArchived": false, "startedAt": DaysAgo(4), "endedAt": nil,
			"createdAt": nil, "updatedAt": nil,
		})
	})
}

// Setup is a fake API serving a new [Project], and the options to run
// commands against it: signed in, with proj_app as the default project.
func Setup(t testing.TB) (*Project, *clitest.FakeAPI, clitest.Options) {
	project := NewProject()
	api := clitest.NewFakeAPI()
	project.Install(api)
	return project, api, clitest.Options{API: api, Home: clitest.MakeHome(t, M{"default_project": "proj_app"})}
}
