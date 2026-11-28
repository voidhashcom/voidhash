package integrate

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/integrate"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// noNewErrors says so when the check's errors could be compared.
func noNewErrors(check checkResult) string {
	if check.compared {
		return ", with no new errors"
	}
	return ""
}

func plural(count int, noun string) string {
	if count == 1 {
		return "1 " + noun
	}
	return strconv.Itoa(count) + " " + noun + "s"
}

// short writes a duration as people pass it: 2m, not 2m0s.
func short(duration time.Duration) string {
	text := duration.String()
	// time prints the units that are zero too.
	if strings.HasSuffix(text, "m0s") {
		text = strings.TrimSuffix(text, "0s")
	}
	if strings.HasSuffix(text, "h0m") {
		text = strings.TrimSuffix(text, "0m")
	}
	return text
}

// checkResult is how one of the project's checks went after the changes.
type checkResult struct {
	Command string `json:"command"`
	Passed  bool   `json:"passed"`
	// FailedBefore is true when it failed before anything changed too.
	FailedBefore bool `json:"failedBefore"`
	// NewErrors counts the errors of a check that failed before too which
	// its output did not have then.
	NewErrors int `json:"newErrors"`
	// compared is true when its output could be compared with the one from
	// before the changes.
	compared bool
	output   string
}

// position is where in a file a compiler reports an error, which moves
// when lines are added above it.
var position = regexp.MustCompile(`\(\d+,\d+\)|:\d+(:\d+)?`)

// errorLines are the lines of a check's output that report an error,
// without their positions, so the same error on another line is the same.
func errorLines(output string) []string {
	var lines []string
	for _, line := range strings.Split(output, "\n") {
		if strings.Contains(strings.ToLower(line), "error") {
			lines = append(lines, position.ReplaceAllString(strings.TrimSpace(line), ""))
		}
	}
	return lines
}

// newErrors are the errors in output that the check's output before any
// change did not have, as the check printed them.
func newErrors(before, output string) []string {
	known := map[string]int{}
	for _, line := range errorLines(before) {
		known[line]++
	}
	var added []string
	for _, line := range strings.Split(output, "\n") {
		normalized := errorLines(line)
		if len(normalized) == 0 {
			continue
		}
		if known[normalized[0]] > 0 {
			known[normalized[0]]--
			continue
		}
		added = append(added, strings.TrimSpace(line))
	}
	return added
}

// baselineLog names the file that keeps a check's output from before any
// change, by the check's place in the list.
func baselineLog(index int) string { return "baseline-" + strconv.Itoa(index) + ".log" }

// First request states.
const (
	requestSeen       = "seen"
	requestNotSeen    = "not_seen"
	requestNotChecked = "not_checked"
)

// verify checks the result without taking anyone's word for it: the
// project's checks, the SDK in the code, and the app's first request.
func (r *run) verify(ctx context.Context) error {
	r.result.firstRequest = requestNotChecked
	// A task that was handed off just now has nothing to check yet.
	if r.result.handedOffNow {
		return nil
	}
	if err := r.runChecks(ctx); err != nil {
		return err
	}
	// One round of repair, by the agent that did the work, with the failing
	// output. More rounds rarely help and cost the person's time.
	if failed := r.newFailure(); failed != nil && r.result.agentRan && r.state.Session != "" {
		r.app.Notef("%s fails after the changes. %s gets one go at fixing it…", failed.Command, r.agent.Name())
		if err := r.askAgent(ctx, integrate.FixTask(failed.Command, failed.output), r.state.Session); err != nil {
			return err
		}
		if err := r.runChecks(ctx); err != nil {
			return err
		}
	}
	// The client module names the provider in its own comment, whoever
	// wrote it; using it is what counts.
	r.result.wiredIn, _ = integrate.FindMarker(r.platform, r.app.Dir, append([]string{r.facts.ClientFile}, r.state.Wrote...))
	if r.result.wiredIn != "" {
		r.step("The SDK is in your code: %s", r.result.wiredIn)
	}
	if r.newFailure() == nil && r.result.wiredIn != "" {
		return r.awaitFirstRequest(ctx)
	}
	return nil
}

// newFailure is the first check the changes broke: one that passed before
// and fails now, or one that failed before and now reports errors it did
// not then.
func (r *run) newFailure() *checkResult {
	for index := range r.result.checks {
		if check := &r.result.checks[index]; !check.Passed && (!check.FailedBefore || check.NewErrors > 0) {
			return check
		}
	}
	return nil
}

