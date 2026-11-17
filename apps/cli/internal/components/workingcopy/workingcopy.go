package workingcopy

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/crate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/definition"
)

// Directory is the working copy's directory in the project root.
const Directory = ".voidhash"

// IsComponentSlug says whether name is a component slug: lowercase letters,
// digits and dashes.
func IsComponentSlug(name string) bool { return definition.IsSlug(name) }

// WorkspaceCargoToml is the workspace manifest written once into a new
// working copy. The developer owns it afterwards; the CLI never rewrites it.
const WorkspaceCargoToml = `# The Cargo workspace of this project's Voidhash components, one crate per
# directory under components/. voidhash dev builds and serves them;
# voidhash publish publishes them. Add to this file as you need.
[workspace]
resolver = "3"
members = ["components/*"]

# Component modules are downloaded by apps: optimise for size.
[profile.release]
panic = "abort"
opt-level = "z"
lto = true
codegen-units = 1
strip = true

# To build against a voidhash-ui that is not released yet, point every
# component's dependency at a checkout of it (the path is relative to this file):
#
# [patch.crates-io]
# voidhash-ui = { path = "../../voidhash/crates/voidhash-ui" }
`

// ComponentState is a component's entry in state.json.
type ComponentState struct {
	// BaseVersion is the catalog version the working copy is based on.
	BaseVersion int `json:"baseVersion"`
	// BaseHash is [FilesHash] of Base.
	BaseHash string `json:"baseHash"`
	// Base holds that version's files as the CLI wrote them: the base of
	// every merge and diff.
	Base Files `json:"base"`
	// PublishedVersion is the newest version `voidhash publish` created
	// from this working copy; nil when there is none.
	PublishedVersion *int `json:"publishedVersion,omitempty"`
	// IsConflicted says whether the last merge left conflict markers that
	// remain.
	IsConflicted bool `json:"isConflicted"`
}

// State is state.json. A component directory without an entry is local.
type State struct {
	Version    int                       `json:"version"`
	ProjectID  string                    `json:"projectId"`
	Components map[string]ComponentState `json:"components"`
}

// StateError says state.json is unreadable or belongs to another project.
type StateError struct{ Message string }

func (e *StateError) Error() string { return e.Message }

// SHA256Hex is the lowercase hex SHA-256 of data.
func SHA256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// FilesHash is the baseHash of a component's files: each as
// `<path>\0<content>\0`, in path order.
func FilesHash(files Files) string {
	var joined strings.Builder
	for _, path := range sortedPaths(files) {
		joined.WriteString(path)
		joined.WriteByte(0)
		joined.WriteString(files[path])
		joined.WriteByte(0)
	}
	return SHA256Hex([]byte(joined.String()))
}

var sourcePath = regexp.MustCompile(`^src/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\.rs$`)

// IsSourcePath says whether a server file path is one the working copy
// keeps: Cargo.toml or a Rust module under src/, without `..` or other
// unusual segments, so writing it cannot leave the component's directory.
func IsSourcePath(path string) bool {
	return path == "Cargo.toml" || sourcePath.MatchString(path)
}

var (
	tableHeader  = regexp.MustCompile(`^\s*\[\s*([A-Za-z0-9_.-]+)\s*\]\s*(?:#.*)?$`)
	blankOrNote  = regexp.MustCompile(`^\s*(#.*)?$`)
	lineBreak    = regexp.MustCompile(`\r?\n`)
	ignoresEntry = regexp.MustCompile(`^/?\.voidhash/?$`)
)

func withoutTrailing(lines []string, drop func(line string) bool) []string {
	for len(lines) > 0 && drop(lines[len(lines)-1]) {
		lines = lines[:len(lines)-1]
	}
	return lines
}

// WithoutWorkspaceTables removes the [workspace] and [profile.*] tables (and
// their subtables) from a crate manifest, with the comment lines directly
// above them: they belong to the working copy's workspace manifest.
func WithoutWorkspaceTables(cargoToml string) string {
	var kept []string
	dropping := false
	for _, line := range lineBreak.Split(cargoToml, -1) {
		header := tableHeader.FindStringSubmatch(line)
		if header == nil {
			if !dropping {
				kept = append(kept, line)
			}
			continue
		}
		table, _, _ := strings.Cut(header[1], ".")
		if table == "workspace" || table == "profile" {
			kept = withoutTrailing(kept, blankOrNote.MatchString)
			dropping = true
		} else {
			kept = append(kept, line)
			dropping = false
		}
	}
	kept = withoutTrailing(kept, func(line string) bool { return strings.TrimSpace(line) == "" })
	return strings.Join(kept, "\n") + "\n"
}

