package home

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// The screen is a program of its own, which draws and takes keys. It reads
// and changes nothing itself: it connects back to the CLI that started it
// and asks, one JSON object a line.
//
//	→ {"token": "…"}                                  first, to prove it is the screen
//	→ {"id": 1, "method": "keys", "params": {…}}      a call
//	← {"id": 1, "result": …}                          its answer
//	← {"id": 1, "error": {"message": "…", "hint": "…"}}
//	← {"id": 1, "event": "progress", "data": "…"}     news of a call still running
//	→ {"method": "cancel", "params": {"id": 1}}       stop a call

// ErrNoScreen is returned by [Run] when the screen's program is not
// installed beside the CLI, or does not start.
var ErrNoScreen = errors.New("the screen is not installed")

// screenName is the screen's program, which ships beside the CLI.
const screenName = "voidhash-tui"

// screenProgram finds the screen: the program VOIDHASH_TUI names, which a
// source checkout sets, else the one beside the CLI.
func screenProgram(app *cli.App) (name string, args []string, found bool) {
	if named := app.Getenv("VOIDHASH_TUI"); named != "" {
		switch filepath.Ext(named) {
		case ".ts", ".tsx", ".js", ".mjs":
			return "bun", []string{named}, true
		}
		return named, nil, true
	}
	executable, err := os.Executable()
	if err != nil {
		return "", nil, false
	}
	if resolved, err := filepath.EvalSymlinks(executable); err == nil {
		executable = resolved
	}
	candidate := filepath.Join(filepath.Dir(executable), screenName)
	if app.GOOS == "windows" {
		candidate += ".exe"
	}
	if info, err := os.Stat(candidate); err != nil || info.IsDir() {
		return "", nil, false
	}
	return candidate, nil, true
}

// Run shows the screen until the person leaves it, and fails with
// [ErrNoScreen] when there is none to show. While it is up, what commands
// print goes to the screen instead of the terminal under it.
func Run(ctx context.Context, app *cli.App, root *cobra.Command) error {
	name, args, found := screenProgram(app)
	if !found {
		return ErrNoScreen
	}
	// Only this computer can connect, and only with the token, which the
	// screen is given in its environment.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	defer listener.Close()
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return err
	}
	token := hex.EncodeToString(secret)

	terminal := &output{stdout: app.Stdout, stderr: app.Stderr}
	app.Stdout, app.Stderr = terminal.writer(false), terminal.writer(true)
	defer func() { app.Stdout, app.Stderr = terminal.stdout, terminal.stderr }()
	b := &backend{app: app, root: root, terminal: terminal}

	asked := ctx
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	exited := make(chan error, 1)
	go func() {
		_, err := app.RunProcess(ctx, cli.Process{
			Name: name, Args: args, Dir: app.Dir,
			Env:   []string{"VOIDHASH_TUI_ADDRESS=" + listener.Addr().String(), "VOIDHASH_TUI_TOKEN=" + token},
			Stdin: app.Stdin, Stdout: terminal.stdout, Stderr: terminal.stderr,
		})
		exited <- err
		// The screen is gone: stop waiting for it and end its calls.
		cancel()
		listener.Close()
	}()

	connection, err := listener.Accept()
	if err != nil {
		// The screen ended without ever asking anything. When that was not
		// the person leaving, it cannot run on this computer, as on a Linux
		// without glibc.
		if exitErr := <-exited; exitErr != nil && asked.Err() == nil {
			return ErrNoScreen
		}
		return nil
	}
	served := make(chan struct{})
	go func() {
		defer close(served)
		serve(ctx, connection, token, b)
	}()
	err = <-exited
	connection.Close()
	<-served
	if ctx.Err() != nil && err != nil {
		return nil
	}
	return err
}

