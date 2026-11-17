package integrate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// Project is what a directory tells about the app in it.
type Project struct {
	Dir string
	// HasPackageJSON is true for a JavaScript project.
	HasPackageJSON bool
	// Dependencies are package.json's dependencies of every kind, by name.
	Dependencies map[string]string
	// Scripts are package.json's scripts.
	Scripts map[string]string
	// PackageManager is npm, pnpm, yarn or bun; empty outside JavaScript.
	PackageManager string
	// TypeScript is true when the project has a tsconfig.json.
	TypeScript bool
	// SourceDir is "src/" when the project keeps its code there, else "".
	SourceDir string
}

// Inspect reads the project in dir. A package.json that is not JSON is an
// error; everything else that is missing is just not there.
func Inspect(dir string) (Project, error) {
	project := Project{Dir: dir, Dependencies: map[string]string{}, Scripts: map[string]string{}}
	if info, err := os.Stat(filepath.Join(dir, "src")); err == nil && info.IsDir() {
		project.SourceDir = "src/"
	}
	if _, err := os.Stat(filepath.Join(dir, "tsconfig.json")); err == nil {
		project.TypeScript = true
	}
	data, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if os.IsNotExist(err) {
		return project, nil
	}
	if err != nil {
		return project, err
	}
	var manifest struct {
		Dependencies     map[string]string `json:"dependencies"`
		DevDependencies  map[string]string `json:"devDependencies"`
		PeerDependencies map[string]string `json:"peerDependencies"`
		Scripts          map[string]string `json:"scripts"`
		PackageManager   string            `json:"packageManager"`
	}
	if err := json.Unmarshal(data, &manifest); err != nil {
		return project, err
	}
	project.HasPackageJSON = true
	for _, group := range []map[string]string{manifest.PeerDependencies, manifest.DevDependencies, manifest.Dependencies} {
		for name, version := range group {
			project.Dependencies[name] = version
		}
	}
	if manifest.Scripts != nil {
		project.Scripts = manifest.Scripts
	}
	project.PackageManager = packageManager(dir, manifest.PackageManager)
	return project, nil
}

// lockfiles name the package manager that wrote them.
var lockfiles = []struct{ file, manager string }{
	{"pnpm-lock.yaml", "pnpm"},
	{"bun.lock", "bun"},
	{"bun.lockb", "bun"},
	{"yarn.lock", "yarn"},
	{"package-lock.json", "npm"},
}

// packageManager is the one the project installs with: the one package.json
// names, else the one whose lockfile is in dir or the nearest directory
// above it (a workspace keeps one lockfile at its root), else npm.
func packageManager(dir, declared string) string {
	if name, _, _ := strings.Cut(declared, "@"); name == "pnpm" || name == "yarn" || name == "bun" || name == "npm" {
		return name
	}
	for current := dir; ; current = filepath.Dir(current) {
		for _, lock := range lockfiles {
			if _, err := os.Stat(filepath.Join(current, lock.file)); err == nil {
				return lock.manager
			}
		}
		if filepath.Dir(current) == current {
			return "npm"
		}
	}
}

// matches reports whether the project is the platform's kind.
func (d Detection) matches(project Project) bool {
	has := func(name string) bool { _, ok := project.Dependencies[name]; return ok }
	for _, name := range d.Dependencies {
		if !has(name) {
			return false
		}
	}
	if len(d.AnyDependency) > 0 {
		found := false
		for _, name := range d.AnyDependency {
			found = found || has(name)
		}
		if !found {
			return false
		}
	}
	for _, name := range d.Without {
		if has(name) {
			return false
		}
	}
	for _, name := range d.Files {
		if _, err := os.Stat(filepath.Join(project.Dir, filepath.FromSlash(name))); err != nil {
			return false
		}
	}
	if len(d.Globs) > 0 {
		found := false
		for _, pattern := range d.Globs {
			matched, _ := filepath.Glob(filepath.Join(project.Dir, pattern))
			found = found || len(matched) > 0
		}
		if !found {
			return false
		}
	}
	// A description with no condition matches nothing rather than everything.
	return len(d.Dependencies)+len(d.AnyDependency)+len(d.Files)+len(d.Globs) > 0
}

