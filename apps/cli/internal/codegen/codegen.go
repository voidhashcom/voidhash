// Package codegen writes the type files `voidhash types generate` produces:
// the slugs of a project's products, paywall locations and perks, and what
// the app exchanges with the flow at each location, as types of the app's
// language, so a typo in a slug or a missing action handler fails to compile.
//
// Every language is an [Emitter] in its own file (typescript.go, swift.go,
// kotlin.go). All of them read the same [Schema] and write the same header
// lines, which is how `voidhash types check` tells a stale file in any
// language:
//
//	// @voidhash:version sha256:…
//	// @voidhash:fetched-at 2026-10-28T12:00:00.000Z
//
// To add a language, add a file with its emitter and list it in emitters.
package codegen

import (
	"encoding/json"
	"slices"
	"strings"
	"time"
	"unicode/utf16"
)

// Language names of the emitters.
const (
	TypeScript = "typescript"
	Swift      = "swift"
	Kotlin     = "kotlin"
)

// The header lines every generated file carries, whatever its language.
const (
	versionPrefix   = "// @voidhash:version "
	fetchedAtPrefix = "// @voidhash:fetched-at "
)

// Schema is what the type files are generated from: the slugs of a project,
// each list in ascending order without repeats (see [NewSchema]).
type Schema struct {
	// Products are the slugs of the project's products.
	Products []string
	// Locations are the slugs of the project's paywall locations.
	Locations []string
	// Perks are the slugs of the project's perks.
	Perks []string
	// Flows are what the app exchanges with the flow shown at each location
	// whose interface was ever set (see [Schema.WithFlows]).
	Flows []Flow
	// ProductTypes is the SDK product type of each product slug whose Studio
	// type the SDKs know (see [Schema.WithProductTypes]).
	ProductTypes map[string]string
	// Flags are the project's feature flags apps receive, by key (see
	// [Schema.WithFlags]).
	Flags []Flag
}

// Flag is a feature flag as the TypeScript declarations type it: its key,
// and the distinct text values of its variants. A flag whose variants hold
// no text (a boolean or number flag) has none.
type Flag struct {
	Key    string
	Values []string
}

// The SDK product types of the Studio product types: a subscription, a
// consumable, or a one-time product that is not consumed. A product of
// another type is left untyped.
var sdkProductTypes = map[string]string{
	"subscription":        "subscription",
	"one-time-consumable": "consumable",
	"one-time":            "nonConsumable",
}

// WithProductTypes adds the Studio type of each product slug.
func (schema Schema) WithProductTypes(studioTypes map[string]string) Schema {
	schema.ProductTypes = map[string]string{}
	for slug, studioType := range studioTypes {
		if sdkType, ok := sdkProductTypes[studioType]; ok {
			schema.ProductTypes[slug] = sdkType
		}
	}
	return schema
}

// WithFlags adds the project's flags, in any order, each with its values
// in any order.
func (schema Schema) WithFlags(flags []Flag) Schema {
	keys := make([]string, 0, len(flags))
	byKey := map[string][]string{}
	for _, flag := range flags {
		keys = append(keys, flag.Key)
		byKey[flag.Key] = append(byKey[flag.Key], flag.Values...)
	}
	schema.Flags = nil
	for _, key := range ordered(keys) {
		schema.Flags = append(schema.Flags, Flag{Key: key, Values: ordered(byKey[key])})
	}
	return schema
}

// WithFlows adds the interfaces of the project's locations. Locations still
// at revision 0 are left out: they exchange nothing.
func (schema Schema) WithFlows(flows []Flow) Schema {
	schema.Flows = withInterface(flows)
	return schema
}

// Companion is a second file an emitter writes beside its type file, for
// what the type file's format cannot hold.
type Companion struct {
	// Output is the path of the file, derived from the type file's.
	Output  string
	Content string
}

// WithCompanion is an emitter that may write a second file.
type WithCompanion interface {
	// Companion returns the file to write beside the type file; ok is false
	// when this schema needs none.
	Companion(schema Schema, options Options) (companion Companion, ok bool)
}

