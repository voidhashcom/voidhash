// Package clitest runs the CLI in-process for tests: the whole command tree,
// with a temporary home directory, a fake API, a fake keychain, a fixed
// clock and scripted answers to prompts. Nothing touches the network, the
// real home directory or the real keychain, so tests can run in parallel.
//
//	func TestList(t *testing.T) {
//		api := clitest.NewFakeAPI()
//		api.Handle("GET /api/v1/projects/{projectId}/products", func(r *clitest.Request) clitest.Answer {
//			return clitest.Page(clitest.M{"id": "prod_1", "name": "Pro"})
//		})
//		run := clitest.Run(t, []string{"product", "list", "-q"}, clitest.Options{API: api})
//		if run.ExitCode != 0 || run.Stdout != "prod_1" {
//			t.Fatalf("unexpected run: %+v", run)
//		}
//	}
//
// A test of a command package imports this package, which imports every
// command package, so such tests live in an external test package
// (`package product_test`).
package clitest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
)

// M is a JSON object in a fixture.
type M = map[string]any

// APIURL is the api_url of a home made by [MakeHome]. The fake API answers
// any host, so a test may configure another.
const APIURL = "http://api.test"

// Now is the time of a run unless [Options.Now] sets another.
var Now = time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

// Options shapes one run. The zero value runs signed in as Dana Doe, who can
// use the projects acme/app and acme/web, off a terminal.
type Options struct {
	// Home is the home directory; by default a new one from [MakeHome]. Pass
	// the same home to several runs to carry settings and the sign-in over.
	Home string
	// API answers the run's requests; by default a new [NewFakeAPI].
	API *FakeAPI
	// Env is the environment, such as VOIDHASH_API_KEY. Nothing is inherited
	// from the test process.
	Env map[string]string
	// TTY makes standard input, output and error a terminal, so the CLI
	// prompts.
	TTY bool
	// Input is what is typed at the prompts, or piped to standard input:
	// each answer ends with "\n". When a prompt finds no more input the run
	// ends as Ctrl+C would, with exit code 130.
	Input string
	// Dir is the directory the command runs in; by default a new empty
	// directory.
	Dir string
	// Keychain stands in for the macOS keychain, and makes the run one on
	// macOS. Without it credentials are kept in the file only.
	Keychain *Keychain
	// GOOS is the operating system: "linux" by default, "darwin" with a
	// Keychain.
	GOOS string
	// Now is the time the run starts at; by default [Now]. Waiting advances
	// it without waiting.
	Now time.Time
	// Width is the terminal's width; 100 by default.
	Width int
	// Version is the CLI's version; "test" by default.
	Version string
	// Setup changes the App before the run, for what the options do not cover.
	Setup func(app *cli.App)
}

// Result is what one run printed, and the exit code the CLI would end with.
type Result struct {
	ExitCode int
	// Stdout and Stderr are the run's output without the final line break.
	Stdout string
	Stderr string
	// Opened lists the URLs the run handed to the browser.
	Opened []string
	// Waited is how long the run waited in all, on its fake clock.
	Waited time.Duration
}

// Lines is Stdout split into lines.
func (r Result) Lines() []string {
	return strings.Split(r.Stdout, "\n")
}

// MakeHome creates a home directory for one test whose ~/.voidhash is
// signed in to the fake API ([APIURL]) and holds config over that: a
// default project, links, another api_url. A nil value removes a key, so
// M{"api_key": nil} is a home that is signed out.
func MakeHome(t testing.TB, config M) string {
	t.Helper()
	home := t.TempDir()
	file := M{"api_key": "vh_cli_test", "api_url": APIURL, "web_url": "https://voidhash.test"}
	for key, value := range config {
		if value == nil {
			delete(file, key)
		} else {
			file[key] = value
		}
	}
	data, err := json.Marshal(file)
	if err != nil {
		t.Fatalf("encoding the config: %v", err)
	}
	if err := os.WriteFile(filepath.Join(home, ".voidhash"), data, 0o600); err != nil {
		t.Fatalf("writing the config: %v", err)
	}
	return home
}

// ReadConfig reads the ~/.voidhash the runs left in home.
func ReadConfig(t testing.TB, home string) M {
	t.Helper()
	config := M{}
	readJSON(t, filepath.Join(home, ".voidhash"), &config)
	return config
}

// ReadCredentials reads the credentials file the runs left in home: API
// origin to token. It is empty when there is no file.
func ReadCredentials(t testing.TB, home string) map[string]string {
	t.Helper()
	credentials := map[string]string{}
	path := filepath.Join(home, ".config", "voidhash", "credentials.json")
	if _, err := os.Stat(path); err == nil {
		readJSON(t, path, &credentials)
	}
	return credentials
}

