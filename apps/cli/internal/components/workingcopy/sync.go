package workingcopy

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

// CatalogComponent is a component of the project's catalog, as its listing
// describes it.
type CatalogComponent struct {
	ID    string
	Slug  string
	Title string
	// Latest is its newest version; nil while it has none.
	Latest *CatalogHead
}

// CatalogHead is a component's newest catalog version, with the ids that
// read it.
type CatalogHead struct {
	ComponentID string
	VersionID   string
	Version     int
	// SourceKind is "rust" for a version built from source and "wasm" for a
	// prebuilt module.
	SourceKind string
}

// Catalog makes the catalog calls a sync needs.
type Catalog interface {
	// ListComponents lists every component of the project.
	ListComponents(ctx context.Context) ([]CatalogComponent, error)
	// SourceFiles reads the source files of a version; nil when it has none.
	SourceFiles(ctx context.Context, componentID, versionID string) (Files, error)
}

// SyncAction is what a sync does for one component.
type SyncAction string

// The actions of a sync.
const (
	// ActionPull writes the newest version into a new directory; it becomes
	// the base.
	ActionPull SyncAction = "pull"
	// ActionMerge merges the newest version into the existing directory,
	// against the base (or an empty one).
	ActionMerge SyncAction = "merge"
	// ActionBecomeLocal drops the entry of a component the server no longer
	// lists, and keeps its files.
	ActionBecomeLocal SyncAction = "become-local"
	// ActionNotEditable is for a newest version that is a prebuilt module,
	// without source to edit.
	ActionNotEditable SyncAction = "not-editable"
	ActionNone        SyncAction = "none"
)

// DecideSync decides what a sync does for a component, from its newest
// catalog version (nil when the server does not list it), its state.json
// entry (nil without one) and whether the working copy has its directory.
// pullMissing is false for `publish`, which only updates the components the
// working copy has.
func DecideSync(head *CatalogHead, entry *ComponentState, hasDirectory, pullMissing bool) SyncAction {
	switch {
	case head == nil && entry != nil:
		return ActionBecomeLocal
	case head == nil:
		return ActionNone
	case head.SourceKind == "wasm":
		return ActionNotEditable
	case !hasDirectory && pullMissing:
		return ActionPull
	case !hasDirectory:
		return ActionNone
	case entry == nil || head.Version > entry.BaseVersion:
		return ActionMerge
	}
	return ActionNone
}

// SyncEventKind is what a sync did for a component.
type SyncEventKind string

// The kinds of sync events.
const (
	Pulled      SyncEventKind = "pulled"
	Merged      SyncEventKind = "merged"
	BecameLocal SyncEventKind = "became-local"
	NotEditable SyncEventKind = "not-editable"
	Skipped     SyncEventKind = "skipped"
)

// SyncEvent is what a sync did for one component it touched.
type SyncEvent struct {
	Kind    SyncEventKind
	Slug    string
	Version int
	// Merge is the outcome of a Merged event.
	Merge Merge
	// Reason says why a version was Skipped.
	Reason string
}

// mergeNote names the files a merge took and merged: ` (updated a.rs; merged b.rs)`.
func mergeNote(merge Merge) string {
	var parts []string
	if len(merge.Updated) > 0 {
		parts = append(parts, "updated "+strings.Join(merge.Updated, ", "))
	}
	if len(merge.Merged) > 0 {
		parts = append(parts, "merged "+strings.Join(merge.Merged, ", "))
	}
	if len(parts) == 0 {
		return ""
	}
	return " (" + strings.Join(parts, "; ") + ")"
}

// Format is the line printed for a sync event.
func (e SyncEvent) Format() string {
	switch e.Kind {
	case Pulled:
		return fmt.Sprintf("↓ %s: pulled v%d.", e.Slug, e.Version)
	case Merged:
		line := fmt.Sprintf("↓ %s: merged v%d%s.", e.Slug, e.Version, mergeNote(e.Merge))
		if len(e.Merge.Conflicted) == 0 {
			return line
		}
		verb := "conflict"
		if len(e.Merge.Conflicted) == 1 {
			verb = "conflicts"
		}
		return fmt.Sprintf("%s\n  ! %s %s with your changes: resolve the <<<<<<< local / >>>>>>> v%d markers.", line, strings.Join(e.Merge.Conflicted, ", "), verb, e.Version)
	case BecameLocal:
		return "- " + e.Slug + ": the project no longer has this component; its files stay as a local component."
	case NotEditable:
		return "- " + e.Slug + ": its newest version is a prebuilt module without source, so it is not in the working copy."
	default:
		return "! " + e.Slug + ": " + e.Reason
	}
}

