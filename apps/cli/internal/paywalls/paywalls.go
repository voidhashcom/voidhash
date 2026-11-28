// Package paywalls is how the paywall, location and person commands name
// and describe what end users see: the paywalls and locations people name on
// the command line, builds, what a location shows, waiting for a build to
// finish, and finding the end user a person names.
package paywalls

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// Paywall is a paywall or an onboarding flow.
type Paywall = api.PaywallJsonEncoding

// Showing is what a location shows, or showed, in one environment: a
// paywall's build, or what an experiment's flag decides.
type Showing struct {
	ID            string  `json:"id"`
	Type          string  `json:"type"`
	Environment   string  `json:"environment"`
	PaywallID     *string `json:"paywallId"`
	BuildNumber   *int    `json:"buildNumber"`
	FeatureFlagID *string `json:"featureFlagId"`
	StartedAt     string  `json:"startedAt"`
	EndedAt       *string `json:"endedAt"`
}

// Location is a place in an app that shows a paywall. Showing is nil when it
// shows nothing; TestShowing is nil when apps using a test key get what
// production shows.
type Location struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description *string  `json:"description"`
	IsArchived  bool     `json:"isArchived"`
	Showing     *Showing `json:"showing"`
	TestShowing *Showing `json:"testShowing"`
}

// Build is one build of a paywall's design.
type Build struct {
	ID         string  `json:"id"`
	PaywallID  string  `json:"paywallId"`
	Number     int     `json:"number"`
	Status     string  `json:"status"`
	IsDeployed bool    `json:"isDeployed"`
	DeployedAt *string `json:"deployedAt"`
	// IsDeployedInTest is whether apps using a test key get the build: the
	// one deployed to test alone, or production's while test follows it.
	IsDeployedInTest bool    `json:"isDeployedInTest"`
	DeployedToTestAt *string `json:"deployedToTestAt"`
	CreatedAt        string  `json:"createdAt"`
	Failure          *struct {
		Message     string `json:"message"`
		Diagnostics []struct {
			Code    string  `json:"code"`
			Message string  `json:"message"`
			NodeID  *string `json:"nodeId"`
		} `json:"diagnostics"`
	} `json:"failure"`
	// FlowPackage is what a ready build produced; nil otherwise.
	FlowPackage *struct {
		// IsFollowingTextSize is whether the flow's texts follow the end user's
		// text size; false for builds made before they did.
		IsFollowingTextSize bool `json:"isFollowingTextSize"`
	} `json:"flowPackage"`
	// IsWithdrawn is whether the build is withdrawn: no app is served it
	// anywhere until it is restored, and it cannot be deployed.
	IsWithdrawn bool    `json:"isWithdrawn"`
	WithdrawnAt *string `json:"withdrawnAt"`
	// MissingTranslations are the languages a ready build shows partly
	// untranslated, which never stops it.
	MissingTranslations []struct {
		Locale       string `json:"locale"`
		MissingTexts int    `json:"missingTexts"`
		Texts        int    `json:"texts"`
	} `json:"missingTranslations"`
	// TestArms are the arms of running and paused experiments that show the
	// paywall, with the build each keeps in each environment; the same for
	// every build of the paywall.
	TestArms []TestArm `json:"testArms"`
}

// TestArm is an arm of a running or paused experiment showing the paywall
// at a location, and the build it keeps there in one environment. A nil
// KeptBuildNumber is an arm of an experiment started before arms kept their
// build, which shows the deployed build.
type TestArm struct {
	ExperimentName      string `json:"experimentName"`
	IsPaused            bool   `json:"isPaused"`
	VariantID           string `json:"variantId"`
	VariantName         string `json:"variantName"`
	PaywallLocationID   string `json:"paywallLocationId"`
	PaywallLocationName string `json:"paywallLocationName"`
	Environment         string `json:"environment"`
	KeptBuildNumber     *int   `json:"keptBuildNumber"`
}

