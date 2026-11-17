// Package dev holds the `voidhash dev` command.
package dev

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/crate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/devserver"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/workingcopy"
)

const (
	// quietPeriod: changes this close together start one build.
	quietPeriod = 200 * time.Millisecond
	// syncInterval is how often `dev` looks for newer versions of the
	// working copy's components.
	syncInterval = 15 * time.Second
)

// New creates `voidhash dev [--port]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "dev",
		Short: "Build the project's components on every change and serve them to your paywall editor.",
		Long: `Keep the project's components in the working copy .voidhash/, build each with the local Rust toolchain and rebuild it on every change, and serve the builds on 127.0.0.1.

While it runs, a dev session tells the paywall editor of the signed-in person where the builds are, so an editor of this project that you have open shows them on its own. Every 15 seconds newer catalog versions are merged into the working copy. Press Ctrl+C to stop; that ends the session.

Run it in your project's root, where voidhash.json is. Building needs Rust with the wasm32-unknown-unknown target (https://rustup.rs, then 'rustup target add wasm32-unknown-unknown').`,
		Example: `voidhash dev
voidhash dev --port 4400`,
	}
	port := cmd.Flags().Int("port", devserver.DefaultPort, "Port on 127.0.0.1")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if *port < 0 || *port > 65535 {
			return cli.Usagef("--port takes a port number, 1 to 65535; got %d.", *port)
		}
		target, err := componentapi.Open(ctx, app)
		if err != nil {
			return err
		}
		secret := make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			return &cli.UserError{Message: "Could not make the dev server's token: " + err.Error(), Cause: err}
		}
		run := &run{
			app:           app,
			target:        target,
			workingCopy:   target.WorkingCopy,
			catalog:       componentapi.Catalog{App: app, ProjectID: target.Project.Id},
			build:         crate.ExecRunner(app.Getenv),
			state:         devserver.NewState(app.Now),
			token:         base64.RawURLEncoding.EncodeToString(secret),
			titles:        map[string]string{},
			announced:     map[string]bool{},
			changed:       map[string]bool{},
			finished:      make(chan buildResult, 1),
			fileChanges:   make(chan []string),
			requestedPort: *port,
		}
		return run.serve(ctx)
	}
	return cmd
}

type buildResult struct {
	building devserver.Building
	slug     string
	built    *crate.Build
	err      error
}

// run is one `voidhash dev`. Everything that prints, calls the API or
// changes the working copy happens on the goroutine of serve; builds, the
// look for changed files and the HTTP server run beside it and report back
// over channels.
type run struct {
	app           *cli.App
	target        *componentapi.Target
	workingCopy   *workingcopy.WorkingCopy
	catalog       componentapi.Catalog
	build         crate.Runner
	state         *devserver.State
	token         string
	requestedPort int

	// titles are the titles the server lists, by slug.
	titles map[string]string
	// announced holds the components without source that were mentioned.
	announced map[string]bool

	// changed holds the components whose files changed since their last
	// build; queue the ones being built now, one at a time.
	changed    map[string]bool
	queue      []string
	isBuilding bool
	// wantsBuild says the changed components are due: their files were
	// quiet for a moment.
	wantsBuild  bool
	finished    chan buildResult
	fileChanges chan []string
	builds      sync.WaitGroup
}

func (r *run) warn(slug string, err error) {
	r.app.Warnf("%s", cli.PrintableLines(slug+": "+failure(err)))
}

// failure is what an error says to a person.
func failure(err error) string {
	var userError *cli.UserError
	if errors.As(componentapi.FileError(err, "The working copy could not be read"), &userError) {
		return userError.Message
	}
	return err.Error()
}

// describe tells the server what the working copy says of a component now.
func (r *run) describe(slug string) error {
	files, err := r.workingCopy.ReadComponentFiles(slug)
	if err != nil {
		return err
	}
	state, err := r.workingCopy.ReadState()
	if err != nil {
		return err
	}
	var entry *workingcopy.ComponentState
	if found, ok := state.Components[slug]; ok {
		entry = &found
	}
	if entry != nil && entry.IsConflicted && !workingcopy.FilesHaveConflictMarkers(files) {
		if _, err := r.workingCopy.UpdateState(func(current *workingcopy.State) {
			if component, ok := current.Components[slug]; ok {
				component.IsConflicted = false
				current.Components[slug] = component
			}
		}); err != nil {
			return err
		}
		entry.IsConflicted = false
		r.app.Println("✓ " + slug + ": no conflict markers remain; the conflict is resolved.")
	}
	title, known := r.titles[slug]
	if !known {
		title = slug
	}
	r.state.Describe(slug, devserver.WorkingCopyFacts(files, entry, title))
	return nil
}