// MergedState is a component's state after a catalog version was merged
// into its working copy: the version is the new base, whatever the merge
// did, and the component is conflicted when the merge left markers, or when
// markers of an earlier conflict the developer has not resolved yet remain.
func MergedState(version int, base Files, merge Merge, previous *ComponentState) ComponentState {
	state := ComponentState{
		BaseVersion:  version,
		BaseHash:     FilesHash(base),
		Base:         base,
		IsConflicted: len(merge.Conflicted) > 0 || (previous != nil && previous.IsConflicted && FilesHaveConflictMarkers(merge.Files)),
	}
	if previous != nil {
		state.PublishedVersion = previous.PublishedVersion
	}
	return state
}

func entryOf(state *State, slug string) *ComponentState {
	if entry, ok := state.Components[slug]; ok {
		return &entry
	}
	return nil
}

// Sync brings the working copy up to date with the project's catalog: it
// pulls the components it lacks (with pullMissing) and merges newer versions
// of the ones it has. It returns what it did, one event per component it
// touched, and the title of every component the server lists.
func Sync(ctx context.Context, workingCopy *WorkingCopy, catalog Catalog, pullMissing bool) (events []SyncEvent, titles map[string]string, err error) {
	listed, err := catalog.ListComponents(ctx)
	if err != nil {
		return nil, nil, err
	}
	state, err := workingCopy.ReadState()
	if err != nil {
		return nil, nil, err
	}
	local, err := workingCopy.ListComponents()
	if err != nil {
		return nil, nil, err
	}
	heads := map[string]*CatalogHead{}
	// A component without a version yet is listed, but has nothing to pull.
	unversioned := map[string]bool{}
	titles = map[string]string{}
	for _, component := range listed {
		titles[component.Slug] = component.Title
		if component.Latest != nil {
			heads[component.Slug] = component.Latest
		}
	}
	for _, component := range listed {
		if heads[component.Slug] == nil {
			unversioned[component.Slug] = true
		}
	}
	hasDirectory := map[string]bool{}
	candidates := map[string]bool{}
	for slug := range heads {
		candidates[slug] = true
	}
	for slug := range state.Components {
		candidates[slug] = true
	}
	for _, slug := range local {
		candidates[slug], hasDirectory[slug] = true, true
	}
	var slugs []string
	for slug := range candidates {
		if !unversioned[slug] {
			slugs = append(slugs, slug)
		}
	}
	sort.Strings(slugs)

	// applyVersion writes a catalog version into the working copy, merged
	// with what it has, and makes it the base.
	applyVersion := func(slug string, head *CatalogHead, isPull bool) (SyncEvent, error) {
		skipped := func(reason string) (SyncEvent, error) {
			return SyncEvent{Kind: Skipped, Slug: slug, Reason: reason}, nil
		}
		serverFiles, err := catalog.SourceFiles(ctx, head.ComponentID, head.VersionID)
		if err != nil {
			return SyncEvent{}, err
		}
		if len(serverFiles) == 0 {
			return skipped(fmt.Sprintf("v%d has no source files to pull.", head.Version))
		}
		var unsafe []string
		for _, path := range sortedPaths(serverFiles) {
			if !IsSourcePath(path) {
				unsafe = append(unsafe, path)
			}
		}
		if len(unsafe) > 0 {
			return skipped(fmt.Sprintf("v%d has files outside Cargo.toml and src/**.rs (%s), so it was not pulled.", head.Version, strings.Join(unsafe, ", ")))
		}
		incoming := LocalFiles(slug, serverFiles)
		base, current := Files{}, Files{}
		if entry := entryOf(state, slug); entry != nil {
			base = entry.Base
		}
		if !isPull {
			if current, err = workingCopy.ReadComponentFiles(slug); err != nil {
				return SyncEvent{}, err
			}
		}
		merge := MergeFiles(base, current, incoming, MergeLabels{Local: "local", Incoming: fmt.Sprintf("v%d", head.Version)})
		if err := workingCopy.WriteComponentFiles(slug, merge.Files); err != nil {
			return SyncEvent{}, err
		}
		if _, err := workingCopy.UpdateState(func(current *State) {
			current.Components[slug] = MergedState(head.Version, incoming, merge, entryOf(current, slug))
		}); err != nil {
			return SyncEvent{}, err
		}
		if isPull {
			return SyncEvent{Kind: Pulled, Slug: slug, Version: head.Version}, nil
		}
		return SyncEvent{Kind: Merged, Slug: slug, Version: head.Version, Merge: merge}, nil
	}

	for _, slug := range slugs {
		head := heads[slug]
		switch action := DecideSync(head, entryOf(state, slug), hasDirectory[slug], pullMissing); action {
		case ActionNotEditable:
			events = append(events, SyncEvent{Kind: NotEditable, Slug: slug})
		case ActionBecomeLocal:
			if _, err := workingCopy.UpdateState(func(current *State) { delete(current.Components, slug) }); err != nil {
				return nil, nil, err
			}
			events = append(events, SyncEvent{Kind: BecameLocal, Slug: slug})
		case ActionPull, ActionMerge:
			event, err := applyVersion(slug, head, action == ActionPull)
			if err != nil {
				return nil, nil, err
			}
			events = append(events, event)
		}
	}
	return events, titles, nil
}
