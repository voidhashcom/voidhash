// Package workingcopy keeps the working copy of a project's components,
// `.voidhash/` in the project root: a Cargo workspace with one crate per
// component under components/, and state.json, what the CLI knows of each
// component's catalog versions. It pulls and merges catalog versions into
// it and says what there is to publish.
package workingcopy

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Files are the files of a component by crate-relative path (Cargo.toml,
// src/**.rs).
type Files = map[string]string

// splitLines returns a file's lines, each with its line ending, so joining
// them gives the text back.
func splitLines(text string) []string {
	if text == "" {
		return nil
	}
	lines := strings.SplitAfter(text, "\n")
	if lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

// commonLines returns the index pairs of the lines a shortest edit script
// from a to b keeps, in order: Myers' O(ND) difference algorithm, after the
// common prefix and suffix are set aside.
func commonLines(a, b []string) [][2]int {
	start := 0
	for start < len(a) && start < len(b) && a[start] == b[start] {
		start++
	}
	endA, endB := len(a), len(b)
	for endA > start && endB > start && a[endA-1] == b[endB-1] {
		endA--
		endB--
	}
	n, m := endA-start, endB-start
	max := n + m
	// v[max+k] is the furthest x reached on diagonal k; trace[d] keeps the
	// diagonals -d..d as they were before step d, for the walk back.
	v := make([]int, 2*max+2)
	var trace [][]int
	done := false
	for d := 0; d <= max && !done; d++ {
		trace = append(trace, append([]int(nil), v[max-d:max+d+2]...))
		for k := -d; k <= d; k += 2 {
			var x int
			if k == -d || (k != d && v[max+k-1] < v[max+k+1]) {
				x = v[max+k+1]
			} else {
				x = v[max+k-1] + 1
			}
			y := x - k
			for x < n && y < m && a[start+x] == b[start+y] {
				x++
				y++
			}
			v[max+k] = x
			if x >= n && y >= m {
				done = true
				break
			}
		}
	}

	var middle [][2]int
	x, y := n, m
	for d := len(trace) - 1; d >= 0; d-- {
		snapshot := trace[d]
		// snapshot[i] holds diagonal i-d.
		at := func(k int) int {
			if index := k + d; index >= 0 && index < len(snapshot) {
				return snapshot[index]
			}
			return 0
		}
		k := x - y
		var previousK int
		if k == -d || (k != d && at(k-1) < at(k+1)) {
			previousK = k + 1
		} else {
			previousK = k - 1
		}
		previousX := at(previousK)
		previousY := previousX - previousK
		for x > previousX && y > previousY {
			x--
			y--
			middle = append(middle, [2]int{start + x, start + y})
		}
		x, y = previousX, previousY
	}
	pairs := make([][2]int, 0, start+len(middle)+len(a)-endA)
	for index := 0; index < start; index++ {
		pairs = append(pairs, [2]int{index, index})
	}
	for index := len(middle) - 1; index >= 0; index-- {
		pairs = append(pairs, middle[index])
	}
	for index := 0; index < len(a)-endA; index++ {
		pairs = append(pairs, [2]int{endA + index, endB + index})
	}
	return pairs
}

// lineChanges counts the lines current adds to base and removes from it.
func lineChanges(base, current string) (added, removed int) {
	before, after := splitLines(base), splitLines(current)
	kept := len(commonLines(before, after))
	return len(after) - kept, len(before) - kept
}

var markerLine = regexp.MustCompile(`^(<{7}|={7}|>{7})(\s|$)`)

// HasConflictMarkers says whether text still holds a `<<<<<<<`, `=======`
// or `>>>>>>>` marker line.
func HasConflictMarkers(text string) bool {
	for _, line := range splitLines(text) {
		if markerLine.MatchString(line) {
			return true
		}
	}
	return false
}

// FilesHaveConflictMarkers says whether any file of a component still holds
// conflict markers.
func FilesHaveConflictMarkers(files Files) bool {
	for _, content := range files {
		if HasConflictMarkers(content) {
			return true
		}
	}
	return false
}

// terminated returns lines ending in a newline, so a marker line can follow.
func terminated(lines []string) []string {
	out := append([]string(nil), lines...)
	if last := len(out) - 1; last >= 0 && !strings.HasSuffix(out[last], "\n") {
		out[last] += "\n"
	}
	return out
}

func sameLines(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for index := range a {
		if a[index] != b[index] {
			return false
		}
	}
	return true
}

// MergeLabels are what the sides of a three-way merge are called in
// conflict markers: "local" and "v<version>".
type MergeLabels struct {
	Local    string
	Incoming string
}

func conflictBlock(local, incoming []string, labels MergeLabels) []string {
	block := []string{"<<<<<<< " + labels.Local + "\n"}
	block = append(block, terminated(local)...)
	block = append(block, "=======\n")
	block = append(block, terminated(incoming)...)
	return append(block, ">>>>>>> "+labels.Incoming+"\n")
}

// MergeText merges two versions of a text that both derive from base
// (diff3): the lines both keep from the base anchor the merge; between
// anchors, a side that left the base alone takes the other side's change,
// identical changes are taken once, and different changes become a conflict
// block.
func MergeText(base, local, incoming string, labels MergeLabels) (text string, hasConflicts bool) {
	baseLines, localLines, incomingLines := splitLines(base), splitLines(local), splitLines(incoming)
	inLocal := make([]int, len(baseLines))
	inIncoming := make([]int, len(baseLines))
	for index := range baseLines {
		inLocal[index], inIncoming[index] = -1, -1
	}
	for _, pair := range commonLines(baseLines, localLines) {
		inLocal[pair[0]] = pair[1]
	}
	for _, pair := range commonLines(baseLines, incomingLines) {
		inIncoming[pair[0]] = pair[1]
	}

	var output []string
	b, l, r := 0, 0, 0
	for {
		// The next base line both sides kept ends the chunk that differs.
		anchor := b
		for anchor < len(baseLines) && (inLocal[anchor] < 0 || inIncoming[anchor] < 0) {
			anchor++
		}
		localEnd, incomingEnd := len(localLines), len(incomingLines)
		if anchor < len(baseLines) {
			localEnd, incomingEnd = inLocal[anchor], inIncoming[anchor]
		}
		baseChunk := baseLines[b:anchor]
		localChunk := localLines[l:localEnd]
		incomingChunk := incomingLines[r:incomingEnd]
		switch {
		case sameLines(localChunk, baseChunk):
			output = append(output, incomingChunk...)
		case sameLines(incomingChunk, baseChunk), sameLines(localChunk, incomingChunk):
			output = append(output, localChunk...)
		default:
			hasConflicts = true
			output = append(output, conflictBlock(localChunk, incomingChunk, labels)...)
		}
		if anchor >= len(baseLines) {
			break
		}
		output = append(output, baseLines[anchor])
		b, l, r = anchor+1, localEnd+1, incomingEnd+1
	}
	return strings.Join(output, ""), hasConflicts
}

// Merge is the outcome of merging a newer version into a component's
// working copy.
type Merge struct {
	// Files are the working copy's files after the merge.
	Files Files
	// Updated lists files only the new version changed, which the working
	// copy now takes.
	Updated []string
	// Merged lists files both sides changed whose changes merged line by line.
	Merged []string
	// Conflicted lists files that now hold conflict markers.
	Conflicted []string
}

func sortedPaths(sets ...Files) []string {
	seen := map[string]bool{}
	var paths []string
	for _, files := range sets {
		for path := range files {
			if !seen[path] {
				seen[path] = true
				paths = append(paths, path)
			}
		}
	}
	sort.Strings(paths)
	return paths
}

// MergeFiles merges incoming (a newer catalog version) into local (the
// working copy), three ways against base, file by file: a file changed on
// one side only takes that side, a deletion included; a file changed on both
// merges line by line ([MergeText]); a file deleted on one side and changed
// on the other becomes a conflict block against an empty side. An empty base
// adopts identical files and conflicts on every other file both sides have.
func MergeFiles(base, local, incoming Files, labels MergeLabels) Merge {
	merge := Merge{Files: Files{}}
	for _, path := range sortedPaths(base, local, incoming) {
		baseText, hasBase := base[path]
		localText, hasLocal := local[path]
		incomingText, hasIncoming := incoming[path]
		localIsIncoming := hasLocal == hasIncoming && localText == incomingText
		incomingIsBase := hasIncoming == hasBase && incomingText == baseText
		localIsBase := hasLocal == hasBase && localText == baseText
		switch {
		case localIsIncoming || incomingIsBase:
			if hasLocal {
				merge.Files[path] = localText
			}
		case localIsBase:
			if hasIncoming {
				merge.Files[path] = incomingText
			}
			merge.Updated = append(merge.Updated, path)
		default:
			text, hasConflicts := MergeText(baseText, localText, incomingText, labels)
			// A deletion against a change conflicts even where the text would
			// merge: deleting the file is not a line change diff3 can apply.
			if deletedOnOneSide := !hasLocal || !hasIncoming; deletedOnOneSide && !hasConflicts {
				merge.Files[path] = strings.Join(conflictBlock(splitLines(localText), splitLines(incomingText), labels), "")
				merge.Conflicted = append(merge.Conflicted, path)
				continue
			}
			merge.Files[path] = text
			if hasConflicts {
				merge.Conflicted = append(merge.Conflicted, path)
			} else {
				merge.Merged = append(merge.Merged, path)
			}
		}
	}
	return merge
}

// SameFiles says whether two sets of files have the same paths with the
// same contents.
func SameFiles(a, b Files) bool {
	if len(a) != len(b) {
		return false
	}
	for path, content := range a {
		if other, ok := b[path]; !ok || other != content {
			return false
		}
	}
	return true
}

// FileChange says how a file of a component differs from its base: Kind is
// "new", "deleted" or "modified", and a modified file counts its lines.
type FileChange struct {
	Path    string
	Kind    string
	Added   int
	Removed int
}

// FileChanges lists the files that differ between base and current, in path
// order.
func FileChanges(base, current Files) []FileChange {
	changes := []FileChange{}
	for _, path := range sortedPaths(base, current) {
		before, hadBefore := base[path]
		after, hasAfter := current[path]
		switch {
		case !hadBefore:
			changes = append(changes, FileChange{Path: path, Kind: "new"})
		case !hasAfter:
			changes = append(changes, FileChange{Path: path, Kind: "deleted"})
		case before != after:
			added, removed := lineChanges(before, after)
			changes = append(changes, FileChange{Path: path, Kind: "modified", Added: added, Removed: removed})
		}
	}
	return changes
}

// Format writes a change as `src/lib.rs +12 −3`, `src/theme.rs new` or
// `src/old.rs deleted`.
func (c FileChange) Format() string {
	if c.Kind == "modified" {
		return fmt.Sprintf("%s +%d −%d", c.Path, c.Added, c.Removed)
	}
	return c.Path + " " + c.Kind
}
