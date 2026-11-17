package dev

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// pollInterval is how often the working copy is looked at for changes.
// Looking is a walk of a few small crates, and needs no file watcher of the
// operating system, whose limits and recursion differ by platform.
const pollInterval = 250 * time.Millisecond

type fileStamp struct {
	modified time.Time
	size     int64
	isDir    bool
}

// snapshot records every file and directory under the components directory
// by its path, outside build output: the `target` directory of a crate.
// Entries whose name starts with a dot are not components.
func snapshot(componentsDirectory string) map[string]fileStamp {
	stamps := map[string]fileStamp{}
	entries, err := os.ReadDir(componentsDirectory)
	if err != nil {
		return stamps
	}
	for _, entry := range entries {
		slug := entry.Name()
		if strings.HasPrefix(slug, ".") {
			continue
		}
		root := filepath.Join(componentsDirectory, slug)
		_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				// A file that went away while walking is seen as gone.
				return nil
			}
			if entry.IsDir() && path == filepath.Join(root, "target") {
				return filepath.SkipDir
			}
			info, err := entry.Info()
			if err != nil {
				return nil
			}
			relative, _ := filepath.Rel(componentsDirectory, path)
			stamp := fileStamp{isDir: info.IsDir()}
			if !info.IsDir() {
				stamp.modified, stamp.size = info.ModTime(), info.Size()
			}
			stamps[relative] = stamp
			return nil
		})
	}
	return stamps
}

// changedSlugs names the components whose files differ between two
// snapshots, in order.
func changedSlugs(before, after map[string]fileStamp) []string {
	changed := map[string]bool{}
	mark := func(path string) {
		slug, _, _ := strings.Cut(path, string(filepath.Separator))
		changed[slug] = true
	}
	for path, stamp := range after {
		if previous, known := before[path]; !known || previous != stamp {
			mark(path)
		}
	}
	for path := range before {
		if _, kept := after[path]; !kept {
			mark(path)
		}
	}
	slugs := make([]string, 0, len(changed))
	for slug := range changed {
		slugs = append(slugs, slug)
	}
	sort.Strings(slugs)
	return slugs
}

// watch reports the components whose files change under the components
// directory, until ctx ends. start is the state changes are measured from.
func watch(ctx context.Context, componentsDirectory string, start map[string]fileStamp, changes chan<- []string) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()
	before := start
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		after := snapshot(componentsDirectory)
		if slugs := changedSlugs(before, after); len(slugs) > 0 {
			select {
			case changes <- slugs:
			case <-ctx.Done():
				return
			}
		}
		before = after
	}
}