// sync merges newer catalog versions into the working copy and pulls the
// components it lacks.
func (r *run) sync(ctx context.Context) {
	events, titles, err := workingcopy.Sync(ctx, r.workingCopy, r.catalog, true)
	if ctx.Err() != nil {
		return
	}
	if err != nil {
		r.app.Warnf("Could not sync the working copy with Voidhash (%s); trying again in 15 seconds.", cli.PrintableLines(failure(err)))
		return
	}
	r.titles = titles
	for _, event := range events {
		// A component without source is announced once.
		if event.Kind == workingcopy.NotEditable {
			if r.announced[event.Slug] {
				continue
			}
			r.announced[event.Slug] = true
		}
		r.app.Println(cli.PrintableLines(event.Format()))
	}
	// `publish` may have changed the state meanwhile: report what it says now.
	slugs, err := r.workingCopy.ListComponents()
	if err != nil {
		r.app.Warnf("%s", cli.PrintableLines(failure(err)))
		return
	}
	for _, slug := range slugs {
		if r.state.Has(slug) {
			if err := r.describe(slug); err != nil {
				r.warn(slug, err)
			}
		}
	}
}

func withSeparators(number int) string {
	digits := strconv.Itoa(number)
	var out strings.Builder
	for index, digit := range digits {
		if index > 0 && (len(digits)-index)%3 == 0 {
			out.WriteByte(',')
		}
		out.WriteRune(digit)
	}
	return out.String()
}

// printBuild prints one line per finished build: its sizes, or why it
// failed with cargo's diagnostics.
func (r *run) printBuild(status devserver.ComponentStatus) {
	if status.Build.State == "ready" && status.Component != nil {
		panel := ""
		if status.Component.Panel != nil {
			panel = ", panel " + withSeparators(status.Component.Panel.ByteSize) + " bytes"
		}
		r.app.Println(fmt.Sprintf("%s %s: build %d ready (module %s bytes%s).",
			r.app.Style().Green("✓"), status.Slug, status.Build.Number, withSeparators(status.Component.Module.ByteSize), panel))
		return
	}
	message := ""
	if status.Build.Message != nil {
		message = *status.Build.Message
	}
	if log := strings.TrimRight(status.Build.Log, " \t\r\n"); strings.TrimSpace(log) != "" {
		message += "\n" + log
	}
	r.app.Notef("%s %s", r.app.ErrStyle().Red("✗"), cli.PrintableLines(fmt.Sprintf("%s: build %d failed: %s", status.Slug, status.Build.Number, message)))
}

// startNextBuild starts the build of the next queued component, or, when
// the queue is empty and a build is wanted, queues the components that
// changed since their last build.
func (r *run) startNextBuild(ctx context.Context) {
	for !r.isBuilding {
		if len(r.queue) == 0 {
			if !r.wantsBuild {
				return
			}
			r.wantsBuild = false
			if len(r.changed) == 0 {
				return
			}
			for slug := range r.changed {
				r.queue = append(r.queue, slug)
			}
			sort.Strings(r.queue)
			r.changed = map[string]bool{}
		}
		slug := r.queue[0]
		r.queue = r.queue[1:]
		if !r.workingCopy.IsComponent(slug) {
			if r.state.Has(slug) {
				r.state.Remove(slug)
				r.app.Println("- " + cli.Printable(slug) + ": no longer a component crate; it is not served.")
			}
			continue
		}
		if err := r.describe(slug); err != nil {
			r.warn(slug, err)
			continue
		}
		building, ok := r.state.StartBuild(slug)
		if !ok {
			continue
		}
		r.isBuilding = true
		directory := r.workingCopy.ComponentDirectory(slug)
		r.builds.Add(1)
		go func() {
			defer r.builds.Done()
			built, err := crate.BuildCrate(ctx, r.build, directory, crate.BuildOptions{})
			if err == nil && built.Definition.ID != crate.ComponentID(slug) {
				err = &crate.BuildError{
					Message: fmt.Sprintf("The crate declares the id %s, but the component in components/%s is %s. Use that id in #[component] and #[panel(for = …)].", built.Definition.ID, slug, crate.ComponentID(slug)),
					Log:     built.Log,
				}
			}
			r.finished <- buildResult{building: building, slug: slug, built: built, err: err}
		}()
	}
}