func readJSON(t testing.TB, path string, into any) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	if err := json.Unmarshal(data, into); err != nil {
		t.Fatalf("decoding %s: %v", path, err)
	}
}

// NewApp creates the App [Run] uses, for a test that calls the core
// directly instead of running a command. The second result collects what
// the App does.
func NewApp(t testing.TB, options Options) (*cli.App, *Recorder) {
	t.Helper()
	if options.Home == "" {
		options.Home = MakeHome(t, nil)
	}
	if options.API == nil {
		options.API = NewFakeAPI()
	}
	if options.Dir == "" {
		options.Dir = t.TempDir()
	}
	// Paths in messages are compared as the CLI resolves them.
	if resolved, err := filepath.EvalSymlinks(options.Dir); err == nil {
		options.Dir = resolved
	}
	if options.GOOS == "" {
		options.GOOS = "linux"
		if options.Keychain != nil {
			options.GOOS = "darwin"
		}
	}
	if options.Now.IsZero() {
		options.Now = Now
	}
	if options.Width == 0 {
		options.Width = 100
	}
	if options.Version == "" {
		options.Version = "test"
	}

	recorder := &Recorder{now: options.Now}
	app := &cli.App{
		Stdin:     strings.NewReader(options.Input),
		Stdout:    &recorder.stdout,
		Stderr:    &recorder.stderr,
		StdinTTY:  options.TTY,
		StdoutTTY: options.TTY,
		StderrTTY: options.TTY,
		Width:     options.Width,
		Version:   options.Version,
		Getenv: func(name string) string {
			if value, ok := options.Env[name]; ok {
				return value
			}
			// A terminal in a test prints without colors, so output compares
			// as text.
			if name == "NO_COLOR" {
				return "1"
			}
			return ""
		},
		Home:     options.Home,
		Dir:      options.Dir,
		GOOS:     options.GOOS,
		Hostname: "test-computer",
		Now: func() time.Time {
			recorder.mu.Lock()
			defer recorder.mu.Unlock()
			return recorder.now
		},
		Location: time.UTC,
		Sleep: func(ctx context.Context, wait time.Duration) error {
			if err := ctx.Err(); err != nil {
				return err
			}
			recorder.mu.Lock()
			defer recorder.mu.Unlock()
			recorder.now = recorder.now.Add(wait)
			recorder.waited += wait
			return nil
		},
		NewID: func() string {
			recorder.mu.Lock()
			defer recorder.mu.Unlock()
			recorder.ids++
			return fmt.Sprintf("id-%d", recorder.ids)
		},
		Transport: options.API,
		RunTool:   noTools,
		RunProcess: func(_ context.Context, process cli.Process) (int, error) {
			return 0, &toolError{name: process.Name}
		},
		LookPath: func(name string) (string, error) { return "", &toolError{name: name} },
		OpenURL: func(url string) error {
			recorder.mu.Lock()
			defer recorder.mu.Unlock()
			recorder.opened = append(recorder.opened, url)
			return nil
		},
		LoadDirectoryConfig: projectconfig.LoadDirectoryConfig,
	}
	if options.Keychain != nil {
		app.RunTool = options.Keychain.run
	}
	if options.Setup != nil {
		options.Setup(app)
	}
	return app, recorder
}

func noTools(_ context.Context, name string, _ []string, _ string) (int, string, error) {
	return 0, "", &toolError{name: name}
}

type toolError struct{ name string }

func (e *toolError) Error() string { return "tests run no processes: " + e.name }

// Recorder collects what a run did.
type Recorder struct {
	// mu guards the clock, the ids and the opened URLs, which a command may
	// use from the requests it sends together.
	mu             sync.Mutex
	stdout, stderr bytes.Buffer
	opened         []string
	now            time.Time
	waited         time.Duration
	ids            int
}

// Result is what was recorded so far, with the given exit code.
func (r *Recorder) Result(exitCode int) Result {
	return Result{
		ExitCode: exitCode,
		Stdout:   strings.TrimSuffix(r.stdout.String(), "\n"),
		Stderr:   strings.TrimSuffix(r.stderr.String(), "\n"),
		Opened:   r.opened,
		Waited:   r.waited,
	}
}

// Run runs `voidhash <args>` the way the binary does and returns what it
// printed and its exit code.
func Run(t testing.TB, args []string, options Options) Result {
	t.Helper()
	app, recorder := NewApp(t, options)
	code := app.Execute(context.Background(), cmd.NewRoot(app), args)
	return recorder.Result(code)
}
