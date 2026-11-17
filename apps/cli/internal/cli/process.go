package cli

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"slices"
	"strings"
	"time"
)

const processStopDelay = 5 * time.Second

// Process is a program a command starts in a directory, such as a package
// manager or a coding agent, with its output handed on as it is written.
type Process struct {
	Name string
	Args []string
	// Dir is the directory it runs in.
	Dir string
	// Env adds variables, as "NAME=value", to the CLI's own environment.
	Env []string
	// Unset names variables of the CLI's environment it does not get.
	Unset []string
	// Stdin is what it reads; nothing when nil.
	Stdin io.Reader
	// Stdout and Stderr receive its output; discarded when nil.
	Stdout, Stderr io.Writer
}

// ProcessRunner runs a process to its end and returns its exit code. err is
// set only when it could not be started or was stopped with the context.
type ProcessRunner func(ctx context.Context, process Process) (exitCode int, err error)

// ExecProcess runs the process on this computer.
func ExecProcess(ctx context.Context, process Process) (int, error) {
	command := exec.CommandContext(ctx, process.Name, process.Args...)
	command.Dir = process.Dir
	for _, variable := range os.Environ() {
		name, _, _ := strings.Cut(variable, "=")
		if !slices.Contains(process.Unset, name) {
			command.Env = append(command.Env, variable)
		}
	}
	command.Env = append(command.Env, process.Env...)
	command.Stdin = process.Stdin
	command.Stdout = process.Stdout
	command.Stderr = process.Stderr
	// Ctrl+C reaches the child from the terminal; give it a moment to stop
	// by itself before it is killed.
	command.Cancel = func() error { return command.Process.Signal(os.Interrupt) }
	command.WaitDelay = processStopDelay
	err := command.Run()
	if ctx.Err() != nil {
		return 0, ctx.Err()
	}
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		return exit.ExitCode(), nil
	}
	return 0, err
}