// request is one line from the screen.
type request struct {
	Token  string          `json:"token,omitempty"`
	ID     int64           `json:"id,omitempty"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
}

// response is one line to the screen.
type response struct {
	ID     int64    `json:"id"`
	Result any      `json:"result,omitempty"`
	Error  *Failure `json:"error,omitempty"`
	Event  string   `json:"event,omitempty"`
	Data   any      `json:"data,omitempty"`
}

// params are everything a call may pass; each method reads what it needs.
type params struct {
	ID             int64            `json:"id"`
	ProjectID      string           `json:"projectId"`
	OrganizationID string           `json:"organizationId"`
	Name           string           `json:"name"`
	Handle         string           `json:"handle"`
	Text           string           `json:"text"`
	What           string           `json:"what"`
	Args           []string         `json:"args"`
	Options        IntegrateOptions `json:"options"`
}

// serve answers the screen's calls until the connection ends. Calls run at
// the same time, each until it answers or is cancelled.
func serve(ctx context.Context, connection io.ReadWriteCloser, token string, b *backend) {
	defer connection.Close()
	var writing sync.Mutex
	send := func(message response) {
		line, err := json.Marshal(message)
		if err != nil {
			line, _ = json.Marshal(response{ID: message.ID, Error: &Failure{Message: "The answer could not be written."}})
		}
		writing.Lock()
		defer writing.Unlock()
		_, _ = connection.Write(append(line, '\n'))
	}

	var running sync.WaitGroup
	defer running.Wait()
	ctx, cancelAll := context.WithCancel(ctx)
	defer cancelAll()
	var mu sync.Mutex
	cancels := map[int64]context.CancelFunc{}

	lines := bufio.NewScanner(connection)
	lines.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	proven := false
	for lines.Scan() {
		var call request
		if err := json.Unmarshal(lines.Bytes(), &call); err != nil {
			return
		}
		if !proven {
			if subtle.ConstantTimeCompare([]byte(call.Token), []byte(token)) != 1 {
				return
			}
			proven = true
			continue
		}
		var given params
		if len(call.Params) > 0 {
			if err := json.Unmarshal(call.Params, &given); err != nil {
				send(response{ID: call.ID, Error: &Failure{Message: "The screen sent a call the CLI could not read."}})
				continue
			}
		}
		if call.Method == "cancel" {
			mu.Lock()
			if cancel := cancels[given.ID]; cancel != nil {
				cancel()
			}
			mu.Unlock()
			continue
		}
		callCtx, cancel := context.WithCancel(ctx)
		mu.Lock()
		cancels[call.ID] = cancel
		mu.Unlock()
		running.Add(1)
		go func() {
			defer running.Done()
			defer func() {
				mu.Lock()
				delete(cancels, call.ID)
				mu.Unlock()
				cancel()
			}()
			result, err := b.call(callCtx, call.Method, given, func(line string) {
				send(response{ID: call.ID, Event: "progress", Data: line})
			})
			if err != nil {
				var described *Failure
				if !errors.As(err, &described) {
					described = &Failure{Message: err.Error()}
				}
				send(response{ID: call.ID, Error: described})
				return
			}
			if result == nil {
				result = struct{}{}
			}
			send(response{ID: call.ID, Result: result})
		}()
	}
}

// call runs one of the screen's calls.
func (b *backend) call(ctx context.Context, method string, given params, progress func(line string)) (any, error) {
	switch method {
	case "load":
		return b.Load(ctx)
	case "commands":
		return commands(b.root), nil
	case "signIn.start":
		return b.StartSignIn(ctx)
	case "signIn.wait":
		return nil, b.FinishSignIn(ctx, given.Handle)
	case "project.create":
		return b.CreateProject(ctx, given.OrganizationID, given.Name)
	case "link":
		return nil, b.Link(ctx, given.ProjectID)
	case "integrate":
		return nil, b.Integrate(ctx, given.Options, progress)
	case "checks":
		return b.Checks(ctx, given.ProjectID)
	case "events":
		return list(b.Events(ctx, given.ProjectID))
	case "keys":
		return list(b.Keys(ctx, given.ProjectID))
	case "perks":
		return list(b.Perks(ctx, given.ProjectID))
	case "perk.create":
		return nil, b.CreatePerk(ctx, given.ProjectID, given.Name)
	case "locations":
		return list(b.Locations(ctx, given.ProjectID))
	case "location.create":
		return nil, b.CreateLocation(ctx, given.ProjectID, given.Name)
	case "webhooks":
		return list(b.Webhooks(ctx, given.ProjectID))
	case "copy":
		return nil, b.Copy(given.Text)
	case "open":
		return nil, b.Open(ctx, given.What)
	case "exec":
		return nil, b.Exec(ctx, given.Args)
	}
	return nil, &Failure{Message: fmt.Sprintf("This CLI does not know the screen's call %q.", method), Hint: "Update the CLI."}
}

// list answers with an empty list, not null, when there is nothing.
func list[T any](items []T, err error) (any, error) {
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []T{}
	}
	return items, nil
}

// Exec runs a command of the CLI on the terminal, which the screen has set
// aside for it, then waits for enter so what it printed can be read before
// the screen covers it again.
func (b *backend) Exec(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return &Failure{Message: "There is no command to run."}
	}
	b.terminal.direct(true)
	defer b.terminal.direct(false)
	b.app.Execute(ctx, b.root, args)
	fmt.Fprint(b.terminal.stderr, "\nPress enter to go back. ")
	answered := make(chan struct{})
	go func() {
		defer close(answered)
		var one [1]byte
		for {
			if count, err := b.app.Stdin.Read(one[:]); err != nil || (count == 1 && one[0] == '\n') {
				return
			}
		}
	}()
	select {
	case <-answered:
	case <-ctx.Done():
	case <-time.After(30 * time.Minute):
	}
	return nil
}
