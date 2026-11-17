package definition

import (
	"encoding/json"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/wasm"
)

// MaxPanelModuleBytes is the largest component panel module, in bytes.
const MaxPanelModuleBytes = 512 * 1024

// MaxComponentPanels is the most panels one component's module may export.
const MaxComponentPanels = 8

// PanelManifestEntry is one `vhp.panels` entry, as the panel ABI specifies
// it. AppliesTo, Document and Context keep the JSON the module wrote.
type PanelManifestEntry struct {
	ID              string          `json:"id"`
	Title           string          `json:"title"`
	Tab             string          `json:"tab"`
	AppliesTo       json.RawMessage `json:"appliesTo"`
	Order           float64         `json:"order"`
	MultiSelectable bool            `json:"multiSelectable"`
	Scope           string          `json:"scope"`
	Style           []string        `json:"style"`
	// Document and Context are nil when the entry does not have the key.
	Document []string `json:"document,omitempty"`
	Context  []string `json:"context,omitempty"`

	// appliesToAny and definitions are AppliesTo, read: "any", or the
	// definition each requirement names ("" for a trait requirement).
	appliesToAny bool
	definitions  []string
	hasDocument  bool
	hasContext   bool
}

// MarshalJSON writes the entry as the module declared it.
func (e PanelManifestEntry) MarshalJSON() ([]byte, error) {
	fields := []field{
		{"id", e.ID}, {"title", e.Title}, {"tab", e.Tab}, {"appliesTo", e.AppliesTo}, {"order", e.Order},
		{"multiSelectable", e.MultiSelectable}, {"scope", e.Scope}, {"style", emptyIfNil(e.Style)},
	}
	if e.hasDocument {
		fields = append(fields, field{"document", emptyIfNil(e.Document)})
	}
	if e.hasContext {
		fields = append(fields, field{"context", emptyIfNil(e.Context)})
	}
	return marshalFields(fields)
}

type signature struct {
	params, results []byte
}

type namedSignature struct {
	name string
	signature
}

// panelExports are the functions a panel module exports (panel ABI, "Exports").
var panelExports = []namedSignature{
	{"vhp_abi_version", signature{nil, []byte{wasm.I32}}},
	{"vhp_alloc", signature{[]byte{wasm.I32}, []byte{wasm.I32}}},
	{"vhp_mount", signature{[]byte{wasm.I32, wasm.I32, wasm.I32}, []byte{wasm.I32}}},
	{"vhp_update", signature{[]byte{wasm.I32, wasm.I32, wasm.I32}, nil}},
	{"vhp_render", signature{[]byte{wasm.I32}, []byte{wasm.I64}}},
	{"vhp_event", signature{[]byte{wasm.I32, wasm.I32, wasm.I32, wasm.I32}, []byte{wasm.I64}}},
	{"vhp_unmount", signature{[]byte{wasm.I32}, nil}},
}

// panelImports are the functions a panel module may import from `vhp`.
var panelImports = []namedSignature{
	{"log", signature{[]byte{wasm.I32, wasm.I32, wasm.I32}, nil}},
}

var contextGroups = map[string]bool{"layout": true, "definition": true, "bindableVariables": true}

func describeSignature(params, results []byte) string {
	names := func(types []byte) string {
		parts := make([]string, len(types))
		for index, valueType := range types {
			switch valueType {
			case wasm.I32:
				parts[index] = "i32"
			case wasm.I64:
				parts[index] = "i64"
			case wasm.F32:
				parts[index] = "f32"
			case wasm.F64:
				parts[index] = "f64"
			default:
				parts[index] = fmt.Sprintf("0x%x", valueType)
			}
		}
		return strings.Join(parts, ", ")
	}
	return fmt.Sprintf("(%s) -> (%s)", names(params), names(results))
}

