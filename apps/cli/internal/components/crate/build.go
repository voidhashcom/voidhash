package crate

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/definition"
)

const wasmTarget = "wasm32-unknown-unknown"

// PanelBuildFeatures are the cargo flags of a component crate's editor panel
// build.
var PanelBuildFeatures = []string{"--no-default-features", "--features", "panel"}

// BuildError says why a component crate did not build: cargo is missing,
// failed, or produced an unusable module. Log holds cargo's diagnostics when
// they were captured.
type BuildError struct {
	Message string
	Log     string
}

func (e *BuildError) Error() string { return e.Message }

// Build is a built component: its module, its editor panel module when it
// has one, and its definition.
type Build struct {
	Module []byte
	// Panel is the editor panel module; nil for a component without one.
	Panel []byte
	// Panels is the panel module's `vhp.panels` manifest; empty without one.
	Panels     []definition.PanelManifestEntry
	Definition *definition.Definition
	// Log holds cargo's diagnostics of both builds, when captured.
	Log string
}

// BuildOptions says where cargo's diagnostics go.
type BuildOptions struct {
	// Diagnostics receives cargo's output as it builds, for a person
	// watching; nil captures it into the build's log instead.
	Diagnostics io.Writer
	// Color asks cargo for colored diagnostics.
	Color bool
}

// BuiltModulePath finds the `.wasm` file cargo wrote for the crate's cdylib
// among the JSON messages of `--message-format=json-render-diagnostics`, so
// crates of a workspace (whose target directory is the workspace's) are
// found too. It is empty when cargo reported none.
func BuiltModulePath(messages string) string {
	lines := strings.Split(messages, "\n")
	for index := len(lines) - 1; index >= 0; index-- {
		var artifact struct {
			Reason *string `json:"reason"`
			Target *struct {
				Kind *[]string `json:"kind"`
			} `json:"target"`
			Filenames *[]string `json:"filenames"`
		}
		if json.Unmarshal([]byte(lines[index]), &artifact) != nil ||
			artifact.Reason == nil || *artifact.Reason != "compiler-artifact" ||
			artifact.Target == nil || artifact.Target.Kind == nil || artifact.Filenames == nil {
			continue
		}
		isLibrary := false
		for _, kind := range *artifact.Target.Kind {
			isLibrary = isLibrary || kind == "cdylib"
		}
		if !isLibrary {
			continue
		}
		for _, file := range *artifact.Filenames {
			if strings.HasSuffix(file, ".wasm") {
				return file
			}
		}
	}
	return ""
}

// tail keeps the end of what is written to it.
type tail struct {
	kept []byte
}

func (t *tail) Write(data []byte) (int, error) {
	const limit = 16 * 1024
	t.kept = append(t.kept, data...)
	if len(t.kept) > limit {
		t.kept = t.kept[len(t.kept)-limit:]
	}
	return len(data), nil
}

// missingTarget says whether cargo's diagnostics show that the WebAssembly
// target is not installed for the toolchain.
func missingTarget(diagnostics string) bool {
	return strings.Contains(diagnostics, wasmTarget) &&
		(strings.Contains(diagnostics, "target may not be installed") || strings.Contains(diagnostics, "rustup target add"))
}

// BuildCrate builds the component crate in directory for release with the
// local Rust toolchain, as the build service does: the component module, and
// when its definition declares an editor panel, the panel module with the
// crate's `panel` feature, checked with [definition.ValidatePanelModule]. A
// failure of the build itself is a [*BuildError].
func BuildCrate(ctx context.Context, run Runner, directory string, options BuildOptions) (*Build, error) {
	// compile runs one build and reads the module it wrote, before the next
	// build overwrites it.
	compile := func(features []string, label, previousLog string) ([]byte, string, error) {
		var messages, captured bytes.Buffer
		seen := &tail{}
		command := Command{
			Name:   "cargo",
			Args:   append([]string{"build", "--release", "--lib", "--target", wasmTarget, "--message-format=json-render-diagnostics"}, features...),
			Dir:    directory,
			Env:    []string{"CARGO_TERM_COLOR=never"},
			Stdout: &messages,
			Stderr: io.MultiWriter(&captured, seen),
		}
		if options.Diagnostics != nil {
			command.Stderr = io.MultiWriter(options.Diagnostics, seen)
			if options.Color {
				command.Env = []string{"CARGO_TERM_COLOR=always"}
			}
		}
		exitCode, err := run(ctx, command)
		if ctx.Err() != nil {
			return nil, "", ctx.Err()
		}
		if errors.Is(err, ErrNotInstalled) {
			return nil, "", &BuildError{Message: "cargo is not installed. Install Rust from https://rustup.rs and add the target: rustup target add " + wasmTarget + "."}
		}
		if err != nil {
			return nil, "", &BuildError{Message: "cargo could not be run: " + err.Error()}
		}
		log := previousLog + captured.String()
		if exitCode != 0 {
			message := "The " + label + " did not build."
			if missingTarget(string(seen.kept)) {
				message += " The Rust toolchain has no " + wasmTarget + " target: add it with 'rustup target add " + wasmTarget + "'."
			}
			return nil, "", &BuildError{Message: message, Log: log}
		}
		path := BuiltModulePath(messages.String())
		if path == "" {
			return nil, "", &BuildError{
				Message: "The " + label + ` build produced no WebAssembly module. A component crate builds a cdylib: crate-type = ["cdylib"].`,
				Log:     log,
			}
		}
		module, err := os.ReadFile(path)
		if err != nil {
			return nil, "", &BuildError{Message: "Could not read " + path + ": " + err.Error(), Log: log}
		}
		return module, log, nil
	}

	module, log, err := compile(nil, "component", "")
	if err != nil {
		return nil, err
	}
	described, err := definition.ReadModule(module)
	if err != nil {
		return nil, &BuildError{Message: "The module is not a component module: " + err.Error(), Log: log}
	}
	if !described.Panel {
		return &Build{Module: module, Definition: described, Log: log}, nil
	}
	panel, log, err := compile(PanelBuildFeatures, "editor panel", log)
	if err != nil {
		return nil, err
	}
	panels, problems := definition.ValidatePanelModule(panel, described)
	if len(problems) > 0 {
		return nil, &BuildError{
			Message: strings.Join(append([]string{"The editor panel module was rejected:"}, problems...), "\n  - "),
			Log:     log,
		}
	}
	return &Build{Module: module, Panel: panel, Panels: panels, Definition: described, Log: log}, nil
}

// BuildOutputPath is where `voidhash test` writes a crate's modules,
// relative to the crate.
var BuildOutputPath = filepath.Join("target", "voidhash")

// WriteBuild writes a build's module.wasm and, for a component with an
// editor panel, panel.wasm into directory, removing a panel.wasm an earlier
// build left when the component no longer has a panel. It returns the paths
// written; panelPath is empty without a panel.
func WriteBuild(directory string, build *Build) (modulePath, panelPath string, err error) {
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return "", "", err
	}
	modulePath = filepath.Join(directory, "module.wasm")
	panelPath = filepath.Join(directory, "panel.wasm")
	if err := os.WriteFile(modulePath, build.Module, 0o644); err != nil {
		return "", "", err
	}
	if build.Panel == nil {
		if err := os.Remove(panelPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return "", "", err
		}
		return modulePath, "", nil
	}
	if err := os.WriteFile(panelPath, build.Panel, 0o644); err != nil {
		return "", "", err
	}
	return modulePath, panelPath, nil
}
