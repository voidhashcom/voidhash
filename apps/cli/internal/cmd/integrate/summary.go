package integrate

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/integrate"
)

// result is what a run found out, for the summary.
type result struct {
	// agentRan is true when the agent worked in this run.
	agentRan bool
	// handedOffNow is true when this run wrote the task for the person.
	handedOffNow bool
	checks       []checkResult
	// wiredIn is the file the SDK was found in, or empty.
	wiredIn string
	// firstRequest is seen, not_seen or not_checked; firstEvent names
	// where the event that was seen came from.
	firstRequest, firstEvent string
}

// Outcomes of a run.
const (
	// outcomeVerified: the checks pass and the SDK is in the code.
	outcomeVerified = "verified"
	// outcomeIncomplete: something the run checks is not there yet.
	outcomeIncomplete = "incomplete"
	// outcomeHandedOff: the task is written and waits to be done.
	outcomeHandedOff = "handed_off"
)

// printPlan says, before anything changes, what the run will do.
func (r *run) printPlan() {
	style := r.app.ErrStyle()
	note := r.app.Notef
	support := ""
	if r.platform.Support == integrate.BestEffort {
		support = " (best effort: fewer of its steps are checked than on Expo, Next.js and React)"
	}
	note("%s", style.Bold(fmt.Sprintf("Integrate Voidhash into this %s app, for the project %s (%s/%s)%s",
		r.platform.Name, cli.Printable(r.target.Name), r.organization.Slug, r.target.Slug, support)))
	if r.resumed {
		note("Continuing the run started %s. What is already done is not repeated.", r.app.FormatTimeAgo(r.state.StartedAt.Format("2006-01-02T15:04:05Z07:00")))
	}
	note("")
	note("The CLI:")
	number := 0
	item := func(format string, args ...any) {
		number++
		note("  %d. %s", number, fmt.Sprintf(format, args...))
	}
	if len(r.checks) > 0 && !r.state.BaselineRun {
		item("runs your checks before changing anything, to know what already fails: %s", strings.Join(r.facts.Checks, "; "))
	}
	for _, creation := range r.create {
		item("creates the %s %s in the project", creation.what, creation.slug)
	}
	if missing := integrate.MissingPackages(r.platform, r.project); len(missing) > 0 {
		item("installs %s with %s", packageNames(missing), r.project.PackageManager)
	}
	if files := r.pendingFiles(); len(files) > 0 {
		item("writes %s", strings.Join(files, ", "))
	}
	switch {
	case r.agent == nil:
		item("writes the task of wiring the SDK into your code to %s, for you or an agent of your own", integrate.TaskPath)
	case r.state.AgentStage == integrate.AgentFinished && r.state.Agent == r.agent.ID():
	default:
		who := r.agent.Name()
		if r.model != "" {
			who += ", on the model " + r.model + ","
		}
		item("runs %s to wire the SDK into your code (%s). It:", who, r.wiring())
		for _, limit := range r.agent.Limits(r.job("", "", nil)) {
			note("       - %s", limit)
		}
		note("       Its task is written to %s first.", integrate.TaskPath)
	}
	if len(r.checks) > 0 {
		item("runs your checks again, and looks for the SDK in your code")
	} else {
		item("looks for the SDK in your code (it found no typecheck or build to run; --check names one)")
	}
	note("")
	if r.inGit && !r.opts.allowDirty {
		note("Nothing is committed. Review with 'git status' and 'git diff'; undo with 'git restore . && git clean -fd'.")
	} else {
		note("Nothing is committed.")
	}
	note("")
}

// pendingFiles are the files the run will write: the ones that are not
// there yet, the environment file when it lacks a variable, and the
// generated types, which are written from the project every time.
func (r *run) pendingFiles() []string {
	var files []string
	if _, found, _ := r.app.DirectoryConfig(); !found {
		files = append(files, "voidhash.json")
	}
	if r.facts.ClientFile != "" {
		if _, err := os.Stat(filepath.Join(r.app.Dir, filepath.FromSlash(r.facts.ClientFile))); err != nil {
			files = append(files, r.facts.ClientFile)
		}
	}
	if missing := r.missingEnv(); len(missing) > 0 {
		files = append(files, r.facts.EnvFile+" ("+strings.Join(missing, ", ")+")")
	}
	return append(files, r.facts.TypesFiles...)
}

