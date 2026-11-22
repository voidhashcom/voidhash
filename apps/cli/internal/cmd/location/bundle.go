package location

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

// defaultBundleLifetime is how long the SDK shows a bundled flow when
// --not-after is not given. A bundled flow is shown only on a device that
// cannot reach Voidhash and has never had an answer for the location, which
// no answer since can correct: a product it offers that is later unlinked
// in Voidhash is still sold by the store and grants nothing until it is
// linked again. Past this the SDK shows nothing, as it would without the
// file, so a short life costs little; 90 days outlasts a usual release
// cycle, and a new release bundles again.
const defaultBundleLifetime = 90 * 24 * time.Hour

// maxFlowPackageBytes is the largest flow package the SDKs read.
const maxFlowPackageBytes = 16 * 1024 * 1024

// bundleDownloadTimeout bounds one flow package's download.
const bundleDownloadTimeout = 2 * time.Minute

// bundleFileName matches a location slug the SDKs read as a file name: one
// in the folder, and nothing outside it.
var bundleFileName = regexp.MustCompile(`^[A-Za-z0-9_-][A-Za-z0-9._-]*$`)

const bundleUsage = "voidhash location bundle <location>... --out <dir>"

// nativeComponent is a native component a build needs the app's SDK to provide.
type nativeComponent struct {
	ID      string  `json:"id"`
	Version *string `json:"version"`
}

// bundleExperiment is the A/B test whose control arm a bundled answer is.
type bundleExperiment struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// withdrawnBuild is the build a location shows when it is withdrawn.
type withdrawnBuild struct {
	ReleaseID   string `json:"releaseId"`
	BuildNumber int    `json:"buildNumber"`
}

// defaultAnswer is what `paywall_locations.getDefaultAnswer` answers.
type defaultAnswer struct {
	Answer            json.RawMessage   `json:"answer"`
	InterfaceRevision int               `json:"interfaceRevision"`
	Experiment        *bundleExperiment `json:"experiment"`
	WithdrawnBuild    *withdrawnBuild   `json:"withdrawnBuild"`
	Requirements      struct {
		PackageFormat    int               `json:"packageFormat"`
		NativeComponents []nativeComponent `json:"nativeComponents"`
	} `json:"requirements"`
}

// answerView is what the command reads of an answer; the file holds the
// answer whole.
type answerView struct {
	Location struct {
		Slug              string `json:"slug"`
		InterfaceRevision int    `json:"interfaceRevision"`
	} `json:"location"`
	Showing struct {
		Paywall *struct {
			Name string `json:"name"`
			Slug string `json:"slug"`
		} `json:"paywall"`
		PaywallID      *string `json:"paywallId"`
		PaywallRelease *struct {
			FlowPackage *struct {
				SHA256 string `json:"sha256"`
				URL    string `json:"url"`
			} `json:"flowPackage"`
			ReleaseID string `json:"releaseId"`
			Version   int    `json:"version"`
		} `json:"paywallRelease"`
	} `json:"showing"`
}

// bundled is one location's files, ready to write.
type bundled struct {
	location paywalls.Location
	view     answerView
	fetched  defaultAnswer
	answer   []byte
	pkg      []byte
	notAfter string
}

// bundleResult is one location's entry of --json.
type bundleResult struct {
	Location          string            `json:"location"`
	AnswerFile        string            `json:"answerFile"`
	PackageFile       string            `json:"packageFile"`
	PackageBytes      int               `json:"packageBytes"`
	SHA256            string            `json:"sha256"`
	InterfaceRevision int               `json:"interfaceRevision"`
	NotAfter          *string           `json:"notAfter"`
	PaywallID         *string           `json:"paywallId"`
	ReleaseID         string            `json:"releaseId"`
	BuildNumber       int               `json:"buildNumber"`
	PackageFormat     int               `json:"packageFormat"`
	NativeComponents  []nativeComponent `json:"nativeComponents"`
	Experiment        *bundleExperiment `json:"experiment"`
	WithdrawnBuild    *withdrawnBuild   `json:"withdrawnBuild"`
}

