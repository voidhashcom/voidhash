// Package devserver is the local server of `voidhash dev`: the build state
// of every component of the working copy, the HTTP routes the paywall editor
// reads them through, and the dev session that tells the editor where the
// server is. The protocol is the component dev session specification.
package devserver

import (
	"sort"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/crate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/definition"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/workingcopy"
)

// Protocol is the protocol version the server speaks.
const Protocol = 2

// DefaultPort is the port `dev` listens on by default.
const DefaultPort = 4319

// keptBuilds is how many successful builds of a component stay downloadable.
const keptBuilds = 4

const maxLogBytes = 64 * 1024

// Artifact is a built module the server serves.
type Artifact struct {
	Hash     string `json:"hash"`
	ByteSize int    `json:"byteSize"`
	URL      string `json:"url"`
}

// PanelArtifact is a built editor panel module, with its panels.
type PanelArtifact struct {
	Hash     string                          `json:"hash"`
	ByteSize int                             `json:"byteSize"`
	URL      string                          `json:"url"`
	Panels   []definition.PanelManifestEntry `json:"panels"`
}

// BuildStatus is a component's current or last build.
type BuildStatus struct {
	// Number is 0 until the first build starts.
	Number int `json:"number"`
	// State is "building", "ready" or "failed".
	State      string  `json:"state"`
	StartedAt  string  `json:"startedAt"`
	FinishedAt *string `json:"finishedAt"`
	Message    *string `json:"message"`
	Log        string  `json:"log"`
}

// BuiltComponent is a component's last successful build.
type BuiltComponent struct {
	Build      int                    `json:"build"`
	BuiltAt    string                 `json:"builtAt"`
	Definition *definition.Definition `json:"definition"`
	Module     Artifact               `json:"module"`
	Panel      *PanelArtifact         `json:"panel"`
}

// ComponentStatus is one component as `GET /v1/status` describes it.
type ComponentStatus struct {
	Slug         string `json:"slug"`
	DefinitionID string `json:"definitionId"`
	Title        string `json:"title"`
	// Origin is "server" or "local".
	Origin           string          `json:"origin"`
	BaseVersion      *int            `json:"baseVersion,omitempty"`
	PublishedVersion *int            `json:"publishedVersion,omitempty"`
	IsModified       bool            `json:"isModified"`
	IsConflicted     bool            `json:"isConflicted"`
	Build            BuildStatus     `json:"build"`
	Component        *BuiltComponent `json:"component"`
}

// Status is what `GET /v1/status` answers.
type Status struct {
	Protocol   int               `json:"protocol"`
	Components []ComponentStatus `json:"components"`
}

// Facts are what the working copy says of a component: its title until a
// build names one, where it comes from, and how it relates to its base.
type Facts struct {
	Title            string
	Origin           string
	BaseVersion      *int
	PublishedVersion *int
	IsModified       bool
	IsConflicted     bool
}

// WorkingCopyFacts reads what the working copy says of a component from its
// files and its state.json entry: a component without an entry is local and
// always modified; markers keep a conflicted component conflicted.
func WorkingCopyFacts(files workingcopy.Files, entry *workingcopy.ComponentState, title string) Facts {
	if entry == nil {
		return Facts{Title: title, Origin: "local", IsModified: true}
	}
	baseVersion := entry.BaseVersion
	return Facts{
		Title:            title,
		Origin:           "server",
		BaseVersion:      &baseVersion,
		PublishedVersion: entry.PublishedVersion,
		IsModified:       !workingcopy.SameFiles(entry.Base, files),
		IsConflicted:     entry.IsConflicted && workingcopy.FilesHaveConflictMarkers(files),
	}
}

type builtModule struct {
	hash  string
	bytes []byte
}

type builtModules struct {
	module builtModule
	// panel is nil for a build without a panel.
	panel *builtModule
}

func keepLogEnd(log string) string {
	if len(log) <= maxLogBytes {
		return log
	}
	end := log[len(log)-maxLogBytes:]
	for len(end) > 0 && !utf8.RuneStart(end[0]) {
		end = end[1:]
	}
	return "[log truncated]\n" + end
}

// State is the build state the dev server serves, one entry per component
// of the working copy. The run changes it while requests read it.
type State struct {
	now func() time.Time

	lock       sync.Mutex
	components map[string]ComponentStatus
	// modules holds each component's last successful builds, newest first.
	modules map[string][]builtModules
}

// NewState creates an empty state that reads the time from now.
func NewState(now func() time.Time) *State {
	return &State{now: now, components: map[string]ComponentStatus{}, modules: map[string][]builtModules{}}
}

func (s *State) timestamp() string {
	return s.now().UTC().Format("2006-01-02T15:04:05.000Z")
}