// wiring words what the agent is asked to wire, from what the project has.
func (r *run) wiring() string {
	parts := []string{"start the SDK"}
	if r.platform.Has("identify") {
		parts = append(parts, "identify the user")
	}
	if !r.platform.Has("perks") && r.platform.Has("events") {
		parts = append(parts, "track a key event")
	}
	if r.facts.Perk != "" {
		parts = append(parts, "gate on "+r.facts.Perk)
	}
	if r.facts.Product != "" {
		parts = append(parts, "sell "+r.facts.Product)
	}
	if r.facts.Location != "" {
		parts = append(parts, "present "+r.facts.Location)
	}
	return strings.Join(parts, ", ")
}

// changedFiles are the files git shows as changed or new in the project,
// as `git status --porcelain` prints them: what really changed, whoever
// says what.
func (r *run) changedFiles(ctx context.Context) []string {
	if !r.inGit {
		return nil
	}
	status, code, err := r.capture(ctx, "git", "status", "--porcelain", "--untracked-files=all", "--", ".")
	if err != nil || code != 0 {
		return nil
	}
	var files []string
	for _, line := range strings.Split(status, "\n") {
		if strings.TrimSpace(line) != "" {
			files = append(files, strings.TrimRight(line, "\r"))
		}
	}
	return files
}

// summarize prints the result: what is verified, what changed, and what
// is left for the person. It fails the command when the run is incomplete.
func (r *run) summarize(ctx context.Context) error {
	outcome := outcomeIncomplete
	switch {
	case r.result.handedOffNow:
		outcome = outcomeHandedOff
	case r.newFailure() == nil && r.result.wiredIn != "":
		outcome = outcomeVerified
	}
	changed := r.changedFiles(ctx)
	left := r.leftForYou(outcome)

	if r.opts.json {
		agent := map[string]any{"id": noAgent, "status": r.state.AgentStage}
		if r.state.Agent != "" && r.state.AgentStage != integrate.AgentHandedOff {
			agent["id"] = r.state.Agent
		}
		if r.state.Report != nil {
			agent["report"] = r.state.Report
		}
		checks := r.result.checks
		if checks == nil {
			checks = []checkResult{}
		}
		var wiredIn any
		if r.result.wiredIn != "" {
			wiredIn = r.result.wiredIn
		}
		if err := r.app.PrintJSON(map[string]any{
			"outcome":      outcome,
			"platform":     map[string]any{"id": r.platform.ID, "name": r.platform.Name, "support": r.platform.Support},
			"project":      map[string]any{"id": r.target.ID, "slug": r.target.Slug, "organization": r.organization.Slug},
			"agent":        agent,
			"checks":       checks,
			"sdkFoundIn":   wiredIn,
			"firstRequest": r.result.firstRequest,
			"changedFiles": orEmpty(changed),
			"leftForYou":   orEmpty(left),
			"task":         integrate.TaskPath,
		}); err != nil {
			return err
		}
	} else {
		r.printSummary(outcome, changed, left)
	}
	if outcome == outcomeIncomplete {
		return &cli.UserError{
			Message: "The integration is not complete yet: " + r.missing() + ".",
			Hint:    "Finish what is listed, then run 'voidhash integrate' again: it only checks what is left.",
		}
	}
	return nil
}

func orEmpty(items []string) []string {
	if items == nil {
		return []string{}
	}
	return items
}

// missing says what keeps the run from being verified.
func (r *run) missing() string {
	var parts []string
	if failed := r.newFailure(); failed != nil && failed.NewErrors > 0 {
		parts = append(parts, failed.Command+" reports "+plural(failed.NewErrors, "new error"))
	} else if failed != nil {
		parts = append(parts, failed.Command+" fails")
	}
	if r.result.wiredIn == "" {
		parts = append(parts, "the SDK is not started anywhere in your code")
	}
	return strings.Join(parts, ", and ")
}

// leftForYou lists what stays with the person: what the run could not
// finish, what the agent left, and what is always theirs on the platform.
func (r *run) leftForYou(outcome string) []string {
	var left []string
	switch outcome {
	case outcomeHandedOff:
		left = append(left,
			"Give "+integrate.TaskPath+" to your coding agent (\"Follow the instructions in "+integrate.TaskPath+"\"), or follow it yourself.",
			"Run 'voidhash integrate' again when that is done: it checks the result.")
	case outcomeIncomplete:
		if failed := r.newFailure(); failed != nil && failed.NewErrors > 0 {
			left = append(left, "Fix the errors '"+failed.Command+"' did not report before the changes:\n"+failed.output)
		} else if failed != nil {
			left = append(left, "Fix what '"+failed.Command+"' reports; it passed before the changes.")
		}
		if r.result.wiredIn == "" {
			left = append(left, "Start the SDK in your code: "+integrate.TaskPath+" has the steps.")
		}
	}
	if r.state.Report != nil {
		left = append(left, r.state.Report.LeftForYou...)
	}
	if outcome != outcomeHandedOff {
		if r.result.firstRequest != requestSeen && r.platform.Key == integrate.PublishableKey {
			left = append(left, "Start the app ("+r.platform.Run+"), then see that its events arrive: 'voidhash analytics health'.")
		}
	}
	return append(left, r.platform.LeftForYou...)
}