// newBundle creates `voidhash location bundle <location>... --out <dir>`.
func newBundle(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "bundle",
		Short: "Write the flows your app ships, shown when a location cannot be loaded.",
		Long: `Write the flows your app ships for locations: for each, <location>.json, its answer, and <location>.vhfp, its flow package, checked against the answer's SHA-256. Put them in the app's VoidhashFlows folder (iOS) or assets/voidhash-flows (Android); files already there are replaced. The SDK shows one only when it cannot reach Voidhash and holds no answer for the location.

The answer is what a new anonymous person is shown in production: never a pin or a rule, and the control arm of an A/B test there. While the build a location shows is withdrawn, it is the earlier build apps are served instead, with a warning. Pass --revision for a location your app presents at a revision of its interface (its flowRevisions, or the generated types); without it the flow is for revision 0, and the SDK skips a flow taken for another revision. A location that shows nothing, or that has no build to serve, is refused, and nothing is written. The result names what an app's SDK needs to show each flow: the flow package format it reads, and any native components the build has no fallback for.

The SDK stops showing the flows after --not-after, 90 days from the day the command runs by default: run it in your release build. Running it again writes the same files unless what the location shows, or the day, has changed.`,
		Example: `voidhash location bundle onboarding --out MyApp/VoidhashFlows
voidhash location bundle onboarding upgrade --revision onboarding=3 --out app/src/main/assets/voidhash-flows
voidhash location bundle onboarding --out MyApp/VoidhashFlows --not-after 2027-03-01 --json`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "location", Help: "The locations' slugs, names or ids", Optional: true, Variadic: true})
	out := cmd.Flags().String("out", "", "The `directory` to write into, created if missing; its files of the same names are replaced")
	revisionFlags := cmd.Flags().StringArray("revision", nil, "The interface revision your app presents a location at (default 0), as `location=revision`")
	notAfterFlag := cmd.Flags().String("not-after", "", "When the SDK stops showing the flows: a `date` (2027-03-01, midnight UTC) or an ISO 8601 time (default: 90 days from the day it runs)")
	noExpiry := cmd.Flags().Bool("no-expiry", false, "Let the SDK show the flows however old they are")
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the files written, and what each holds and needs, as JSON")
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		if *out == "" {
			return cli.MissingInput("--out", bundleUsage)
		}
		notAfter, err := bundleExpiry(app.Now(), *notAfterFlag, *noExpiry)
		if err != nil {
			return err
		}
		revisions, err := parseRevisions(*revisionFlags)
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		projectID := target.Project.Id
		locations, err := chooseLocations(ctx, app, projectID, args)
		if err != nil {
			return err
		}
		for key := range revisions {
			if !slices.ContainsFunc(locations, func(location paywalls.Location) bool { return location.Slug == key || location.ID == key }) {
				return cli.Usagef("--revision names %q, which is not among the locations to bundle.", key).
					WithHint("Name it by its slug, as --revision <location>=<n>.")
			}
		}

		var all []bundled
		for _, location := range locations {
			revision, given := revisions[location.Slug]
			if !given {
				revision = revisions[location.ID]
			}
			one, err := bundleLocation(ctx, app, projectID, location, revision, notAfter)
			if err != nil {
				return err
			}
			all = append(all, one)
		}

		// Relative to the directory the command runs in; the result names the files as given.
		dir := *out
		if !filepath.IsAbs(dir) {
			dir = filepath.Join(app.Dir, dir)
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return cli.Failf("Could not create %s: %v", *out, err)
		}
		// Every package before any answer: a run stopped midway leaves an answer beside the
		// package it names, old or new, and the SDK refuses a package its answer does not name.
		for _, one := range all {
			if err := writeBundleFile(dir, *out, one.location.Slug+".vhfp", one.pkg); err != nil {
				return err
			}
		}
		for _, one := range all {
			if err := writeBundleFile(dir, *out, one.location.Slug+".json", one.answer); err != nil {
				return err
			}
		}

		results := make([]bundleResult, len(all))
		for index, one := range all {
			release := one.view.Showing.PaywallRelease
			results[index] = bundleResult{
				Location: one.location.Slug, AnswerFile: filepath.Join(*out, one.location.Slug+".json"),
				PackageFile: filepath.Join(*out, one.location.Slug+".vhfp"), PackageBytes: len(one.pkg),
				SHA256: strings.ToLower(release.FlowPackage.SHA256), InterfaceRevision: one.fetched.InterfaceRevision,
				PaywallID: one.view.Showing.PaywallID, ReleaseID: release.ReleaseID, BuildNumber: release.Version,
				PackageFormat: one.fetched.Requirements.PackageFormat, NativeComponents: one.fetched.Requirements.NativeComponents,
				Experiment: one.fetched.Experiment, WithdrawnBuild: one.fetched.WithdrawnBuild,
			}
			if results[index].NativeComponents == nil {
				results[index].NativeComponents = []nativeComponent{}
			}
			if one.notAfter != "" {
				results[index].NotAfter = &one.notAfter
			}
		}
		for _, one := range all {
			noteBundle(app, one, revisions)
		}
		if notAfter == "" {
			app.Warnf("The flows never expire: an app shows them offline however old they are, even after a product they offer is unlinked. Bundle again with each release.")
		}
		if *asJSON {
			return app.PrintJSON(results)
		}
		for index, one := range all {
			app.Println(describeBundle(one, results[index]))
		}
		return nil
	}
	return cmd
}