// LocalFiles returns a component's files as the working copy keeps them:
// the server's Cargo.toml without workspace tables, or the default member
// manifest when the server has none.
func LocalFiles(slug string, serverFiles Files) Files {
	files := Files{}
	for path, content := range serverFiles {
		files[path] = content
	}
	if cargoToml, ok := serverFiles["Cargo.toml"]; ok {
		files["Cargo.toml"] = WithoutWorkspaceTables(cargoToml)
	} else {
		files["Cargo.toml"] = crate.MemberCargoToml(slug)
	}
	return files
}

// GitignoreIgnoringWorkingCopy returns the .gitignore that also ignores the
// working copy; changed is false when current already does. exists says
// whether the file exists.
func GitignoreIgnoringWorkingCopy(current string, exists bool) (updated string, changed bool) {
	if !exists {
		current = ""
	}
	for _, line := range lineBreak.Split(current, -1) {
		if ignoresEntry.MatchString(strings.TrimSpace(line)) {
			return "", false
		}
	}
	separator := "\n"
	if current == "" || strings.HasSuffix(current, "\n") {
		separator = ""
	}
	return current + separator + Directory + "/\n", true
}

// WorkingCopy is the working copy of one project.
type WorkingCopy struct {
	// Directory is `.voidhash/`.
	Directory string
	// ComponentsDirectory is `.voidhash/components/`.
	ComponentsDirectory string
	ProjectID           string

	statePath string
	stateLock sync.Mutex
}

// Open returns the working copy in root for projectID, whether or not it
// exists yet.
func Open(root, projectID string) *WorkingCopy {
	directory := filepath.Join(root, Directory)
	return &WorkingCopy{
		Directory:           directory,
		ComponentsDirectory: filepath.Join(directory, "components"),
		ProjectID:           projectID,
		statePath:           filepath.Join(directory, "state.json"),
	}
}

// ComponentDirectory is the crate directory of the component slug.
func (w *WorkingCopy) ComponentDirectory(slug string) string {
	return filepath.Join(w.ComponentsDirectory, slug)
}

func (w *WorkingCopy) unreadable(reason string) *StateError {
	return &StateError{Message: fmt.Sprintf("%s is not a working copy state the CLI can read (%s). Fix it, or remove %s to pull the components again.", w.statePath, reason, w.Directory)}
}

// ReadState reads state.json; an empty state when there is none. A state
// that cannot be used is a [*StateError].
func (w *WorkingCopy) ReadState() (*State, error) {
	data, err := os.ReadFile(w.statePath)
	if errors.Is(err, fs.ErrNotExist) {
		return &State{Version: 1, ProjectID: w.ProjectID, Components: map[string]ComponentState{}}, nil
	}
	if err != nil {
		return nil, err
	}
	var raw struct {
		Version    *json.Number `json:"version"`
		ProjectID  *string      `json:"projectId"`
		Components *map[string]struct {
			BaseVersion      *float64 `json:"baseVersion"`
			BaseHash         *string  `json:"baseHash"`
			Base             *Files   `json:"base"`
			PublishedVersion *float64 `json:"publishedVersion"`
			IsConflicted     *bool    `json:"isConflicted"`
		} `json:"components"`
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&raw); err != nil {
		return nil, w.unreadable(err.Error())
	}
	switch {
	case raw.Version == nil || raw.Version.String() != "1":
		return nil, w.unreadable(`"version" must be 1`)
	case raw.ProjectID == nil:
		return nil, w.unreadable(`"projectId" is missing`)
	case raw.Components == nil:
		return nil, w.unreadable(`"components" is missing`)
	}
	state := &State{Version: 1, ProjectID: *raw.ProjectID, Components: map[string]ComponentState{}}
	for slug, entry := range *raw.Components {
		if entry.BaseVersion == nil || entry.BaseHash == nil || entry.Base == nil || entry.IsConflicted == nil {
			return nil, w.unreadable(fmt.Sprintf("the entry of %s lacks baseVersion, baseHash, base or isConflicted", slug))
		}
		component := ComponentState{
			BaseVersion:  int(*entry.BaseVersion),
			BaseHash:     *entry.BaseHash,
			Base:         *entry.Base,
			IsConflicted: *entry.IsConflicted,
		}
		if entry.PublishedVersion != nil {
			published := int(*entry.PublishedVersion)
			component.PublishedVersion = &published
		}
		state.Components[slug] = component
	}
	if state.ProjectID != w.ProjectID {
		return nil, &StateError{Message: fmt.Sprintf("%s is the working copy of project %s, but this directory's configuration names project %s. Move %s away to start a working copy of this project.", w.Directory, state.ProjectID, w.ProjectID, w.Directory)}
	}
	return state, nil
}

