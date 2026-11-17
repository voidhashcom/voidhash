// Package projectconfig reads and writes a directory's committed Voidhash
// configuration, which names the project an app is built for and the type
// files generated for it.
//
// The configuration is voidhash.json:
//
//	{
//	  "team": "acme",
//	  "project": "app",
//	  "types": [
//	    { "language": "typescript", "output": "voidhash.gen.d.ts" },
//	    { "language": "swift", "output": "App/VoidhashTypes.swift" }
//	  ]
//	}
//
// voidhash.schema.json, at the root of the CLI's source, describes it for
// editors. A directory set up by an earlier version of the CLI holds a
// voidhash.config.ts (or .js, .cjs, .mjs) instead; it is still read, without
// running it (see legacy.go).
package projectconfig

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
)

// FileName is the configuration file of a directory.
const FileName = "voidhash.json"

// DefaultTypesOutput is where the TypeScript declarations go when the
// configuration names no type files.
const DefaultTypesOutput = "voidhash.gen.d.ts"

// The languages type files are generated in.
const (
	TypeScript = "typescript"
	Swift      = "swift"
	Kotlin     = "kotlin"
)

// Languages lists the languages a "types" entry can name.
var Languages = []string{TypeScript, Swift, Kotlin}

// TypeTarget is one generated type file.
type TypeTarget struct {
	// Language is the language of the file: one of [Languages].
	Language string `json:"language"`
	// Output is the file's path, relative to the configuration's directory.
	Output string `json:"output"`
	// Package is the package a Kotlin file declares. Optional: without it
	// the package follows from the path below a java or kotlin source
	// directory.
	Package string `json:"package,omitempty"`
}

// Config is a directory's configuration.
type Config struct {
	// Team is the slug of the organization that owns the project.
	Team string `json:"team"`
	// Project is the project's slug.
	Project string `json:"project"`
	// Types lists the type files to generate. Empty means one TypeScript
	// declaration file, at TypesOutput or [DefaultTypesOutput].
	Types []TypeTarget `json:"types,omitempty"`
	// TypesOutput is the earlier way to move the TypeScript declarations.
	TypesOutput string `json:"typesOutput,omitempty"`
	// Path is the file the configuration was read from.
	Path string `json:"-"`
	// Warnings are problems that do not stop the configuration from being
	// used, for the command to show on standard error.
	Warnings []string `json:"-"`
}

// FileBase is the name of the file the configuration was read from, as
// messages call it.
func (c *Config) FileBase() string {
	if c.Path == "" {
		return FileName
	}
	return filepath.Base(c.Path)
}

// IsLegacy reports whether the configuration came from a voidhash.config.*
// file of an earlier version of the CLI.
func (c *Config) IsLegacy() bool {
	return c.Path != "" && filepath.Base(c.Path) != FileName
}

// TypeTargets lists the type files to generate: the "types" entries, or the
// single TypeScript declaration file when there are none.
func (c *Config) TypeTargets() []TypeTarget {
	if len(c.Types) > 0 {
		return slices.Clone(c.Types)
	}
	output := c.TypesOutput
	if output == "" {
		output = DefaultTypesOutput
	}
	return []TypeTarget{{Language: TypeScript, Output: output}}
}

// Loader reads the configuration of dir. found is false when dir has none.
type Loader func(dir string) (config *Config, found bool, err error)

// LoadDirectoryConfig reads the configuration of dir: its voidhash.json,
// else the voidhash.config.* an earlier version of the CLI wrote. When both
// exist voidhash.json is used, with a warning if they name different
// projects.
func LoadDirectoryConfig(dir string) (*Config, bool, error) {
	path := filepath.Join(dir, FileName)
	data, err := os.ReadFile(path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return loadLegacy(dir)
	case err != nil:
		return nil, false, fmt.Errorf("could not read %s: %w", path, err)
	}
	config, err := Parse(data)
	if err != nil {
		return nil, false, fmt.Errorf("%s %w", path, err)
	}
	config.Path = path

	if legacyPath, ok := legacyFile(dir); ok {
		// An unreadable legacy file is no problem here: voidhash.json decides.
		if legacy, err := readLegacy(legacyPath); err == nil && (legacy.Team != config.Team || legacy.Project != config.Project) {
			config.Warnings = append(config.Warnings, fmt.Sprintf(
				"%s names the project %s/%s but %s names %s/%s. %s is used; delete %s.",
				FileName, config.Team, config.Project,
				filepath.Base(legacyPath), legacy.Team, legacy.Project,
				FileName, filepath.Base(legacyPath)))
		}
	}
	return config, true, nil
}