// bundleExpiry is the notAfter to write: empty with --no-expiry, the time
// --not-after gives, or [defaultBundleLifetime] from the start of today in
// UTC, so runs on the same day write the same files.
func bundleExpiry(now time.Time, given string, noExpiry bool) (string, error) {
	if noExpiry && given != "" {
		return "", cli.Usagef("--not-after and --no-expiry cannot be combined.").
			WithHint("Pass --not-after for a time the flows stop being shown, or --no-expiry for none.")
	}
	if noExpiry {
		return "", nil
	}
	if given == "" {
		return now.UTC().Truncate(24 * time.Hour).Add(defaultBundleLifetime).Format(time.RFC3339), nil
	}
	at, err := time.Parse(time.RFC3339Nano, given)
	if err != nil {
		if at, err = time.Parse("2006-01-02", given); err != nil {
			return "", cli.Usagef("--not-after %q is not a date or a time.", given).
				WithHint("Pass a date such as 2027-03-01, or a time with its zone such as 2027-03-01T00:00:00Z.")
		}
	}
	if !at.After(now) {
		return "", cli.Usagef("--not-after %s has passed, so the SDK would never show the flows.", given).
			WithHint("Pass a later date, such as one 90 days from today.")
	}
	return at.UTC().Truncate(time.Second).Format(time.RFC3339), nil
}

// parseRevisions reads --revision <location>=<n> values.
func parseRevisions(values []string) (map[string]int, error) {
	revisions := map[string]int{}
	for _, value := range values {
		key, number, found := strings.Cut(value, "=")
		revision, err := strconv.Atoi(number)
		if !found || key == "" || err != nil || revision < 0 {
			return nil, cli.Usagef("--revision %q is not <location>=<n>.", value).
				WithHint("Pass the location's slug and the revision your app presents it at, such as --revision onboarding=3.")
		}
		revisions[key] = revision
	}
	return revisions, nil
}

// chooseLocations finds the locations named, each once, or asks for one on
// a terminal.
func chooseLocations(ctx context.Context, app *cli.App, projectID string, inputs []string) ([]paywalls.Location, error) {
	all, err := paywalls.ListLocations(ctx, app, projectID)
	if err != nil {
		return nil, err
	}
	if len(inputs) == 0 {
		inUse := all.Filter(func(location paywalls.Location) bool { return !location.IsArchived })
		location, err := cli.RequireItem(ctx, app, paywalls.LocationKind, inUse.Items, "", bundleUsage)
		if err != nil {
			return nil, err
		}
		return []paywalls.Location{location}, nil
	}
	var chosen []paywalls.Location
	for _, input := range inputs {
		location, err := cli.FindItem(paywalls.LocationKind, all.Items, input)
		if err != nil {
			return nil, err
		}
		if !slices.ContainsFunc(chosen, func(other paywalls.Location) bool { return other.ID == location.ID }) {
			chosen = append(chosen, location)
		}
	}
	return chosen, nil
}

