package workingcopy

import (
	"regexp"
	"strings"
)

// PublishKind says how a component of the working copy stands against the
// catalog.
type PublishKind string

// The kinds of publish candidates.
const (
	KindNew        PublishKind = "new"
	KindModified   PublishKind = "modified"
	KindConflicted PublishKind = "conflicted"
	KindUnchanged  PublishKind = "unchanged"
)

// PublishCandidate is a component of the working copy and its changes.
type PublishCandidate struct {
	Slug string
	Kind PublishKind
	// Changes are its files' changes against the base (every file is new
	// for a new component).
	Changes []FileChange
}

// Candidate classifies a component of the working copy: new without a base
// (a nil entry), conflicted while the markers of a conflicting merge remain,
// modified when its files differ from the base, and unchanged otherwise.
func Candidate(slug string, files Files, entry *ComponentState) PublishCandidate {
	if entry == nil {
		return PublishCandidate{Slug: slug, Kind: KindNew, Changes: FileChanges(Files{}, files)}
	}
	changes := FileChanges(entry.Base, files)
	kind := KindModified
	switch {
	case entry.IsConflicted && FilesHaveConflictMarkers(files):
		kind = KindConflicted
	case len(changes) == 0:
		kind = KindUnchanged
	}
	return PublishCandidate{Slug: slug, Kind: kind, Changes: changes}
}

// FormatChanges is the per-file summary of a candidate:
// `src/lib.rs +12 −3, src/theme.rs new`.
func (c PublishCandidate) FormatChanges() string {
	parts := make([]string, len(c.Changes))
	for index, change := range c.Changes {
		parts[index] = change.Format()
	}
	return strings.Join(parts, ", ")
}

// IsSelectable says whether a candidate can be published now.
func (c PublishCandidate) IsSelectable() bool {
	return c.Kind == KindNew || c.Kind == KindModified
}

// Selection is how the components to publish are chosen: the slugs, a
// refusal with its message, or NeedsPrompt to ask in the terminal.
type Selection struct {
	Slugs       []string
	NeedsPrompt bool
	Refusal     string
}

// SelectForPublish chooses the components to publish from the command line:
// all takes every new and modified component; components names them and
// refuses unknown, unchanged and conflicted ones; without either, a terminal
// asks and anything else is refused.
func SelectForPublish(candidates []PublishCandidate, all bool, components []string, isInteractive bool) Selection {
	if all {
		slugs := []string{}
		for _, candidate := range candidates {
			if candidate.IsSelectable() {
				slugs = append(slugs, candidate.Slug)
			}
		}
		return Selection{Slugs: slugs}
	}
	if len(components) > 0 {
		var problems, slugs []string
		seen := map[string]bool{}
		for _, slug := range components {
			var found *PublishCandidate
			for index := range candidates {
				if candidates[index].Slug == slug && found == nil {
					found = &candidates[index]
				}
			}
			switch {
			case found == nil:
				problems = append(problems, slug+" is not a component of the working copy (.voidhash/components/"+slug+").")
			case found.Kind == KindConflicted:
				problems = append(problems, slug+" has unresolved conflicts: resolve the conflict markers first.")
			case found.Kind == KindUnchanged:
				problems = append(problems, slug+" has no changes to publish.")
			}
			if !seen[slug] {
				seen[slug] = true
				slugs = append(slugs, slug)
			}
		}
		if len(problems) > 0 {
			return Selection{Refusal: strings.Join(problems, "\n")}
		}
		return Selection{Slugs: slugs}
	}
	if isInteractive {
		return Selection{NeedsPrompt: true}
	}
	return Selection{Refusal: "Choose what to publish with --all or --component <slug>: there is no terminal to ask in."}
}

var componentTitle = regexp.MustCompile(`#\[component\([^\]]*?\btitle\s*=\s*"((?:[^"\\]|\\.)*)"`)

// TitleFromSource reads the title `#[component(…)]` gives the component in
// src/lib.rs, for the catalog entry a first publish creates. ok is false
// when the source names none.
func TitleFromSource(libRs string) (title string, ok bool) {
	match := componentTitle.FindStringSubmatch(libRs)
	if match == nil {
		return "", false
	}
	return match[1], true
}

// PublishedState is a component's state once `publish` created version from
// files: the version is the new base, which leaves nothing to resolve. The
// published version moves only once the version's build is ready.
func PublishedState(previous *ComponentState, version int, files Files) ComponentState {
	state := ComponentState{BaseVersion: version, BaseHash: FilesHash(files), Base: files}
	if previous != nil {
		state.PublishedVersion = previous.PublishedVersion
	}
	return state
}
