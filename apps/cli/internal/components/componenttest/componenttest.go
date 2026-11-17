// Package componenttest sets up what tests of the component commands need:
// a project directory, component modules, and a stand-in for cargo. Not for
// production code.
package componenttest

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/wasmtest"
)

// M is a JSON object.
type M = map[string]any

// ProjectDir makes a directory configured for the project acme/app, which
// the test session's person can use.
func ProjectDir(t testing.TB) string {
	t.Helper()
	directory, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	Write(t, filepath.Join(directory, "voidhash.json"), []byte(`{"team":"acme","project":"app"}`))
	return directory
}

// Write writes a file, creating its directory.
func Write(t testing.TB, path string, content []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
}

// Definition is the definition `#[component]` embeds in an ABI 2 module.
func Definition(id, title string, panel bool) M {
	return M{
		"id": id, "version": "0.1.0", "title": title, "description": "",
		"icon": M{"kind": "builtin", "name": "component"}, "category": "Project", "keywords": []any{},
		"implementation": M{"kind": "wasm", "abi": 2}, "traits": M{"appearance": M{}},
		"children": M{"kind": "none"}, "props": []any{}, "events": []any{},
		"previewStates": []any{"default"}, "capabilities": []any{}, "panel": panel, "fallback": "placeholder",
	}
}

// ComponentModule is a component module that describes itself with
// [Definition].
func ComponentModule(id, title string, panel bool) []byte {
	return wasmtest.ComponentModule(Definition(id, title, panel))
}

// PanelModule is the editor panel module of the component id.
func PanelModule(id string) []byte {
	return wasmtest.Module(wasmtest.Options{Panels: []any{wasmtest.PanelEntry(id, nil)}})
}

// Tools makes a directory of executables to put first on a run's PATH, and
// returns that PATH. Each script is the body of a POSIX shell script. Tests
// that need it are skipped on Windows.
func Tools(t testing.TB, scripts map[string]string) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("stands in for executables with shell scripts")
	}
	bin := t.TempDir()
	for name, body := range scripts {
		path := filepath.Join(bin, name)
		Write(t, path, []byte("#!/bin/sh\n"+body+"\n"))
		if err := os.Chmod(path, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	return bin + string(os.PathListSeparator) + "/bin" + string(os.PathListSeparator) + "/usr/bin"
}

// CargoScript is a stand-in for cargo: every build "compiles" to module, and
// a build with the panel feature to panel. Its diagnostics name the crate's
// directory, and a crate holding a file named `broken` does not build.
func CargoScript(t testing.TB, module, panel []byte) string {
	t.Helper()
	built := t.TempDir()
	Write(t, filepath.Join(built, "module.wasm"), module)
	Write(t, filepath.Join(built, "panel.wasm"), panel)
	return `echo "   Compiling $(basename "$PWD")" >&2
if [ -e broken ]; then echo "error[E0425]: cannot find value" >&2; exit 101; fi
case "$*" in
  *"--features panel"*) built="` + built + `/panel.wasm" ;;
  *) built="` + built + `/module.wasm" ;;
esac
printf '{"reason":"compiler-artifact","target":{"kind":["cdylib"]},"filenames":["%s"]}\n' "$built"`
}