// bundleLocation reads the location's answer for an app at revision,
// downloads the package it names and checks it, without writing anything.
// The file holds the answer as the API gave it, members a newer SDK may read
// included, but for what must not ship; its keys are sorted, so the same
// answer is the same bytes.
func bundleLocation(ctx context.Context, app *cli.App, projectID string, location paywalls.Location, revision int, notAfter string) (bundled, error) {
	if err := refuseArchived(location); err != nil {
		return bundled{}, err
	}
	if !bundleFileName.MatchString(location.Slug) {
		return bundled{}, cli.Failf("%s cannot be bundled: the SDKs read its files by its slug, which is not a plain file name.", label(location))
	}
	fetched, err := cli.Fetch[defaultAnswer](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaywallLocationsGetDefaultAnswer(ctx, projectID, location.ID, &api.PaywallLocationsGetDefaultAnswerParams{InterfaceRevision: &revision})
	})
	if err != nil {
		return bundled{}, cli.APIError(err, map[string]string{
			"paywall_location_shows_nothing": fmt.Sprintf("Show a paywall there first: 'voidhash location show %s <paywall>'.", location.Slug),
			"paywall_release_withdrawn":      fmt.Sprintf("Deploy a build that is not withdrawn ('voidhash paywall deploy <paywall>'), then bundle %s again.", location.Slug),
			"paywall_interface_revision_unsupported": fmt.Sprintf(
				"Pass the revision your app presents %s at (its flowRevisions, or the generated types) as --revision %s=<n>.", location.Slug, location.Slug),
		})
	}
	unreadable := cli.Failf("The Voidhash API answered with an answer for %s that could not be read.", label(location))
	var view answerView
	if err := json.Unmarshal(fetched.Value.Answer, &view); err != nil {
		return bundled{}, unreadable
	}
	release := view.Showing.PaywallRelease
	if view.Location.Slug != location.Slug || release == nil || release.FlowPackage == nil {
		return bundled{}, cli.Failf("The answer for %s names no flow package, so there is nothing to bundle.", label(location))
	}
	decoder := json.NewDecoder(bytes.NewReader(fetched.Value.Answer))
	decoder.UseNumber()
	var answer map[string]any
	if err := decoder.Decode(&answer); err != nil {
		return bundled{}, unreadable
	}
	// What must not ship, should a server send it: a token that counts a person in an A/B
	// test, and the withdrawn packages of one device's answer.
	delete(answer, "withdrawnPackages")
	if showing, ok := answer["showing"].(map[string]any); ok {
		delete(showing, "exposureToken")
	}
	answer["interfaceRevision"] = fetched.Value.InterfaceRevision
	if notAfter != "" {
		answer["notAfter"] = notAfter
	}

	data, err := downloadPackage(ctx, app, location, release.FlowPackage.URL)
	if err != nil {
		return bundled{}, err
	}
	sum := sha256.Sum256(data)
	if hex.EncodeToString(sum[:]) != strings.ToLower(release.FlowPackage.SHA256) {
		return bundled{}, cli.Failf("The flow package downloaded for %s does not match the SHA-256 its answer names, so nothing was written.", label(location)).
			WithHint("Try again; if it keeps failing, the download is being changed on its way.")
	}

	var encoded bytes.Buffer
	encoder := json.NewEncoder(&encoded)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(answer); err != nil {
		return bundled{}, err
	}
	return bundled{location: location, view: view, fetched: fetched.Value, answer: encoded.Bytes(), pkg: data, notAfter: notAfter}, nil
}

// downloadPackage reads the flow package at url, sending no credential.
func downloadPackage(ctx context.Context, app *cli.App, location paywalls.Location, url string) ([]byte, error) {
	failed := func(reason string) error {
		return cli.Failf("Could not download the flow package of %s: %s.", label(location), reason).
			WithHint("Check your connection and try again; nothing was written.")
	}
	download, cancel := context.WithTimeout(ctx, bundleDownloadTimeout)
	defer cancel()
	// A download that ran out of time, rather than one the person stopped.
	timedOut := func(err error) bool { return errors.Is(err, context.DeadlineExceeded) && ctx.Err() == nil }
	request, err := http.NewRequestWithContext(download, http.MethodGet, url, nil)
	if err != nil {
		return nil, failed("its address cannot be read")
	}
	response, err := app.HTTPClient().Do(request)
	if err != nil {
		if timedOut(err) {
			return nil, failed("it took longer than 2 minutes")
		}
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, failed(err.Error())
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, failed(fmt.Sprintf("HTTP %d", response.StatusCode))
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, maxFlowPackageBytes+1))
	if err != nil {
		if timedOut(err) {
			return nil, failed("it took longer than 2 minutes")
		}
		return nil, failed(err.Error())
	}
	if len(data) > maxFlowPackageBytes {
		return nil, failed("it is larger than the SDKs read")
	}
	return data, nil
}

