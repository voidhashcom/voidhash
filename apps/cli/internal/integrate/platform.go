// Package integrate is what `voidhash integrate` knows and decides without
// talking to anyone: the platforms it can set up, read from the descriptions
// in platforms/, what kind of project a directory holds, the task a coding
// agent is given, the agents that can be driven, and the record of a run.
package integrate

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"
)

//go:embed platforms
var platformFiles embed.FS

// Support levels of a platform.
const (
	// Supported platforms are run end to end before a release.
	Supported = "supported"
	// BestEffort platforms get the same steps with fewer of them checked.
	BestEffort = "best-effort"
)

// Kinds of key a platform's SDK starts with.
const (
	PublishableKey = "publishable"
	SecretKey      = "secret"
)

// Platform is one kind of project `voidhash integrate` sets up. Each is a
// JSON file in platforms/, so adding a platform is adding a description and,
// when its steps differ, a guide.
type Platform struct {
	ID string `json:"id"`
	// Order decides which platform wins when several match: lowest first.
	Order   int       `json:"order"`
	Name    string    `json:"name"`
	Support string    `json:"support"`
	Detect  Detection `json:"detect"`
	// Guide names the file in platforms/ with the agent's steps.
	Guide string `json:"guide"`
	// Docs is the public quickstart the guide follows.
	Docs string `json:"docs"`
	// SDK names the library, as people call it.
	SDK string `json:"sdk"`
	// Reference lists files in the project, once the SDK is installed, that
	// document the installed version's API.
	Reference []string `json:"reference"`
	// Key is the kind of key the SDK starts with.
	Key string `json:"key"`
	// Capabilities are what the SDK does on this platform: identify, perks,
	// purchases, paywalls, events, flags, webhooks.
	Capabilities []string `json:"capabilities"`
	// Types is the language of the generated slug types, or empty.
	Types string `json:"types"`
	// Packages are installed with the project's package manager.
	Packages []Package `json:"packages"`
	// Files are written when they do not exist yet.
	Files []File `json:"files"`
	// Env is the environment file and the values written to it.
	Env *Env `json:"env"`
	// Checks are the project's own checks to run before and after the
	// agent: of each group, the first candidate the project has. A candidate
	// is "script:<name>", a package.json script, or "tsc".
	Checks [][]string `json:"checks"`
	// Markers are texts one of which a source file holds once the SDK is
	// wired in.
	Markers []string `json:"markers"`
	// Sources are the extensions of the files searched for a marker.
	Sources []string `json:"sources"`
	// Run says how the person starts the app to send its first request.
	Run string `json:"run"`
	// LeftForYou is what stays with the person on this platform.
	LeftForYou []string `json:"leftForYou"`
}

// Detection says when a directory holds a platform's project. Every condition
// that is set must hold.
type Detection struct {
	// Dependencies must all be in package.json.
	Dependencies []string `json:"dependencies"`
	// AnyDependency needs one of them in package.json.
	AnyDependency []string `json:"anyDependency"`
	// Without rules the platform out when package.json has one of them.
	Without []string `json:"without"`
	// Files must all exist.
	Files []string `json:"files"`
	// Globs needs one pattern to match an entry of the directory.
	Globs []string `json:"globs"`
}

// Package is one package to install.
type Package struct {
	Name string `json:"name"`
	// Spec is the version, range or URL installed.
	Spec string `json:"spec"`
	// KeepInstalled leaves a version the project already has.
	KeepInstalled bool `json:"keepInstalled"`
}

// File is a file written into the project. Path and Content are templates
// over [Facts].
type File struct {
	// Role is how the guide refers to it, such as "client".
	Role    string `json:"role"`
	Path    string `json:"path"`
	Content string `json:"content"`
}

// Env is an environment file and what goes into it.
type Env struct {
	File   string     `json:"file"`
	Values []EnvValue `json:"values"`
}

// EnvValue is one variable. Value is a template over [Facts].
type EnvValue struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	// OnlyCustomAPI writes it only when the API is not the default one.
	OnlyCustomAPI bool `json:"onlyCustomAPI"`
	// Secret marks a value only the person has: the name is written with an
	// empty value for them to fill in.
	Secret bool `json:"secret"`
}

// Has reports whether the platform's SDK does something.
func (p Platform) Has(capability string) bool {
	for _, have := range p.Capabilities {
		if have == capability {
			return true
		}
	}
	return false
}

// Platforms reads every description, in detection order. They are part of
// the binary, so a description that cannot be read is a bug.
func Platforms() []Platform {
	entries, err := fs.ReadDir(platformFiles, "platforms")
	if err != nil {
		panic(err)
	}
	var platforms []Platform
	for _, entry := range entries {
		if path.Ext(entry.Name()) != ".json" {
			continue
		}
		data, err := platformFiles.ReadFile(path.Join("platforms", entry.Name()))
		if err != nil {
			panic(err)
		}
		var platform Platform
		decoder := json.NewDecoder(strings.NewReader(string(data)))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&platform); err != nil {
			panic(fmt.Sprintf("platforms/%s: %v", entry.Name(), err))
		}
		platforms = append(platforms, platform)
	}
	sort.Slice(platforms, func(i, j int) bool { return platforms[i].Order < platforms[j].Order })
	return platforms
}

// PlatformIDs lists the ids --platform takes.
func PlatformIDs() []string {
	var ids []string
	for _, platform := range Platforms() {
		ids = append(ids, platform.ID)
	}
	return ids
}

// FindPlatform is the platform with id.
func FindPlatform(id string) (Platform, bool) {
	for _, platform := range Platforms() {
		if platform.ID == id {
			return platform, true
		}
	}
	return Platform{}, false
}