// serve runs until ctx ends or the run must stop.
func (r *run) serve(parent context.Context) error {
	app := r.app
	ctx, stop := context.WithCancel(parent)
	// Builds end with the run, and are waited for so none outlives it.
	defer r.builds.Wait()
	defer stop()

	r.sync(ctx)
	components, err := r.workingCopy.ListComponents()
	if err != nil {
		return componentapi.FileError(err, "Could not read the working copy")
	}
	for _, slug := range components {
		if err := r.describe(slug); err != nil {
			return componentapi.FileError(err, "Could not read "+slug)
		}
	}

	listener, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(r.requestedPort)))
	if err != nil {
		return cli.Failf("The dev server could not listen on 127.0.0.1:%d: %v.", r.requestedPort, err).
			WithHint("Is another voidhash dev running? Stop it, or pass another --port.")
	}
	server := &http.Server{Handler: devserver.Handler(r.state, r.token), ReadHeaderTimeout: 10 * time.Second}
	go func() { _ = server.Serve(listener) }()
	defer server.Close()
	origin := "http://" + listener.Addr().String()

	serving := "  none yet. Create one with 'voidhash new <name>'."
	if len(components) > 0 {
		serving = "  " + strings.Join(components, ", ")
	}
	editIn := componentapi.Relative(app, r.workingCopy.ComponentsDirectory) + string(filepath.Separator)
	app.Println(cli.PrintableLines(strings.Join([]string{
		"",
		fmt.Sprintf("Serving the components of %s/%s on %s:", r.target.Organization.Slug, r.target.Project.Slug, origin),
		serving,
		"",
		"Edit them in " + editIn + "; each change rebuilds its component. A paywall",
		"editor of this project that you have open picks up every build on its own. Publish",
		"the changes with 'voidhash publish'. Press Ctrl+C to stop.",
		"",
	}, "\n")))

	go watch(ctx, r.workingCopy.ComponentsDirectory, snapshot(r.workingCopy.ComponentsDirectory), r.fileChanges)
	if len(components) > 0 {
		app.Notef("Building %s; the first build of a component takes longest.", strings.Join(components, ", "))
		for _, slug := range components {
			r.changed[slug] = true
		}
		r.wantsBuild = true
		r.startNextBuild(ctx)
	}

	reporter := &devserver.Reporter{
		API:        componentapi.Sessions{App: app, ProjectID: r.target.Project.Id},
		URL:        origin,
		Token:      r.token,
		Components: func() []devserver.ReportedComponent { return devserver.ReportedComponents(r.state.Status()) },
		Log:        app.Println,
		Warn:       func(line string) { app.Warnf("%s", cli.PrintableLines(line)) },
	}
	// Ending the session is the last thing a run does, however it ends.
	defer reporter.End(parent)
	stopped := func(err error) error {
		var refused *devserver.CallError
		switch {
		case errors.Is(err, devserver.ErrTakenOver):
			return cli.Failf("%s", devserver.TakenOverMessage)
		case errors.As(err, &refused):
			return refused.Err
		}
		return err
	}
	if err := reporter.Report(ctx); err != nil {
		return stopped(err)
	}

	reported := devserver.Fingerprint(r.state.Status())
	heartbeat := time.NewTicker(devserver.HeartbeatInterval)
	defer heartbeat.Stop()
	nextSync := time.NewTicker(syncInterval)
	defer nextSync.Stop()
	// Both timers wait for something to happen first.
	quiet := time.NewTimer(time.Hour)
	quiet.Stop()
	defer quiet.Stop()
	reportSoon := time.NewTimer(time.Hour)
	reportSoon.Stop()
	defer reportSoon.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case slugs := <-r.fileChanges:
			for _, slug := range slugs {
				r.changed[slug] = true
			}
			quiet.Reset(quietPeriod)
		case <-quiet.C:
			r.wantsBuild = true
		case result := <-r.finished:
			r.isBuilding = false
			if ctx.Err() != nil {
				return ctx.Err()
			}
			var buildError *crate.BuildError
			if result.err != nil && !errors.As(result.err, &buildError) {
				buildError = &crate.BuildError{Message: result.err.Error()}
			}
			if status, ok := r.state.FinishBuild(result.building, result.built, buildError); ok {
				r.printBuild(status)
			}
		case <-nextSync.C:
			r.sync(ctx)
		case <-heartbeat.C:
			if err := reporter.Report(ctx); err != nil {
				return stopped(err)
			}
		case <-reportSoon.C:
			if err := reporter.Report(ctx); err != nil {
				return stopped(err)
			}
		}
		// Changes that came during a build start the next one once it ends.
		r.startNextBuild(ctx)
		if now := devserver.Fingerprint(r.state.Status()); now != reported {
			reported = now
			reportSoon.Reset(devserver.ChangeReportDelay)
		}
	}
}