// Describe adds a component, or updates what the working copy says of it.
func (s *State) Describe(slug string, facts Facts) {
	startedAt := s.timestamp()
	s.lock.Lock()
	defer s.lock.Unlock()
	existing, served := s.components[slug]
	next := ComponentStatus{
		Slug:             slug,
		DefinitionID:     crate.ComponentID(slug),
		Title:            facts.Title,
		Origin:           facts.Origin,
		BaseVersion:      facts.BaseVersion,
		PublishedVersion: facts.PublishedVersion,
		IsModified:       facts.IsModified,
		IsConflicted:     facts.IsConflicted,
		Build:            BuildStatus{State: "building", StartedAt: startedAt},
	}
	if served {
		next.Build, next.Component = existing.Build, existing.Component
		if existing.Component != nil {
			next.Title = existing.Component.Definition.Title
		}
	}
	s.components[slug] = next
}

// Has says whether the component is served.
func (s *State) Has(slug string) bool {
	s.lock.Lock()
	defer s.lock.Unlock()
	_, served := s.components[slug]
	return served
}

// Building is a build that has started.
type Building struct {
	slug      string
	number    int
	startedAt string
}

// StartBuild marks the component's next build as started. ok is false when
// the component is not served.
func (s *State) StartBuild(slug string) (building Building, ok bool) {
	startedAt := s.timestamp()
	s.lock.Lock()
	defer s.lock.Unlock()
	status, served := s.components[slug]
	if !served {
		return Building{}, false
	}
	status.Build = BuildStatus{Number: status.Build.Number + 1, State: "building", StartedAt: startedAt}
	s.components[slug] = status
	return Building{slug: slug, number: status.Build.Number, startedAt: startedAt}, true
}

// FinishBuild records the outcome of a started build: built, or failure
// when it did not build. It returns the component's status after it; ok is
// false when the component was removed meanwhile.
func (s *State) FinishBuild(building Building, built *crate.Build, failure *crate.BuildError) (status ComponentStatus, ok bool) {
	finishedAt := s.timestamp()
	var modules builtModules
	if failure == nil {
		modules.module = builtModule{hash: workingcopy.SHA256Hex(built.Module), bytes: built.Module}
		if built.Panel != nil {
			modules.panel = &builtModule{hash: workingcopy.SHA256Hex(built.Panel), bytes: built.Panel}
		}
	}
	s.lock.Lock()
	defer s.lock.Unlock()
	status, served := s.components[building.slug]
	if !served {
		return ComponentStatus{}, false
	}
	if failure == nil {
		kept := append([]builtModules{modules}, s.modules[building.slug]...)
		if len(kept) > keptBuilds {
			kept = kept[:keptBuilds]
		}
		s.modules[building.slug] = kept
	}
	status.Build = BuildStatus{Number: building.number, StartedAt: building.startedAt, FinishedAt: &finishedAt}
	if failure != nil {
		status.Build.State = "failed"
		status.Build.Message = &failure.Message
		status.Build.Log = keepLogEnd(failure.Log)
	} else {
		status.Title = built.Definition.Title
		status.Build.State = "ready"
		status.Build.Log = keepLogEnd(built.Log)
		status.Component = &BuiltComponent{
			Build:      building.number,
			BuiltAt:    finishedAt,
			Definition: built.Definition,
			Module:     Artifact{Hash: modules.module.hash, ByteSize: len(modules.module.bytes), URL: "/v1/modules/" + modules.module.hash},
		}
		if modules.panel != nil {
			panels := built.Panels
			if panels == nil {
				panels = []definition.PanelManifestEntry{}
			}
			status.Component.Panel = &PanelArtifact{
				Hash: modules.panel.hash, ByteSize: len(modules.panel.bytes), URL: "/v1/panels/" + modules.panel.hash, Panels: panels,
			}
		}
	}
	s.components[building.slug] = status
	return status, true
}

// Remove stops serving a component.
func (s *State) Remove(slug string) {
	s.lock.Lock()
	defer s.lock.Unlock()
	delete(s.components, slug)
	delete(s.modules, slug)
}

// Status is the status, components in slug order.
func (s *State) Status() Status {
	s.lock.Lock()
	defer s.lock.Unlock()
	status := Status{Protocol: Protocol, Components: make([]ComponentStatus, 0, len(s.components))}
	for _, component := range s.components {
		status.Components = append(status.Components, component)
	}
	sort.Slice(status.Components, func(a, b int) bool { return status.Components[a].Slug < status.Components[b].Slug })
	return status
}

// module finds a kept module ("module") or panel module ("panel") by hash.
func (s *State) module(kind, hash string) ([]byte, bool) {
	s.lock.Lock()
	defer s.lock.Unlock()
	for _, builds := range s.modules {
		for _, build := range builds {
			if kind == "module" && build.module.hash == hash {
				return build.module.bytes, true
			}
			if kind == "panel" && build.panel != nil && build.panel.hash == hash {
				return build.panel.bytes, true
			}
		}
	}
	return nil, false
}