// NewSchema creates a schema from slugs in any order.
func NewSchema(products, locations, perks []string) Schema {
	return Schema{Products: ordered(products), Locations: ordered(locations), Perks: ordered(perks)}
}

// ordered sorts slugs the way JavaScript compares strings, by UTF-16 code
// unit, so the TypeScript file lists them as every earlier version did.
func ordered(slugs []string) []string {
	sorted := slices.Clone(slugs)
	slices.SortFunc(sorted, func(a, b string) int {
		return slices.Compare(utf16.Encode([]rune(a)), utf16.Encode([]rune(b)))
	})
	return slices.Compact(sorted)
}

// Options are the facts of one generated file besides the schema.
type Options struct {
	// Version is the schema's version as the server reports it.
	Version string
	// FetchedAt is when the schema was read.
	FetchedAt time.Time
	// Output is the path the file is written to. Emitters name the file in
	// its header and may derive declarations from it.
	Output string
	// Package is the package a Kotlin file declares; empty derives it from
	// Output.
	Package string
	// Packages are the SDK packages a TypeScript file augments
	// ([ReactNativePackage], [WebPackage]); empty augments the React Native
	// SDK's.
	Packages []string
}

// The SDK packages whose VoidhashRegister a TypeScript file augments.
const (
	ReactNativePackage = "@voidhash/react-native"
	WebPackage         = "@voidhash/web"
)

// SDKPackages are the Voidhash SDKs a package.json depends on, in the
// order the declaration file augments them. Augmenting a module the app
// does not install fails to compile, so only those are; an app depending
// on neither, or without a package.json (manifest nil), gets the React
// Native SDK's.
func SDKPackages(manifest []byte) []string {
	var dependencies struct {
		Dependencies     map[string]any `json:"dependencies"`
		DevDependencies  map[string]any `json:"devDependencies"`
		PeerDependencies map[string]any `json:"peerDependencies"`
	}
	// An unreadable manifest names no SDK, as a missing one does.
	_ = json.Unmarshal(manifest, &dependencies)
	var packages []string
	for _, name := range []string{ReactNativePackage, WebPackage} {
		_, direct := dependencies.Dependencies[name]
		_, dev := dependencies.DevDependencies[name]
		_, peer := dependencies.PeerDependencies[name]
		if direct || dev || peer {
			packages = append(packages, name)
		}
	}
	if len(packages) == 0 {
		return []string{ReactNativePackage}
	}
	return packages
}

// Emitter writes the type file of one language.
type Emitter interface {
	// Language is the emitter's name in voidhash.json: "swift".
	Language() string
	// Emit returns the content of the file.
	Emit(schema Schema, options Options) string
}

var emitters = []Emitter{typeScript{}, swift{}, kotlin{}}

// For finds the emitter of a language.
func For(language string) (Emitter, bool) {
	for _, emitter := range emitters {
		if emitter.Language() == language {
			return emitter, true
		}
	}
	return nil, false
}

// Languages lists the languages that have an emitter.
func Languages() []string {
	names := make([]string, len(emitters))
	for index, emitter := range emitters {
		names[index] = emitter.Language()
	}
	return names
}

// ReadVersion finds the schema version a generated file was made from. ok
// is false when the file carries none, as after a hand edit.
func ReadVersion(content string) (version string, ok bool) {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSuffix(line, "\r")
		if strings.HasPrefix(line, versionPrefix) {
			return strings.TrimSpace(line[len(versionPrefix):]), true
		}
	}
	return "", false
}

// IsGenerated reports whether content is a file this package wrote, which
// may be overwritten without asking.
func IsGenerated(content string) bool {
	_, ok := ReadVersion(content)
	return ok
}

// timestamp is t as JavaScript's toISOString writes it.
func timestamp(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

// markers are the header lines `types check` reads.
func markers(options Options) []string {
	return []string{versionPrefix + options.Version, fetchedAtPrefix + timestamp(options.FetchedAt)}
}