// PaywallKind is how commands name a paywall: by its slug, name or id.
var PaywallKind = cli.ItemKind[Paywall]{
	Noun:          "paywall",
	ID:            func(paywall Paywall) string { return paywall.Id },
	Label:         func(paywall Paywall) string { return paywall.Name + " (" + paywall.Slug + ")" },
	ListCommand:   "voidhash paywall list",
	CreateCommand: "voidhash paywall create",
	Keys:          func(paywall Paywall) []string { return []string{paywall.Slug} },
	Names:         func(paywall Paywall) []string { return []string{paywall.Name} },
}

// LocationKind is how commands name a location: by its slug, name or id.
var LocationKind = cli.ItemKind[Location]{
	Noun:          "location",
	ID:            func(location Location) string { return location.ID },
	Label:         func(location Location) string { return location.Name + " (" + location.Slug + ")" },
	ListCommand:   "voidhash location list",
	CreateCommand: "voidhash location create",
	Keys:          func(location Location) []string { return []string{location.Slug} },
	Names:         func(location Location) []string { return []string{location.Name} },
}

// KindLabel is what a paywall is, as people say it.
func KindLabel(paywall Paywall) string {
	if paywall.Kind == "onboarding" {
		return "Onboarding flow"
	}
	return "Paywall"
}

// BuildLabel is "build #3".
func BuildLabel(number int) string { return "build #" + strconv.Itoa(number) }