// writeBundleFile writes data as name in dir through a temporary file renamed
// over it, so the file is never half written, leaving a file that already
// holds the same bytes untouched. shown is dir as the person gave it.
func writeBundleFile(dir, shown, name string, data []byte) error {
	path := filepath.Join(dir, name)
	failed := func(err error) error {
		return cli.Failf("Could not write %s: %v", filepath.Join(shown, name), err).
			WithHint("Files written before it were replaced; run it again once the folder can be written.")
	}
	if existing, err := os.ReadFile(path); err == nil && bytes.Equal(existing, data) {
		return nil
	}
	temporary, err := os.CreateTemp(dir, "."+name+".*")
	if err != nil {
		return failed(err)
	}
	// Gone after the rename; left behind by nothing that fails.
	defer os.Remove(temporary.Name())
	if _, err := temporary.Write(data); err != nil {
		temporary.Close()
		return failed(err)
	}
	if err := temporary.Close(); err != nil {
		return failed(err)
	}
	if err := os.Chmod(temporary.Name(), 0o644); err != nil {
		return failed(err)
	}
	if err := os.Rename(temporary.Name(), path); err != nil {
		return failed(err)
	}
	return nil
}

// noteBundle says on standard error what a developer should know of a
// location's bundle: a withdrawn build passed over, an A/B test's control
// arm, and a revision that may not be the app's.
func noteBundle(app *cli.App, one bundled, revisions map[string]int) {
	name := cli.Printable(label(one.location))
	if withdrawn := one.fetched.WithdrawnBuild; withdrawn != nil {
		app.Warnf("%s shows build #%d, which is withdrawn: bundled build #%d, which apps are served instead.",
			name, withdrawn.BuildNumber, one.view.Showing.PaywallRelease.Version)
	}
	if test := one.fetched.Experiment; test != nil {
		holds := "runs the A/B test"
		if test.Status != "running" {
			holds = "has the " + test.Status + " A/B test"
		}
		app.Notef("%s %s %q (%s): bundled its control arm. People shown the bundled flow are in no arm, and their purchases count for none.",
			name, holds, cli.Printable(test.Name), test.ID)
	}
	_, given := revisions[one.location.Slug]
	if _, byID := revisions[one.location.ID]; !given && !byID && one.view.Location.InterfaceRevision > 0 {
		app.Notef("%s's interface is at revision %d, and this flow is for an app that names no revision. If your app presents it at a revision (its flowRevisions, or the generated types), pass --revision %s=<n>: the SDK skips a flow taken for another revision.",
			name, one.view.Location.InterfaceRevision, one.location.Slug)
	}
}

// describeBundle is a location's line of the result, with what an app's SDK
// needs to show it.
func describeBundle(one bundled, result bundleResult) string {
	shows := "build #" + strconv.Itoa(result.BuildNumber)
	if paywall := one.view.Showing.Paywall; paywall != nil {
		shows = fmt.Sprintf("%s (%s), %s", paywall.Name, paywall.Slug, shows)
	}
	until := "with no expiry"
	if result.NotAfter != nil {
		until = "until " + strings.TrimSuffix(*result.NotAfter, "T00:00:00Z")
	}
	needs := fmt.Sprintf("needs an SDK that reads flow package format %d", result.PackageFormat)
	if len(result.NativeComponents) > 0 {
		natives := make([]string, len(result.NativeComponents))
		for index, native := range result.NativeComponents {
			natives[index] = native.ID
			if native.Version != nil {
				natives[index] += " " + *native.Version
			}
		}
		needs += " and provides " + strings.Join(natives, ", ")
	}
	return cli.Printable(fmt.Sprintf("%s: %s, for revision %d, %s; %s. Wrote %s and %s.",
		label(one.location), shows, result.InterfaceRevision, until, needs, result.AnswerFile, result.PackageFile))
}