func (r *run) printSummary(outcome string, changed, left []string) {
	app := r.app
	label := cli.Printable(r.target.Name) + " (" + r.organization.Slug + "/" + r.target.Slug + ")"
	switch outcome {
	case outcomeVerified:
		checked := " and checked"
		for _, check := range r.result.checks {
			if !check.Passed {
				// A check that never passed can only be compared with itself.
				checked = ". A check that failed before the changes still fails"
			}
		}
		if len(r.result.checks) == 0 {
			checked = ". No check was run"
		}
		app.Printf("Voidhash is integrated into this %s app%s.\n", r.platform.Name, checked)
		if report := r.state.Report; report != nil && report.Status != integrate.StatusDone {
			app.Println("The agent did not finish every step: see what it says, and what is left for you.")
		}
	case outcomeHandedOff:
		app.Printf("Voidhash is set up for this %s app. Wiring it into your code is written down as a task.\n", r.platform.Name)
	default:
		app.Printf("Voidhash is partly integrated into this %s app.\n", r.platform.Name)
	}
	fields := []cli.Field{{Label: "Project", Value: label}}
	switch {
	case r.state.AgentStage == integrate.AgentHandedOff:
		fields = append(fields, cli.Field{Label: "Task", Value: integrate.TaskPath})
	case r.state.Agent != "":
		status := "finished without a report"
		if r.state.Report != nil {
			status = "reports " + r.state.Report.Status
		}
		fields = append(fields, cli.Field{Label: "Agent", Value: agentName(r.state.Agent) + ", " + status})
	}
	if outcome != outcomeHandedOff {
		var checks []string
		for _, check := range r.result.checks {
			switch {
			case check.Passed:
				checks = append(checks, check.Command+" passes")
			case check.NewErrors > 0:
				checks = append(checks, check.Command+" FAILS, with "+plural(check.NewErrors, "error")+" it did not report before the changes")
			case check.FailedBefore:
				checks = append(checks, check.Command+" fails as before the changes"+noNewErrors(check))
			default:
				checks = append(checks, check.Command+" FAILS")
			}
		}
		if len(checks) == 0 {
			checks = []string{"none run (pass --check to name one)"}
		}
		fields = append(fields, cli.Field{Label: "Checks", Value: strings.Join(checks, "\n")})
		found := "not found in your code"
		if r.result.wiredIn != "" {
			found = "started in " + r.result.wiredIn
		}
		fields = append(fields, cli.Field{Label: "SDK", Value: found})
		request := map[string]string{
			requestSeen:       "arrived, from " + cli.Printable(r.result.firstEvent),
			requestNotSeen:    "no event arrived while waiting",
			requestNotChecked: "not checked",
		}[r.result.firstRequest]
		if r.platform.Key == integrate.PublishableKey {
			fields = append(fields, cli.Field{Label: "First event", Value: request})
		}
	}
	app.Println(cli.FormatFields(fields))

	if report := r.state.Report; report != nil && outcome != outcomeHandedOff {
		app.Println("")
		app.Println(agentName(r.state.Agent) + " says:")
		app.Println("  " + strings.ReplaceAll(cli.PrintableLines(strings.TrimSpace(report.Summary)), "\n", "\n  "))
		for _, note := range report.Notes {
			app.Println("  - " + cli.Printable(note))
		}
	}
	if len(changed) > 0 {
		app.Println("")
		app.Println("Changed files, as git shows them:")
		for _, line := range changed {
			app.Println("  " + cli.Printable(line))
		}
	}
	if len(left) > 0 {
		app.Println("")
		app.Println("Left for you:")
		for index, step := range left {
			app.Printf("  %d. %s\n", index+1, strings.ReplaceAll(cli.PrintableLines(step), "\n", "\n     "))
		}
	}
	if outcome != outcomeHandedOff && r.inGit {
		app.Println("")
		app.Println("Nothing is committed. Review the changes with 'git diff' before you commit them.")
	}
}