// ListPaywalls reads every paywall of the project, archived or not.
func ListPaywalls(ctx context.Context, app *cli.App, projectID string) (cli.List[Paywall], error) {
	return cli.ListAll[Paywall](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaywallsList(ctx, projectID, &api.PaywallsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// ListLocations reads every location of the project, archived or not.
func ListLocations(ctx context.Context, app *cli.App, projectID string) (cli.List[Location], error) {
	return cli.ListAll[Location](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaywallLocationsList(ctx, projectID, &api.PaywallLocationsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// ListBuilds reads the paywall's builds, newest first: the API keeps its 50
// most recent.
func ListBuilds(ctx context.Context, app *cli.App, projectID, paywallID string) (cli.List[Build], error) {
	limit := 50
	builds, _, err := cli.FetchPage[Build](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaywallsListBuilds(ctx, projectID, paywallID, &api.PaywallsListBuildsParams{Limit: &limit})
	})
	return builds, err
}

// ListWithdrawnBuilds reads every withdrawn build of the paywall, newest
// first, however old: the ones a restore can name.
func ListWithdrawnBuilds(ctx context.Context, app *cli.App, projectID, paywallID string) (cli.List[Build], error) {
	return cli.ListAll[Build](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		withdrawn := api.PaywallsListBuildsParamsIsWithdrawnTrue
		return c.PaywallsListBuilds(ctx, projectID, paywallID, &api.PaywallsListBuildsParams{Cursor: page.Cursor, Limit: page.Limit, IsWithdrawn: &withdrawn})
	})
}

// ListExperiments reads the project's experiments, for naming what a
// location runs. It is empty when they cannot be read, so a key without
// experiments still lists locations.
func ListExperiments(ctx context.Context, app *cli.App, projectID string) []api.ExperimentJsonEncoding {
	experiments, err := cli.ListAll[api.ExperimentJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ExperimentsList(ctx, projectID, &api.ExperimentsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return nil
	}
	return experiments.Items
}

// Shows reports whether the location is unarchived and shows the paywall
// directly, rather than through an experiment.
func Shows(location Location, paywall Paywall) bool {
	shown := location.Showing
	return !location.IsArchived && shown != nil && shown.Type == "paywall" && shown.PaywallID != nil && *shown.PaywallID == paywall.Id
}

// LocationsShowing are the unarchived locations showing the paywall directly.
func LocationsShowing(locations []Location, paywall Paywall) []Location {
	var showing []Location
	for _, location := range locations {
		if Shows(location, paywall) {
			showing = append(showing, location)
		}
	}
	return showing
}

// requireIn returns the item input names among list, with the JSON the
// server sent for it; a missing input is asked for on a terminal.
func requireIn[T any](ctx context.Context, app *cli.App, kind cli.ItemKind[T], list cli.List[T], input, usage string) (cli.Object[T], error) {
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

// RequirePaywall returns the paywall a command's argument names, among
// every paywall of the project.
func RequirePaywall(ctx context.Context, app *cli.App, projectID, input, usage string) (cli.Object[Paywall], error) {
	all, err := ListPaywalls(ctx, app, projectID)
	if err != nil {
		return cli.Object[Paywall]{}, err
	}
	return requireIn(ctx, app, PaywallKind, all, input, usage)
}

// RequireLocation returns the location a command's argument names, among
// every location of the project.
func RequireLocation(ctx context.Context, app *cli.App, projectID, input, usage string) (cli.Object[Location], error) {
	all, err := ListLocations(ctx, app, projectID)
	if err != nil {
		return cli.Object[Location]{}, err
	}
	return requireIn(ctx, app, LocationKind, all, input, usage)
}

// PaywallName is the label of the paywall with the id, or the id when the
// paywall is not among paywalls.
func PaywallName(paywalls []Paywall, id string) string {
	for _, paywall := range paywalls {
		if paywall.Id == id {
			return PaywallKind.Label(paywall)
		}
	}
	return id
}

// DescribeShowing is what a showing serves, as people say it: "Pro (pro),
// build #3", or the experiment whose flag decides it.
func DescribeShowing(showing Showing, paywalls []Paywall, experiments []api.ExperimentJsonEncoding) string {
	if showing.Type == "paywall" {
		name := "a paywall"
		if showing.PaywallID != nil {
			name = PaywallName(paywalls, *showing.PaywallID)
		}
		if showing.BuildNumber != nil {
			name += ", " + BuildLabel(*showing.BuildNumber)
		}
		return name
	}
	flag := "unknown"
	if showing.FeatureFlagID != nil {
		flag = *showing.FeatureFlagID
	}
	for _, experiment := range experiments {
		if experiment.FeatureFlagId == flag {
			return fmt.Sprintf("experiment %s (%s)", experiment.Name, experiment.Status)
		}
	}
	return "an experiment (flag " + flag + ")"
}

// ShowingDescriber reads what describing showings needs (the project's
// paywalls, and its experiments when one of the showings is an experiment)
// and returns how each reads. It also returns the paywalls it read.
func ShowingDescriber(ctx context.Context, app *cli.App, projectID string, showings []Showing) (func(Showing) string, []Paywall, error) {
	all, err := ListPaywalls(ctx, app, projectID)
	if err != nil {
		return nil, nil, err
	}
	var experiments []api.ExperimentJsonEncoding
	for _, showing := range showings {
		if showing.Type == "feature_flag" {
			experiments = ListExperiments(ctx, app, projectID)
			break
		}
	}
	return func(showing Showing) string {
		return DescribeShowing(showing, all.Items, experiments)
	}, all.Items, nil
}

// ShowingsOf is what the locations show, in production and to test keys alone.
func ShowingsOf(locations ...Location) []Showing {
	var showings []Showing
	for _, location := range locations {
		if location.Showing != nil {
			showings = append(showings, *location.Showing)
		}
		if location.TestShowing != nil {
			showings = append(showings, *location.TestShowing)
		}
	}
	return showings
}

// DescribeFailure is why a build failed, one problem per line.
func DescribeFailure(build Build) string {
	if build.Failure == nil {
		return "It failed without a reason."
	}
	lines := []string{build.Failure.Message}
	for _, diagnostic := range build.Failure.Diagnostics {
		where := ""
		if diagnostic.NodeID != nil {
			where = ", node " + *diagnostic.NodeID
		}
		lines = append(lines, fmt.Sprintf("  - %s (%s%s)", diagnostic.Message, diagnostic.Code, where))
	}
	return strings.Join(lines, "\n")
}

// TextSizeNote says that build makes the paywall's texts follow the text size
// end users chose on their phones when the build it replaces did not, so the
// layout at larger sizes is worth a look; it is empty otherwise, also when
// nothing is live or the server does not say.
func TextSizeNote(build, replaced Build, slug string) string {
	follows := func(build Build) bool { return build.FlowPackage != nil && build.FlowPackage.IsFollowingTextSize }
	if !follows(build) || follows(replaced) {
		return ""
	}
	return fmt.Sprintf("Build #%d follows the text size end users chose on their phones; %s kept the designed sizes. "+
		"Check its screens at larger sizes in the preview's Text size menu: 'voidhash open paywall %s'.",
		build.Number, BuildLabel(replaced.Number), slug)
}

// WithdrawnLiveWarning says what devices get when a paywall's live build is
// withdrawn: an earlier build, or no paywall. It is empty otherwise.
func WithdrawnLiveWarning(live Build) string {
	if !live.IsWithdrawn {
		return ""
	}
	return fmt.Sprintf("%s, the live build, is withdrawn: devices get the most recent earlier build that is not withdrawn, or no paywall when there is none.", BuildLabel(live.Number))
}

// TestArmsNotes says what deploying build leaves the arms of running and
// paused experiments showing in environment (both when empty): each keeps its
// build, one line per experiment, location and arm. An arm of an experiment
// started before arms kept their build shows the deployed build.
func TestArmsNotes(build Build, environment string) []string {
	type key struct{ experiment, location, arm string }
	var order []key
	groups := map[key][]TestArm{}
	for _, arm := range build.TestArms {
		if environment != "" && arm.Environment != environment {
			continue
		}
		at := key{arm.ExperimentName, arm.PaywallLocationID, arm.VariantID}
		if _, seen := groups[at]; !seen {
			order = append(order, at)
		}
		groups[at] = append(groups[at], arm)
	}
	notes := make([]string, 0, len(order))
	for _, at := range order {
		group := groups[at]
		first := group[0]
		status := "running"
		if first.IsPaused {
			status = "paused"
		}
		where := fmt.Sprintf("The %s experiment %s at %s", status, first.ExperimentName, first.PaywallLocationName)
		same := true
		for _, arm := range group[1:] {
			same = same && (arm.KeptBuildNumber == nil) == (first.KeptBuildNumber == nil) &&
				(arm.KeptBuildNumber == nil || *arm.KeptBuildNumber == *first.KeptBuildNumber)
		}
		switch {
		case same && first.KeptBuildNumber != nil:
			notes = append(notes, fmt.Sprintf("%s keeps %s for arm %s.", where, BuildLabel(*first.KeptBuildNumber), first.VariantName))
		case same:
			notes = append(notes, fmt.Sprintf("%s started before arms kept their build, so arm %s shows %s too.", where, first.VariantName, BuildLabel(build.Number)))
		default:
			parts := make([]string, len(group))
			for index, arm := range group {
				kept := "the deployed build"
				if arm.KeptBuildNumber != nil {
					kept = BuildLabel(*arm.KeptBuildNumber)
				}
				parts[index] = fmt.Sprintf("%s for %s keys", kept, arm.Environment)
			}
			notes = append(notes, fmt.Sprintf("%s keeps %s for arm %s.", where, strings.Join(parts, " and "), first.VariantName))
		}
	}
	return notes
}

// MissingTranslationWarnings says, one line per language, which languages a
// build leaves partly untranslated: it deploys, but end users reading them
// see the design's own language in those texts.
func MissingTranslationWarnings(build Build) []string {
	var lines []string
	for _, gap := range build.MissingTranslations {
		lines = append(lines, fmt.Sprintf("Not fully translated in %s: %d of %d texts have no translation, so people reading it see the paywall's own language there.", gap.Locale, gap.MissingTexts, gap.Texts))
	}
	return lines
}

// BuildStatus is a build's status as a table cell: "ready, live", "ready,
// live in test", "failed", "building".
func BuildStatus(build Build) string {
	if build.Status != "ready" {
		return build.Status
	}
	status := build.Status
	switch {
	case build.IsDeployed && build.IsDeployedInTest:
		status = "ready, live"
	case build.IsDeployed:
		status = "ready, live in production"
	case build.IsDeployedInTest:
		status = "ready, live in test"
	}
	if build.IsWithdrawn {
		status += ", withdrawn: not served"
	}
	return status
}

// WaitForBuild returns the build once it is no longer building, or as it is
// after timeout. It reads the build every two seconds.
func WaitForBuild(ctx context.Context, app *cli.App, projectID string, build cli.Object[Build], timeout time.Duration) (cli.Object[Build], error) {
	deadline := app.Now().Add(timeout)
	for build.Value.Status == "building" {
		remaining := deadline.Sub(app.Now())
		if remaining <= 0 {
			break
		}
		if err := app.Sleep(ctx, min(2*time.Second, remaining)); err != nil {
			return build, err
		}
		read, err := cli.Fetch[Build](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaywallsGetBuild(ctx, projectID, build.Value.PaywallID, build.Value.ID)
		})
		if err != nil {
			return build, err
		}
		build = read
	}
	return build, nil
}

// FindBuild is the index of the build input names among builds: its id, or
// its number with or without "#". It is -1 when there is none.
func FindBuild(builds []Build, input string) int {
	wanted := strings.TrimPrefix(strings.TrimSpace(input), "#")
	for index, build := range builds {
		if build.ID == wanted || strconv.Itoa(build.Number) == wanted {
			return index
		}
	}
	return -1
}

// DeployedBuild is the build deployed to production among builds, if any.
func DeployedBuild(builds []Build) (Build, bool) {
	for _, build := range builds {
		if build.IsDeployed {
			return build, true
		}
	}
	return Build{}, false
}

// TestBuild is the build apps using a test key get, if any: the one
// deployed to test alone, or production's while test follows production.
func TestBuild(builds []Build) (Build, bool) {
	for _, build := range builds {
		if build.IsDeployedInTest {
			return build, true
		}
	}
	return Build{}, false
}

// LocationNames is "Home (home), Upgrade (upgrade)", or none when there are
// no locations.
func LocationNames(locations []Location, none string) string {
	if len(locations) == 0 {
		return none
	}
	names := make([]string, len(locations))
	for index, location := range locations {
		names[index] = LocationKind.Label(location)
	}
	return strings.Join(names, ", ")
}

// Letters with a mark, as the unmarked letters a slug keeps.
var unmarked = map[rune]string{
	'à': "a", 'á': "a", 'â': "a", 'ã': "a", 'ä': "a", 'å': "a", 'ā': "a", 'ă': "a", 'ą': "a",
	'ç': "c", 'ć': "c", 'č': "c", 'ď': "d",
	'è': "e", 'é': "e", 'ê': "e", 'ë': "e", 'ē': "e", 'ė': "e", 'ę': "e", 'ě': "e",
	'ğ': "g", 'ì': "i", 'í': "i", 'î': "i", 'ï': "i", 'ī': "i", 'į': "i",
	'ľ': "l", 'ĺ': "l", 'ñ': "n", 'ń': "n", 'ň': "n",
	'ò': "o", 'ó': "o", 'ô': "o", 'õ': "o", 'ö': "o", 'ō': "o", 'ő': "o",
	'ŕ': "r", 'ř': "r", 'ś': "s", 'š': "s", 'ş': "s", 'ť': "t", 'ţ': "t",
	'ù': "u", 'ú': "u", 'û': "u", 'ü': "u", 'ū': "u", 'ů': "u", 'ű': "u", 'ų': "u",
	'ý': "y", 'ÿ': "y", 'ź': "z", 'ż': "z", 'ž': "z",
}

// SlugFrom makes a slug from name: lowercase letters and digits, words
// joined by dashes. Letters with a mark lose it ("Café" is "cafe").
func SlugFrom(name string) string {
	var slug strings.Builder
	pendingDash := false
	for _, r := range strings.ToLower(name) {
		letter := unmarked[r]
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			letter = string(r)
		}
		switch {
		case letter != "":
			if pendingDash && slug.Len() > 0 {
				slug.WriteByte('-')
			}
			pendingDash = false
			slug.WriteString(letter)
		case unicode.Is(unicode.Mn, r):
			// A combining mark belongs to the letter before it.
		default:
			pendingDash = true
		}
	}
	return slug.String()
}