// Detect lists the platforms the project could be, the likeliest first.
func Detect(project Project) []Platform {
	var found []Platform
	for _, platform := range Platforms() {
		if platform.Detect.matches(project) {
			found = append(found, platform)
		}
	}
	return found
}

// InstallCommand is the command that adds the packages with the project's
// package manager, or nil when there is nothing to add.
func InstallCommand(manager string, packages []Package) []string {
	if len(packages) == 0 {
		return nil
	}
	command := []string{manager, "add"}
	if manager == "npm" {
		command = []string{"npm", "install"}
	}
	for _, item := range packages {
		command = append(command, item.Name+"@"+item.Spec)
	}
	return command
}

// MissingPackages are the platform's packages to install: the ones the
// project does not list, and the ones it lists at a version the SDK does
// not support. The SDK itself, once listed, is the person's to upgrade, and
// so is a package the description says to keep.
func MissingPackages(platform Platform, project Project) []Package {
	var missing []Package
	for _, item := range platform.Packages {
		installed, listed := project.Dependencies[item.Name]
		if listed && (item.KeepInstalled || strings.HasPrefix(item.Name, "@voidhash/")) {
			continue
		}
		// "^0.37.1" is within "0.37", and "4.0.7" is "4.0.7".
		version := strings.TrimLeft(installed, "^~=")
		if listed && (version == item.Spec || strings.HasPrefix(version, item.Spec+".")) {
			continue
		}
		missing = append(missing, item)
	}
	return missing
}

// CheckCommands are the project's own checks for the platform: of each
// group of candidates, the first the project has.
func CheckCommands(platform Platform, project Project) [][]string {
	var commands [][]string
	for _, group := range platform.Checks {
		for _, candidate := range group {
			if script, ok := strings.CutPrefix(candidate, "script:"); ok {
				if _, has := project.Scripts[script]; has {
					commands = append(commands, []string{project.PackageManager, "run", script})
					break
				}
				continue
			}
			if candidate == "tsc" && project.TypeScript {
				if _, has := project.Dependencies["typescript"]; has {
					commands = append(commands, execCommand(project.PackageManager, "tsc", "--noEmit"))
					break
				}
			}
		}
	}
	return commands
}

// execCommand runs a program of the project's own node_modules.
func execCommand(manager string, program ...string) []string {
	switch manager {
	case "pnpm":
		return append([]string{"pnpm", "exec"}, program...)
	case "yarn":
		return append([]string{"yarn"}, program...)
	case "bun":
		return append([]string{"bunx"}, program...)
	default:
		return append([]string{"npx", "--no-install"}, program...)
	}
}

// skipped directories hold no code of the project's own.
var skipped = map[string]bool{
	"node_modules": true, ".git": true, "dist": true, "build": true, ".next": true, ".expo": true,
	"Pods": true, ".gradle": true, "DerivedData": true, ".voidhash": true, "vendor": true, ".build": true,
}

// FindMarker returns the first source file holding one of the platform's
// markers, which is where the SDK is wired in. except lists files that do
// not count, such as the ones the CLI wrote itself.
func FindMarker(platform Platform, dir string, except []string) (file string, found bool) {
	ignored := map[string]bool{}
	for _, name := range except {
		ignored[filepath.ToSlash(name)] = true
	}
	_ = filepath.WalkDir(dir, func(path string, entry os.DirEntry, err error) error {
		if err != nil || found {
			return filepath.SkipDir
		}
		if entry.IsDir() {
			if skipped[entry.Name()] && path != dir {
				return filepath.SkipDir
			}
			return nil
		}
		relative, _ := filepath.Rel(dir, path)
		relative = filepath.ToSlash(relative)
		if ignored[relative] || !hasExtension(entry.Name(), platform.Sources) {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		for _, marker := range platform.Markers {
			if strings.Contains(string(content), marker) {
				file, found = relative, true
				return filepath.SkipAll
			}
		}
		return nil
	})
	return file, found
}

func hasExtension(name string, extensions []string) bool {
	for _, extension := range extensions {
		if strings.HasSuffix(name, extension) {
			return true
		}
	}
	return false
}