func (r *run) runChecks(ctx context.Context) error {
	r.result.checks = nil
	for index, command := range r.checks {
		joined := strings.Join(command, " ")
		r.app.Notef("Running %s…", joined)
		output, code, err := r.capture(ctx, command[0], command[1:]...)
		if interrupted(ctx, err) {
			return ctx.Err()
		}
		check := checkResult{Command: joined, Passed: err == nil && code == 0, output: output}
		for _, before := range r.state.BaselineFailed {
			check.FailedBefore = check.FailedBefore || before == joined
		}
		if err != nil {
			check.output = err.Error()
		}
		if !check.Passed && check.FailedBefore {
			// Without the output from before, nothing can be told apart.
			if before, err := os.ReadFile(filepath.Join(r.app.Dir, filepath.FromSlash(integrate.StateDir), baselineLog(index))); err == nil {
				check.compared = true
				if added := newErrors(string(before), check.output); len(added) > 0 {
					check.NewErrors, check.output = len(added), strings.Join(added, "\n")
				}
			}
		}
		switch {
		case check.Passed:
			r.step("%s passes", joined)
		case check.NewErrors > 0:
			r.app.Warnf("%s failed before any change too, and now reports %s it did not then.", joined, plural(check.NewErrors, "error"))
		case check.FailedBefore:
			r.app.Warnf("%s fails as it did before any change%s.", joined, noNewErrors(check))
		default:
			r.app.Warnf("%s fails after the changes.", joined)
		}
		r.result.checks = append(r.result.checks, check)
	}
	return nil
}

// awaitFirstRequest waits for an event from the app to reach the project,
// which shows the SDK starts with the right key against the right server.
// It waits only when asked: on a terminal after a question, or for --wait.
func (r *run) awaitFirstRequest(ctx context.Context) error {
	if r.platform.Key != integrate.PublishableKey {
		return nil
	}
	wait := r.opts.wait
	if wait == 0 {
		if r.opts.yes || !r.app.IsInteractive() {
			return nil
		}
		start, err := r.app.Prompter().Confirm(ctx, "Start the app now ("+r.platform.Run+") and wait for its first event to arrive?", true)
		if err != nil || !start {
			return err
		}
		wait = 5 * time.Minute
	}
	since := r.app.Now()
	deadline := since.Add(wait)
	r.app.Notef("Waiting up to %s for the app's first event. Start it now: %s", short(wait), r.platform.Run)
	for {
		// The tracking report covers every environment, so it also sees
		// what a debug build sends with the test key.
		health, err := cli.Fetch[struct {
			Apps []struct {
				Platform    string `json:"platform"`
				LastEventAt string `json:"lastEventAt"`
			} `json:"apps"`
			Web struct {
				LastEventAt *string `json:"lastEventAt"`
			} `json:"web"`
		}](ctx, r.app, func(c *api.Client) (*http.Response, error) {
			return c.AnalyticsReportTrackingHealth(ctx, r.target.ID)
		})
		if err != nil {
			if interrupted(ctx, err) {
				return ctx.Err()
			}
			// A report the credential cannot read leaves it unchecked.
			r.app.Warnf("Could not look for the app's events, so its first event is not checked ('voidhash analytics health' shows what is reporting).")
			return nil
		}
		seen := map[string]string{}
		if health.Value.Web.LastEventAt != nil {
			seen["the web"] = *health.Value.Web.LastEventAt
		}
		for _, app := range health.Value.Apps {
			seen[map[string]string{"ios": "iOS", "android": "Android"}[app.Platform]] = app.LastEventAt
		}
		for source, at := range seen {
			if received, err := time.Parse(time.RFC3339, at); err == nil && !received.Before(since.Add(-time.Second)) {
				r.result.firstRequest, r.result.firstEvent = requestSeen, source
				r.step("The app's first event arrived, from %s", source)
				return nil
			}
		}
		if !r.app.Now().Before(deadline) {
			r.result.firstRequest = requestNotSeen
			r.app.Warnf("No event arrived within %s. 'voidhash analytics health' shows what is reporting.", short(wait))
			return nil
		}
		if err := r.app.Sleep(ctx, 3*time.Second); err != nil {
			return err
		}
	}
}

// connectAgents adds the Voidhash MCP server to the person's AI agents,
// when --mcp asks for it or they agree on a terminal.
func (r *run) connectAgents(ctx context.Context) error {
	if r.opts.mcp {
		return r.sub(ctx, r.app.Stderr, "mcp", "install", "--yes")
	}
	if r.opts.yes || !r.app.IsInteractive() || r.resumed {
		return nil
	}
	connect, err := r.app.Prompter().Confirm(ctx, "Connect your AI agents (Claude Code, Cursor, Codex, ...) to Voidhash too, so they can read and change the project as you?", true)
	if err != nil || !connect {
		return err
	}
	return r.sub(ctx, r.app.Stderr, "mcp", "install")
}
