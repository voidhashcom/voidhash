package crate

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var packageNamePattern = regexp.MustCompile(`^name\s*=\s*(?:"([^"]*)"|'([^']*)')`)

// PackageName reads the name of the [package] table from a Cargo.toml. Only
// the flat `name = "..."` form is recognised, which is what `cargo new`
// writes; it is empty for anything else.
func PackageName(cargoToml string) string {
	inPackage := false
	for _, line := range regexp.MustCompile(`\r?\n`).Split(cargoToml, -1) {
		line = strings.TrimSpace(line)
		if !inPackage {
			inPackage = line == "[package]"
			continue
		}
		if strings.HasPrefix(line, "[") {
			return ""
		}
		if match := packageNamePattern.FindStringSubmatch(line); match != nil && match[1]+match[2] != "" {
			return match[1] + match[2]
		}
	}
	return ""
}

// SourcePaths selects the Rust modules to upload from a recursive listing of
// a crate's src/ directory (entries relative to src/, "/"-separated). It
// returns the crate-relative paths (src/...) in a stable order, skipping
// build output.
func SourcePaths(srcEntries []string) []string {
	paths := []string{}
	for _, entry := range srcEntries {
		if !strings.HasSuffix(entry, ".rs") {
			continue
		}
		inTarget := false
		for _, segment := range strings.Split(entry, "/") {
			inTarget = inTarget || segment == "target"
		}
		if !inTarget {
			paths = append(paths, "src/"+entry)
		}
	}
	sort.Strings(paths)
	return paths
}

// ReadSource reads a component crate's source from disk: every .rs module
// under src/ and the Cargo.toml, when there are, keyed by crate-relative
// path (src/..., "/"-separated).
func ReadSource(directory string) (map[string]string, error) {
	files := map[string]string{}
	src := filepath.Join(directory, "src")
	var entries []string
	err := filepath.WalkDir(src, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			if path == src && errors.Is(err, fs.ErrNotExist) {
				return filepath.SkipAll
			}
			return err
		}
		if relative, err := filepath.Rel(src, path); err == nil && relative != "." {
			entries = append(entries, filepath.ToSlash(relative))
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	for _, relative := range SourcePaths(entries) {
		content, err := os.ReadFile(filepath.Join(directory, filepath.FromSlash(relative)))
		if err != nil {
			return nil, err
		}
		files[relative] = text(content)
	}
	cargoToml, err := os.ReadFile(filepath.Join(directory, "Cargo.toml"))
	switch {
	case err == nil:
		files["Cargo.toml"] = text(cargoToml)
	case !errors.Is(err, fs.ErrNotExist):
		return nil, err
	}
	return files, nil
}

// text reads file content as text: bytes that are not UTF-8 become the
// replacement character, as they do in the JSON the files travel in.
func text(content []byte) string {
	return strings.ToValidUTF8(string(content), "�")
}