// UpdateState reads state.json again, applies change and writes the result
// atomically (a temporary file, then a rename), so `dev` and `publish` may
// change it from two processes.
func (w *WorkingCopy) UpdateState(change func(state *State)) (*State, error) {
	w.stateLock.Lock()
	defer w.stateLock.Unlock()
	state, err := w.ReadState()
	if err != nil {
		return nil, err
	}
	change(state)
	var encoded bytes.Buffer
	encoder := json.NewEncoder(&encoded)
	// Source files hold `<`, `>` and `&`; they are kept readable.
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(state); err != nil {
		return nil, err
	}
	temporary, err := os.CreateTemp(w.Directory, "state.json.*.tmp")
	if err != nil {
		return nil, err
	}
	_, err = temporary.Write(encoded.Bytes())
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Chmod(temporary.Name(), 0o644)
	}
	if err == nil {
		err = os.Rename(temporary.Name(), w.statePath)
	}
	if err != nil {
		_ = os.Remove(temporary.Name())
		return nil, err
	}
	return state, nil
}

// IsComponent says whether components/<slug> is a crate with src/lib.rs.
func (w *WorkingCopy) IsComponent(slug string) bool {
	if !IsComponentSlug(slug) {
		return false
	}
	directory := w.ComponentDirectory(slug)
	return isFile(filepath.Join(directory, "Cargo.toml")) && isFile(filepath.Join(directory, "src", "lib.rs"))
}

func isFile(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// ListComponents lists the slugs of the directories under components/ that
// are crates with src/lib.rs, in order.
func (w *WorkingCopy) ListComponents() ([]string, error) {
	entries, err := os.ReadDir(w.ComponentsDirectory)
	if errors.Is(err, fs.ErrNotExist) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	slugs := []string{}
	for _, entry := range entries {
		if w.IsComponent(entry.Name()) {
			slugs = append(slugs, entry.Name())
		}
	}
	sort.Strings(slugs)
	return slugs, nil
}

// ReadComponentFiles reads a component's Cargo.toml and src/**.rs.
func (w *WorkingCopy) ReadComponentFiles(slug string) (Files, error) {
	return crate.ReadSource(w.ComponentDirectory(slug))
}

// WriteComponentFiles makes a component's Cargo.toml and src/**.rs exactly
// files: it writes the files that differ and removes the Rust modules files
// lacks.
func (w *WorkingCopy) WriteComponentFiles(slug string, files Files) error {
	directory := w.ComponentDirectory(slug)
	current, err := w.ReadComponentFiles(slug)
	if err != nil {
		return err
	}
	for _, path := range sortedPaths(current) {
		if _, kept := files[path]; !kept {
			if err := os.Remove(filepath.Join(directory, filepath.FromSlash(path))); err != nil {
				return err
			}
		}
	}
	for _, path := range sortedPaths(files) {
		if existing, ok := current[path]; ok && existing == files[path] {
			continue
		}
		target := filepath.Join(directory, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(target, []byte(files[path]), 0o644); err != nil {
			return err
		}
	}
	return nil
}

// Prepare opens the working copy in root, creating it first when it does
// not exist: the workspace manifest, state.json and components/, and a
// `.voidhash/` line in the project's .gitignore. It returns the notes to
// print about what it created.
func Prepare(root, projectID string) (*WorkingCopy, []string, error) {
	workingCopy := Open(root, projectID)
	var notes []string
	if err := os.MkdirAll(workingCopy.ComponentsDirectory, 0o755); err != nil {
		return nil, nil, err
	}
	manifest := filepath.Join(workingCopy.Directory, "Cargo.toml")
	if !isFile(manifest) {
		if err := os.WriteFile(manifest, []byte(WorkspaceCargoToml), 0o644); err != nil {
			return nil, nil, err
		}
		notes = append(notes, "Created the component working copy in "+workingCopy.Directory+".")
	}
	// Checks the project of an existing state, and writes the state of a new one.
	if _, err := workingCopy.UpdateState(func(*State) {}); err != nil {
		return nil, nil, err
	}

	gitignore := filepath.Join(root, ".gitignore")
	current, err := os.ReadFile(gitignore)
	exists := err == nil
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, nil, err
	}
	if updated, changed := GitignoreIgnoringWorkingCopy(string(current), exists); changed {
		if err := os.WriteFile(gitignore, []byte(updated), 0o644); err != nil {
			return nil, nil, err
		}
		if exists {
			notes = append(notes, "Added "+Directory+"/ to "+gitignore+".")
		} else {
			notes = append(notes, "Created "+gitignore+" to ignore "+Directory+"/.")
		}
	}
	return workingCopy, notes, nil
}