// decodePanels reads the `vhp.panels` JSON; the error says what is not a
// panel manifest.
func decodePanels(value any) ([]PanelManifestEntry, error) {
	d := &decoder{}
	const at = path("")
	items := d.array(value, at)
	panels := make([]PanelManifestEntry, len(items))
	for index, item := range items {
		at := at.index(index)
		object, ok := d.object(item, at)
		if !ok {
			continue
		}
		plainStrings := func(value any, at path) []string { return d.strings(value, at, d.string) }
		entry := PanelManifestEntry{
			ID:    requiredField(d, object, "id", at, d.string),
			Title: requiredField(d, object, "title", at, d.string),
			Tab: requiredField(d, object, "tab", at, func(value any, at path) string {
				return d.literal(value, at, "design", "interaction")
			}),
			Order:           requiredField(d, object, "order", at, d.number),
			MultiSelectable: requiredField(d, object, "multiSelectable", at, d.boolean),
			Scope: requiredField(d, object, "scope", at, func(value any, at path) string {
				return d.literal(value, at, "instance", "node-style", "document")
			}),
			Style: requiredField(d, object, "style", at, plainStrings),
		}
		// An absent key and an explicit undefined cannot be told apart in
		// JSON, so a present key is always a value.
		if document := optionalField(object, "document", at, plainStrings); document != nil {
			entry.Document, entry.hasDocument = *document, true
		}
		if context := optionalField(object, "context", at, plainStrings); context != nil {
			entry.Context, entry.hasContext = *context, true
		}
		appliesTo, ok := d.required(object, "appliesTo", at)
		if ok {
			at := at.key("appliesTo")
			requirements, isList := appliesTo.([]any)
			switch {
			case appliesTo == "any":
				entry.appliesToAny = true
				entry.AppliesTo = json.RawMessage(`"any"`)
			case isList:
				kept := make([]map[string]string, len(requirements))
				for index, requirement := range requirements {
					at := at.index(index)
					object, _ := requirement.(map[string]any)
					definition, isDefinition := object["definition"].(string)
					trait, isTrait := object["trait"].(string)
					switch {
					case isDefinition:
						entry.definitions = append(entry.definitions, definition)
						kept[index] = map[string]string{"definition": definition}
					case isTrait:
						entry.definitions = append(entry.definitions, "")
						kept[index] = map[string]string{"trait": trait}
					default:
						d.fail(at, `Expected { "definition": string } | { "trait": string }, got %s`, describe(requirement))
					}
				}
				entry.AppliesTo, _ = json.Marshal(kept)
			default:
				d.fail(at, `Expected "any" | an array, got %s`, describe(appliesTo))
			}
		}
		panels[index] = entry
	}
	if len(d.problems) > 0 {
		return nil, fmt.Errorf("%s", strings.Join(d.problems, "; "))
	}
	return panels, nil
}

// ValidatePanelModule checks that module is the editor panel module of the
// component definition describes, and returns its `vhp.panels` manifest.
// Every problem is reported at once:
//
//   - the module is at most [MaxPanelModuleBytes], a version 1 WebAssembly
//     binary without a start function;
//   - it imports nothing but the `vhp` functions of the panel ABI and exports
//     its memory and every `vhp_*` function with the ABI's signature;
//   - it has exactly one `vhp.panels` section, a JSON array of one to
//     [MaxComponentPanels] panels with unique ids;
//   - every panel applies to exactly the component's definition id with the
//     instance scope, reads no document data, asks only for known context
//     groups and declares only style keys of the traits the definition
//     declares;
//   - the definition declares a panel.
//
// The server makes the same checks when the component is published, and
// also validates the module's code, which this does not.
func ValidatePanelModule(module []byte, definition *Definition) ([]PanelManifestEntry, []string) {
	if len(module) == 0 {
		return nil, []string{"panel.wasm is empty."}
	}
	if len(module) > MaxPanelModuleBytes {
		return nil, []string{fmt.Sprintf("panel.wasm is %d bytes; the limit is %d bytes. Build it with the release profile.", len(module), MaxPanelModuleBytes)}
	}
	read, err := wasm.Read(module)
	if err != nil {
		return nil, []string{"panel.wasm: " + err.Error()}
	}
	var problems []string
	if !definition.Panel {
		problems = append(problems, fmt.Sprintf("The component %s does not declare a panel, so it cannot ship panel.wasm; list its panels with voidhash_ui::export_panels!.", definition.ID))
	}
	if read.HasStart {
		problems = append(problems, "panel.wasm must not have a start function.")
	}
	problems = append(problems, interfaceProblems(read)...)

	var sections []wasm.CustomSection
	for _, section := range read.CustomSections {
		if section.Name == "vhp.panels" {
			sections = append(sections, section)
		}
	}
	if len(sections) == 0 {
		return nil, append(problems, "panel.wasm has no vhp.panels section; list the panels with voidhash_ui::export_panels!.")
	}
	if len(sections) > 1 {
		return nil, append(problems, "panel.wasm has more than one vhp.panels section.")
	}
	var value any
	if !utf8.Valid(sections[0].Payload) || json.Unmarshal(sections[0].Payload, &value) != nil {
		return nil, append(problems, "The vhp.panels section is not UTF-8 JSON.")
	}
	panels, err := decodePanels(value)
	if err != nil {
		return nil, append(problems, "The vhp.panels section is not a panel manifest: "+err.Error())
	}
	problems = append(problems, manifestProblems(panels, definition)...)
	if len(problems) > 0 {
		return nil, problems
	}
	return panels, nil
}

