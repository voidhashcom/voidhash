// Package cli is the shared core of the Voidhash CLI: the [App] one run
// flows through, and what every command builds on. It covers flags and
// arguments, output for people and for scripts, prompts and confirmation,
// errors with their exit codes, calls to the API, and the project a command
// acts on. Command packages import it; it imports none of them.
package cli

import (
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"golang.org/x/term"

	"github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

// BinaryName is how messages and hints call the CLI.
const BinaryName = "voidhash"

// App is one run of the CLI: where it reads and writes, the computer it runs
// on, and what it has looked up so far. Everything a command touches outside
// its own code comes from here, so a test can run commands in-process, in
// parallel, against a fake API. Create one with [NewApp] in the binary and
// with the clitest package in tests. What the App looks up lazily (the
// client, the credential, the session, the settings store) and the print
// helpers are safe to use from several goroutines, which is what [Each]
// relies on; prompts are asked from one goroutine at a time.
type App struct {
	// Stdin is where prompts read answers and commands read piped input.
	Stdin io.Reader
	// Stdout receives results: tables, summaries, JSON, ids.
	Stdout io.Writer
	// Stderr receives everything else: prompts, progress, notes, errors.
	Stderr io.Writer
	// StdinTTY, StdoutTTY and StderrTTY say which streams are a terminal.
	StdinTTY, StdoutTTY, StderrTTY bool
	// Width is the terminal's width in columns, for help and wrapped text.
	Width int

	// Version is the CLI's version, as --version prints it.
	Version string
	// Getenv reads an environment variable; empty when it is not set.
	Getenv func(name string) string
	// Home is the person's home directory, which holds ~/.voidhash.
	Home string
	// Dir is the directory the command runs in, as an absolute path.
	Dir string
	// GOOS is the operating system, as runtime.GOOS names it.
	GOOS string
	// Hostname names this computer when it signs in.
	Hostname string

	// Now is the clock. Use it instead of time.Now so tests can fix the time.
	Now func() time.Time
	// Location is the time zone dates are shown in.
	Location *time.Location
	// Sleep waits, ending early with the context's error when ctx ends. Use
	// it instead of time.Sleep so tests do not wait.
	Sleep func(ctx context.Context, d time.Duration) error

	// NewID makes a random id (a UUID) for a request that must apply once,
	// such as an idempotency key. Tests make it predictable.
	NewID func() string

	// Transport sends every HTTP request the CLI makes.
	Transport http.RoundTripper
	// RunTool runs the operating system's credential tool.
	RunTool credentials.Runner
	// RunProcess runs a program in a directory, streaming its output: a
	// package manager, the project's own checks, a coding agent.
	RunProcess ProcessRunner
	// LookPath finds a program on PATH, as exec.LookPath does.
	LookPath func(name string) (string, error)
	// OpenURL hands a URL to the person's default browser.
	OpenURL func(url string) error
	// LoadDirectoryConfig reads the committed configuration of a directory.
	LoadDirectoryConfig projectconfig.Loader

	// Profile is the --profile flag; see [App.ActiveProfile].
	Profile string
	// Debug is the --debug flag: request lines and full error detail go to
	// standard error.
	Debug bool
	// NoColor is the --no-color flag.
	NoColor bool

	prompter *prompt.Prompter
	started  bool

	// Each lazily built value has its own lock, held while it is built, so
	// concurrent calls build it once. They nest in one direction only:
	// session, client, credentials, config store.
	configStoreMu sync.Mutex
	configStore   *config.Store
	credsMu       sync.Mutex
	creds         *credentials.Credentials
	clientMu      sync.Mutex
	client        *voidhash.Client
	sessionMu     sync.Mutex
	session       *Session
	// directoryWarnings prints the directory configuration's warnings once.
	directoryWarnings sync.Once
	// outputMu keeps lines written from several goroutines whole.
	outputMu sync.Mutex
}

// NewApp creates the App of the real process: the standard streams, the
// environment, the working directory and the network.
func NewApp(version string) (*App, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, &UserError{
			Message: "Could not find your home directory, where the CLI keeps its settings.",
			Hint:    "Set the HOME environment variable.",
		}
	}
	dir, err := os.Getwd()
	if err != nil {
		return nil, &UserError{Message: "Could not read the current directory: " + err.Error()}
	}
	hostname, _ := os.Hostname()
	width := 80
	if columns, _, err := term.GetSize(int(os.Stdout.Fd())); err == nil && columns > 0 {
		width = columns
	}
	return &App{
		Stdin:     os.Stdin,
		Stdout:    os.Stdout,
		Stderr:    os.Stderr,
		StdinTTY:  term.IsTerminal(int(os.Stdin.Fd())),
		StdoutTTY: term.IsTerminal(int(os.Stdout.Fd())),
		StderrTTY: term.IsTerminal(int(os.Stderr.Fd())),
		Width:     width,
		Version:   version,
		Getenv:    os.Getenv,
		Home:      home,
		Dir:       dir,
		GOOS:      runtime.GOOS,
		Hostname:  hostname,
		Now:       time.Now,
		Location:  time.Local,
		Sleep: func(ctx context.Context, d time.Duration) error {
			timer := time.NewTimer(d)
			defer timer.Stop()
			select {
			case <-timer.C:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		},
		NewID:               newUUID,
		Transport:           http.DefaultTransport,
		RunTool:             credentials.ExecRunner,
		RunProcess:          ExecProcess,
		LookPath:            exec.LookPath,
		OpenURL:             openInBrowser,
		LoadDirectoryConfig: projectconfig.LoadDirectoryConfig,
	}, nil
}

func newUUID() string {
	var id [16]byte
	// crypto/rand does not fail on the systems the CLI runs on.
	_, _ = rand.Read(id[:])
	id[6] = id[6]&0x0f | 0x40
	id[8] = id[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", id[0:4], id[4:6], id[6:8], id[8:10], id[10:16])
}

// openInBrowser hands url to the default browser. The opener is detached so
// it outlives the command. On Windows the URL goes to the URL handler
// directly rather than through `cmd /c start`, where `&` in a query would
// separate commands.
func openInBrowser(url string) error {
	name, args := BrowserCommand(url, runtime.GOOS)
	command := exec.Command(name, args...)
	if err := command.Start(); err != nil {
		return err
	}
	return command.Process.Release()
}

// BrowserCommand is the command that opens url in the default browser on goos.
func BrowserCommand(url, goos string) (string, []string) {
	switch goos {
	case "darwin":
		return "open", []string{url}
	case "windows":
		return "rundll32", []string{"url.dll,FileProtocolHandler", url}
	default:
		return "xdg-open", []string{url}
	}
}

// IsInteractive reports whether the CLI can ask questions: standard input
// and output are both a terminal. Nothing prompts otherwise.
func (a *App) IsInteractive() bool {
	return a.StdinTTY && a.StdoutTTY
}

// Prompter asks questions on standard error and reads answers from standard
// input. Commands rarely need it directly: [RequireItem], [App.RequireText],
// [App.ConfirmChange] and the like decide whether to ask at all.
func (a *App) Prompter() *prompt.Prompter {
	if a.prompter == nil {
		a.prompter = prompt.New(a.Stdin, a.Stderr)
	}
	return a.prompter
}

// ActiveProfile is the config profile of the run: --profile, else
// VOIDHASH_PROFILE, else none.
func (a *App) ActiveProfile() string {
	if a.Profile != "" {
		return a.Profile
	}
	return a.Getenv("VOIDHASH_PROFILE")
}

// ConfigStore is the settings file, ~/.voidhash, under the active profile.
func (a *App) ConfigStore() *config.Store {
	a.configStoreMu.Lock()
	defer a.configStoreMu.Unlock()
	if a.configStore == nil {
		a.configStore = &config.Store{
			Path:    filepath.Join(a.Home, config.FileName),
			Profile: a.ActiveProfile(),
			APIURL:  a.Getenv("VOIDHASH_API_URL"),
		}
	}
	return a.configStore
}

// Config reads the effective settings of the run.
func (a *App) Config() (config.Settings, error) {
	settings, err := a.ConfigStore().Read()
	if err != nil {
		a.Debugf("%v", err)
		return settings, &UserError{
			Message: "Could not read the CLI config, ~/.voidhash.",
			Hint:    "Fix or remove the file, then sign in again with 'voidhash login'.",
		}
	}
	return settings, nil
}

// WriteConfig stores changes in the settings of the active profile.
func (a *App) WriteConfig(changes config.Changes) error {
	if err := a.ConfigStore().Write(changes); err != nil {
		return &UserError{Message: "Could not write the CLI config, ~/.voidhash: " + err.Error()}
	}
	return nil
}

// Credentials decides which credential requests carry, and stores tokens.
// The first call moves any key the settings file still holds into the
// credential store.
func (a *App) Credentials(ctx context.Context) *credentials.Credentials {
	a.credsMu.Lock()
	defer a.credsMu.Unlock()
	if a.creds == nil {
		store := credentials.NewStore(credentials.StoreOptions{
			OSStore:  credentials.ChooseOSStore(a.GOOS, a.GOOS == "linux" && credentials.IsOnPath("secret-tool", a.Getenv("PATH"))),
			FilePath: credentials.FilePath(a.GOOS, a.Home, a.Getenv("XDG_CONFIG_HOME"), a.Getenv("APPDATA")),
			Run:      a.RunTool,
			Warn:     func(message string) { a.Warnf("%s", message) },
			Debug:    func(message string) { a.Debugf("%s", message) },
		})
		a.creds = credentials.New(store, a.Getenv("VOIDHASH_API_KEY"))
		a.migrateLegacyKeys(ctx)
	}
	return a.creds
}

// HTTPClient sends requests through the run's transport, without a
// credential: for the sign-in endpoints and for servers other than the API.
func (a *App) HTTPClient() *http.Client {
	return &http.Client{Transport: debugTransport{app: a, next: a.Transport}}
}

// Printf writes a result to standard output.
func (a *App) Printf(format string, args ...any) {
	a.outputMu.Lock()
	defer a.outputMu.Unlock()
	fmt.Fprintf(a.Stdout, format, args...)
}

// Println writes a line of a result to standard output.
func (a *App) Println(text string) {
	a.outputMu.Lock()
	defer a.outputMu.Unlock()
	fmt.Fprintln(a.Stdout, text)
}

// Notef writes a line to standard error: progress, a next step, anything a
// script reading the result should not see.
func (a *App) Notef(format string, args ...any) {
	a.outputMu.Lock()
	defer a.outputMu.Unlock()
	fmt.Fprintln(a.Stderr, fmt.Sprintf(format, args...))
}

// Warnf writes a warning to standard error, marked with "!".
func (a *App) Warnf(format string, args ...any) {
	a.outputMu.Lock()
	defer a.outputMu.Unlock()
	fmt.Fprintln(a.Stderr, a.ErrStyle().Yellow("!")+" "+fmt.Sprintf(format, args...))
}

// Debugf writes a line to standard error when --debug is passed.
func (a *App) Debugf(format string, args ...any) {
	if a.Debug {
		a.outputMu.Lock()
		defer a.outputMu.Unlock()
		fmt.Fprintln(a.Stderr, a.ErrStyle().Dim("debug: "+strings.TrimRight(fmt.Sprintf(format, args...), "\n")))
	}
}
