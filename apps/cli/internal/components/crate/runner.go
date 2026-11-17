// Package crate works with component crates on disk: scaffolding a new one,
// reading its source, building it with the local Rust toolchain, and reading
// a built bundle for the registry.
package crate

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// Command is one process to run to its end.
type Command struct {
	Name string
	Args []string
	// Dir is the directory it runs in; the current one when empty.
	Dir string
	// Env holds variables to add to the environment, as NAME=value.
	Env []string
	// Stdout and Stderr receive its output; nil discards it.
	Stdout io.Writer
	Stderr io.Writer
}

// ErrNotInstalled is what a [Runner] answers when the executable does not
// exist.
var ErrNotInstalled = errors.New("the executable is not installed")

// Runner runs a command and answers its exit code. It fails with
// [ErrNotInstalled] when there is no such executable, and with another error
// when the process could not be run. Tests replace it to stand in for cargo.
type Runner func(ctx context.Context, command Command) (exitCode int, err error)

// ExecRunner returns the Runner that starts real processes, looking
// executables up in the PATH getenv answers.
func ExecRunner(getenv func(name string) string) Runner {
	return func(ctx context.Context, command Command) (int, error) {
		search := getenv("PATH")
		executable, err := lookPath(command.Name, search)
		if err != nil {
			return 0, ErrNotInstalled
		}
		process := exec.CommandContext(ctx, executable, command.Args...)
		process.Dir = command.Dir
		process.Env = append(os.Environ(), command.Env...)
		if search != "" {
			process.Env = append(process.Env, "PATH="+search)
		}
		process.Stdout = command.Stdout
		process.Stderr = command.Stderr
		// A stopped run ends the build; its own children get a moment to end.
		process.WaitDelay = 2 * time.Second
		err = process.Run()
		var exit *exec.ExitError
		switch {
		case err == nil:
			return 0, nil
		case ctx.Err() != nil:
			return 0, ctx.Err()
		case errors.As(err, &exit):
			return exit.ExitCode(), nil
		case errors.Is(err, fs.ErrNotExist), errors.Is(err, exec.ErrNotFound):
			return 0, ErrNotInstalled
		default:
			return 0, err
		}
	}
}

// lookPath finds the executable name in the directories of search, or takes
// name as it is when it is a path.
func lookPath(name, search string) (string, error) {
	// Windows resolves extensions (PATHEXT) and has no executable bit, which
	// the standard lookup knows about.
	if runtime.GOOS == "windows" || search == "" || strings.ContainsRune(name, filepath.Separator) {
		return exec.LookPath(name)
	}
	for _, directory := range filepath.SplitList(search) {
		if directory == "" {
			directory = "."
		}
		candidate := filepath.Join(directory, name)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() && info.Mode()&0o111 != 0 {
			return candidate, nil
		}
	}
	return "", exec.ErrNotFound
}