// Parse reads the text of a voidhash.json. Its errors continue a sentence
// that starts with the file's name: "is not valid JSON: …".
func Parse(data []byte) (*Config, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		if fields == nil && json.Valid(data) {
			return nil, errors.New(`must hold a JSON object like {"team": "acme", "project": "app"}`)
		}
		return nil, fmt.Errorf("is not valid JSON: %s", jsonProblem(data, err))
	}
	if fields == nil {
		return nil, errors.New(`must hold a JSON object like {"team": "acme", "project": "app"}`)
	}

	known := []string{"$schema", "team", "project", "types", "typesOutput"}
	for _, key := range sortedKeys(fields) {
		if !slices.Contains(known, key) {
			return nil, fmt.Errorf("has the unknown key %q: the keys are \"team\", \"project\", \"types\" and \"typesOutput\"", key)
		}
	}

	config := &Config{}
	var err error
	if config.Team, err = requiredString(fields, "team", "the slug of the organization that owns the project"); err != nil {
		return nil, err
	}
	if config.Project, err = requiredString(fields, "project", "the project's slug"); err != nil {
		return nil, err
	}
	if raw, ok := fields["typesOutput"]; ok {
		if err := json.Unmarshal(raw, &config.TypesOutput); err != nil || strings.TrimSpace(config.TypesOutput) == "" {
			return nil, errors.New(`has a "typesOutput" that is not a file path: write it as text, such as "voidhash.gen.d.ts", or remove it`)
		}
	}
	if raw, ok := fields["types"]; ok {
		if config.Types, err = parseTypes(raw); err != nil {
			return nil, err
		}
		if config.TypesOutput != "" && len(config.Types) > 0 {
			return nil, errors.New(`has both "types" and "typesOutput": remove "typesOutput" and name the file in a "types" entry instead`)
		}
	}
	return config, nil
}

func parseTypes(raw json.RawMessage) ([]TypeTarget, error) {
	var entries []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &entries); err != nil || (entries == nil && string(bytes.TrimSpace(raw)) != "[]") {
		return nil, errors.New(`has a "types" that is not a list: write it as [{"language": "typescript", "output": "voidhash.gen.d.ts"}]`)
	}
	targets := make([]TypeTarget, 0, len(entries))
	outputs := map[string]int{}
	for index, entry := range entries {
		where := fmt.Sprintf(`"types" entry %d`, index+1)
		if entry == nil {
			return nil, fmt.Errorf(`has a %s that is not an object: write it as {"language": "swift", "output": "<path>"}`, where)
		}
		for _, key := range sortedKeys(entry) {
			if key != "language" && key != "output" && key != "package" {
				return nil, fmt.Errorf(`has the unknown key %q in %s: an entry has "language", "output" and, for kotlin, "package"`, key, where)
			}
		}
		var target TypeTarget
		if err := json.Unmarshal(entry["language"], &target.Language); err != nil || !slices.Contains(Languages, target.Language) {
			return nil, fmt.Errorf(`has a %s without a known "language": use "typescript", "swift" or "kotlin"`, where)
		}
		if err := json.Unmarshal(entry["output"], &target.Output); err != nil || strings.TrimSpace(target.Output) == "" {
			return nil, fmt.Errorf(`has a %s without an "output": add the path of the %s file to generate`, where, target.Language)
		}
		if rawPackage, ok := entry["package"]; ok {
			if err := json.Unmarshal(rawPackage, &target.Package); err != nil || !isPackageName(target.Package) {
				return nil, fmt.Errorf(`has a %s whose "package" is not a package name like "com.example.app"`, where)
			}
			if target.Language != Kotlin {
				return nil, fmt.Errorf(`has a %s with a "package", which only kotlin files declare: remove it`, where)
			}
		}
		clean := filepath.Clean(target.Output)
		if earlier, ok := outputs[clean]; ok {
			return nil, fmt.Errorf(`has "types" entries %d and %d writing the same file %s: give each its own "output"`, earlier, index+1, target.Output)
		}
		outputs[clean] = index + 1
		targets = append(targets, target)
	}
	return targets, nil
}

func requiredString(fields map[string]json.RawMessage, key, what string) (string, error) {
	raw, ok := fields[key]
	if !ok {
		return "", fmt.Errorf("has no %q: add %s", key, what)
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", fmt.Errorf("has a %q that is not text: write %s in quotes", key, what)
	}
	if strings.TrimSpace(value) == "" {
		return "", fmt.Errorf("has an empty %q: write %s", key, what)
	}
	return value, nil
}

// isPackageName reports whether name is dot-separated identifiers.
func isPackageName(name string) bool {
	if name == "" {
		return false
	}
	for _, part := range strings.Split(name, ".") {
		if part == "" {
			return false
		}
		for index, char := range part {
			letter := char == '_' || (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
			if !letter && (index == 0 || char < '0' || char > '9') {
				return false
			}
		}
	}
	return true
}

func sortedKeys[V any](fields map[string]V) []string {
	keys := make([]string, 0, len(fields))
	for key := range fields {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// jsonProblem says where JSON text stops being valid, by line.
func jsonProblem(data []byte, err error) string {
	var syntax *json.SyntaxError
	if errors.As(err, &syntax) {
		offset := int(syntax.Offset)
		if offset > len(data) {
			offset = len(data)
		}
		return fmt.Sprintf("line %d: %s", 1+bytes.Count(data[:offset], []byte("\n")), syntax.Error())
	}
	return err.Error()
}

// Encode is the text of the voidhash.json holding config: two-space
// indented, ending with a line break.
func Encode(config *Config) []byte {
	// The fields hold only text, which always encodes.
	data, _ := json.MarshalIndent(config, "", "  ")
	return append(data, '\n')
}

// Write stores config as dir's voidhash.json and returns the file's path.
func Write(dir string, config *Config) (string, error) {
	path := filepath.Join(dir, FileName)
	if err := os.WriteFile(path, Encode(config), 0o644); err != nil {
		return "", err
	}
	return path, nil
}