func sameTypes(a, b []byte) bool { return string(a) == string(b) }

func interfaceProblems(module *wasm.Module) []string {
	var problems []string
	allowedNames := make([]string, len(panelImports))
	for index, allowed := range panelImports {
		allowedNames[index] = "vhp." + allowed.name
	}
	for _, entry := range module.Imports {
		var allowed *namedSignature
		if entry.Module == "vhp" {
			for index := range panelImports {
				if panelImports[index].name == entry.Name {
					allowed = &panelImports[index]
				}
			}
		}
		if allowed == nil || entry.Kind != wasm.Function {
			problems = append(problems, fmt.Sprintf("panel.wasm imports %s.%s; a panel may only import the panel ABI's vhp functions (%s).", entry.Module, entry.Name, strings.Join(allowedNames, ", ")))
			continue
		}
		if entry.Type < 0 || entry.Type >= len(module.Types) ||
			!sameTypes(module.Types[entry.Type].Params, allowed.params) ||
			!sameTypes(module.Types[entry.Type].Results, allowed.results) {
			problems = append(problems, fmt.Sprintf("panel.wasm imports vhp.%s with the wrong signature; it is %s.", entry.Name, describeSignature(allowed.params, allowed.results)))
		}
	}
	exportsMemory := false
	for _, entry := range module.Exports {
		if entry.Name == "memory" {
			// The first export of a name is the one a lookup finds.
			exportsMemory = entry.Kind == wasm.Memory
			break
		}
	}
	if !exportsMemory {
		problems = append(problems, "panel.wasm must export its memory as `memory`.")
	}
	for _, expected := range panelExports {
		found, ok := module.ExportedFunctionType(expected.name)
		if !ok {
			problems = append(problems, fmt.Sprintf("panel.wasm does not export the function %s.", expected.name))
		} else if !sameTypes(found.Params, expected.params) || !sameTypes(found.Results, expected.results) {
			problems = append(problems, fmt.Sprintf("panel.wasm exports %s as %s; the panel ABI needs %s.", expected.name, describeSignature(found.Params, found.Results), describeSignature(expected.params, expected.results)))
		}
	}
	return problems
}

// PanelStyleKeys returns the style keys a component's panel may declare:
// those of the traits its definition declares.
func PanelStyleKeys(definition *Definition) map[string]bool {
	keys := map[string]bool{}
	for trait, styleKeys := range TraitStyleKeys {
		if definition.Traits.Has(trait) {
			for _, key := range styleKeys {
				keys[key] = true
			}
		}
	}
	return keys
}

func manifestProblems(panels []PanelManifestEntry, definition *Definition) []string {
	var problems []string
	if len(panels) == 0 {
		problems = append(problems, "The vhp.panels section lists no panels.")
	}
	if len(panels) > MaxComponentPanels {
		problems = append(problems, fmt.Sprintf("The module exports %d panels; a component may have at most %d.", len(panels), MaxComponentPanels))
	}
	styleKeys := PanelStyleKeys(definition)
	ids := map[string]bool{}
	for _, panel := range panels {
		label := fmt.Sprintf("Panel \"%s\"", panel.ID)
		if ids[panel.ID] {
			problems = append(problems, label+" is listed twice.")
		}
		ids[panel.ID] = true
		targets := !panel.appliesToAny && len(panel.definitions) == 1 && panel.definitions[0] == definition.ID
		if !targets {
			problems = append(problems, fmt.Sprintf("%s must apply to exactly its component, %s: #[panel(for = \"%s\")].", label, definition.ID, definition.ID))
		}
		if panel.Scope != "instance" {
			problems = append(problems, fmt.Sprintf("%s has the %s scope; a component's panel has the instance scope.", label, panel.Scope))
		}
		if panel.hasDocument {
			problems = append(problems, label+" reads document data, which only the editor's own sections may.")
		}
		for _, group := range panel.Context {
			if !contextGroups[group] {
				problems = append(problems, fmt.Sprintf("%s asks for the unknown context group \"%s\".", label, group))
			}
		}
		for _, key := range panel.Style {
			if !styleKeys[key] {
				none := ""
				if len(styleKeys) == 0 {
					none = " (it declares no traits with style)"
				}
				problems = append(problems, fmt.Sprintf("%s declares the style key \"%s\", which no trait of the component brings%s.", label, key, none))
			}
		}
	}
	return problems
}
