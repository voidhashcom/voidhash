// Package wasmtest builds small valid WebAssembly modules shaped like
// component and panel modules, for tests of the code that checks, stores and
// serves them. Not for production code.
package wasmtest

import (
	"encoding/json"
	"fmt"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/wasm"
)

// Signature is a function signature: parameter and result value types.
type Signature struct {
	Params  []byte
	Results []byte
}

// NamedFunction is an exported function.
type NamedFunction struct {
	Name      string
	Signature Signature
}

// ImportedFunction is an imported function.
type ImportedFunction struct {
	Module    string
	Name      string
	Signature Signature
}

// Section is a custom section.
type Section struct {
	Name    string
	Payload []byte
}

const (
	i32 = wasm.I32
	i64 = wasm.I64
)

// PanelExports returns the exports of a panel module, with the panel ABI's
// signatures.
func PanelExports() []NamedFunction {
	return []NamedFunction{
		{"vhp_abi_version", Signature{nil, []byte{i32}}},
		{"vhp_alloc", Signature{[]byte{i32}, []byte{i32}}},
		{"vhp_mount", Signature{[]byte{i32, i32, i32}, []byte{i32}}},
		{"vhp_update", Signature{[]byte{i32, i32, i32}, nil}},
		{"vhp_render", Signature{[]byte{i32}, []byte{i64}}},
		{"vhp_event", Signature{[]byte{i32, i32, i32, i32}, []byte{i64}}},
		{"vhp_unmount", Signature{[]byte{i32}, nil}},
	}
}

// Options shapes a test module. The zero value is a panel module without a
// `vhp.panels` section.
type Options struct {
	// Panels is the `vhp.panels` manifest: a value to encode as JSON, raw
	// text (a string), or nil for none.
	Panels any
	// Imports are the imported functions; nil means the panel ABI's `vhp.log`.
	Imports []ImportedFunction
	// Exports are the exported functions; nil means every `vhp_*` function.
	Exports []NamedFunction
	// NoMemoryExport leaves the memory unexported.
	NoMemoryExport bool
	// Start adds a start function.
	Start bool
	// CustomSections are further custom sections.
	CustomSections []Section
}

// M is a JSON object.
type M = map[string]any

// PanelEntry is a panel entry for definition, as `#[panel(for = definition)]`
// writes it, with overrides applied.
func PanelEntry(definition string, overrides M) M {
	entry := M{
		"id":              "settings",
		"title":           "Settings",
		"tab":             "design",
		"appliesTo":       []any{M{"definition": definition}},
		"order":           100,
		"multiSelectable": false,
		"scope":           "instance",
		"style":           []any{},
	}
	for key, value := range overrides {
		entry[key] = value
	}
	return entry
}

func leb(value int) []byte {
	var out []byte
	rest := uint32(value)
	for {
		b := byte(rest & 0x7f)
		rest >>= 7
		if rest != 0 {
			b |= 0x80
		}
		out = append(out, b)
		if rest == 0 {
			return out
		}
	}
}

func text(value string) []byte {
	return append(leb(len(value)), value...)
}

func section(id byte, payload []byte) []byte {
	return append(append([]byte{id}, leb(len(payload))...), payload...)
}

func vector(items [][]byte) []byte {
	out := leb(len(items))
	for _, item := range items {
		out = append(out, item...)
	}
	return out
}

// body returns zeros of the signature's result types.
func body(signature Signature) []byte {
	code := []byte{0x00}
	for _, result := range signature.Results {
		if result == i64 {
			code = append(code, 0x42, 0x00)
		} else {
			code = append(code, 0x41, 0x00)
		}
	}
	code = append(code, 0x0b)
	return append(leb(len(code)), code...)
}

// Module builds a valid module with a panel module's imports, exports and
// `vhp.panels` section (each function returns zeros), or a deliberately
// wrong variant of one.
func Module(options Options) []byte {
	imports := options.Imports
	if imports == nil {
		imports = []ImportedFunction{{Module: "vhp", Name: "log", Signature: Signature{[]byte{i32, i32, i32}, nil}}}
	}
	exports := options.Exports
	if exports == nil {
		exports = PanelExports()
	}
	var functions []Signature
	for _, export := range exports {
		functions = append(functions, export.Signature)
	}
	if options.Start {
		functions = append(functions, Signature{})
	}

	var signatures []Signature
	typeIndex := func(signature Signature) int {
		key := fmt.Sprint(signature.Params, "->", signature.Results)
		for index, candidate := range signatures {
			if fmt.Sprint(candidate.Params, "->", candidate.Results) == key {
				return index
			}
		}
		signatures = append(signatures, signature)
		return len(signatures) - 1
	}
	var importEntries, functionTypes, typeEntries, exportEntries, bodies [][]byte
	for _, entry := range imports {
		item := append(text(entry.Module), text(entry.Name)...)
		item = append(item, 0x00)
		importEntries = append(importEntries, append(item, leb(typeIndex(entry.Signature))...))
	}
	for _, signature := range functions {
		functionTypes = append(functionTypes, leb(typeIndex(signature)))
		bodies = append(bodies, body(signature))
	}
	for _, signature := range signatures {
		item := append([]byte{0x60}, leb(len(signature.Params))...)
		item = append(item, signature.Params...)
		item = append(item, leb(len(signature.Results))...)
		typeEntries = append(typeEntries, append(item, signature.Results...))
	}
	if !options.NoMemoryExport {
		exportEntries = append(exportEntries, append(text("memory"), 0x02, 0x00))
	}
	for index, export := range exports {
		item := append(text(export.Name), 0x00)
		exportEntries = append(exportEntries, append(item, leb(len(imports)+index)...))
	}

	var custom []Section
	switch panels := options.Panels.(type) {
	case nil:
	case string:
		custom = append(custom, Section{Name: "vhp.panels", Payload: []byte(panels)})
	default:
		encoded, err := json.Marshal(panels)
		if err != nil {
			panic(err)
		}
		custom = append(custom, Section{Name: "vhp.panels", Payload: encoded})
	}
	custom = append(custom, options.CustomSections...)

	out := []byte{0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00}
	out = append(out, section(1, vector(typeEntries))...)
	out = append(out, section(2, vector(importEntries))...)
	out = append(out, section(3, vector(functionTypes))...)
	out = append(out, section(5, vector([][]byte{{0x00, 0x01}}))...)
	out = append(out, section(7, vector(exportEntries))...)
	if options.Start {
		out = append(out, section(8, leb(len(imports)+len(exports)))...)
	}
	out = append(out, section(10, vector(bodies))...)
	for _, entry := range custom {
		out = append(out, section(0, append(text(entry.Name), entry.Payload...))...)
	}
	return out
}

// ComponentModule builds a module whose `vh.manifest` section holds
// manifest, encoded as JSON (or as it is, for a string).
func ComponentModule(manifest any) []byte {
	payload, isText := manifest.(string)
	if !isText {
		encoded, err := json.Marshal(manifest)
		if err != nil {
			panic(err)
		}
		payload = string(encoded)
	}
	return Module(Options{CustomSections: []Section{{Name: "vh.manifest", Payload: []byte(payload)}}})
}
