// Package definition reads what a component module says about itself: the
// component definition an ABI 2 module carries in its `vh.manifest` section,
// or the ABI 1 manifest that upgrades into one, and checks a component's
// editor panel module against it. The rules are the ones the server applies
// when a component is published.
package definition

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strings"
)

// IconRef is a named icon of the editor's icon set, or an image the
// component ships.
type IconRef struct {
	Kind string `json:"kind"`
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

// SizeHint is a default size along one axis: "fill", "hug", or a positive
// number of points.
type SizeHint struct {
	// Keyword is "fill" or "hug"; empty for a fixed size.
	Keyword string
	Points  float64
}

// MarshalJSON writes the keyword or the number.
func (h SizeHint) MarshalJSON() ([]byte, error) {
	if h.Keyword != "" {
		return json.Marshal(h.Keyword)
	}
	return json.Marshal(h.Points)
}

// Size is the size a new instance starts at.
type Size struct {
	Width  SizeHint `json:"width"`
	Height SizeHint `json:"height"`
}

// Condition says when a prop applies: the value of another prop.
type Condition struct {
	Kind string
	Prop string
	// Value is what an "equals" condition compares with.
	Value any
	// Values are what a "oneOf" condition accepts.
	Values []any
}

// MarshalJSON writes the fields of the condition's kind.
func (c Condition) MarshalJSON() ([]byte, error) {
	if c.Kind == "oneOf" {
		values := c.Values
		if values == nil {
			values = []any{}
		}
		return json.Marshal(struct {
			Kind   string `json:"kind"`
			Prop   string `json:"prop"`
			Values []any  `json:"values"`
		}{c.Kind, c.Prop, values})
	}
	return json.Marshal(struct {
		Kind  string `json:"kind"`
		Prop  string `json:"prop"`
		Value any    `json:"value"`
	}{c.Kind, c.Prop, c.Value})
}

// EnumOption is one value an enum prop offers.
type EnumOption struct {
	Value string   `json:"value"`
	Title string   `json:"title"`
	Icon  *IconRef `json:"icon,omitempty"`
}

// PropType is the value a prop holds and how the editor offers it. Which
// fields apply depends on Kind: "string", "number", "boolean", "enum",
// "color", "fill", "asset", "product", "list" or "object".
type PropType struct {
	Kind string

	Multiline *bool
	MaxLength *float64

	Min, Max, Step *float64
	Unit           *string

	Options []EnumOption
	Accepts []string

	Of       *PropType
	MaxItems *float64

	Fields []PropSpec
}

// MarshalJSON writes the fields of the type's kind, in the order the
// definition schema lists them.
func (t PropType) MarshalJSON() ([]byte, error) {
	fields := []field{{"kind", t.Kind}}
	optional := func(name string, value any, present bool) {
		if present {
			fields = append(fields, field{name, value})
		}
	}
	switch t.Kind {
	case "string":
		optional("multiline", t.Multiline, t.Multiline != nil)
		optional("maxLength", t.MaxLength, t.MaxLength != nil)
	case "number":
		optional("min", t.Min, t.Min != nil)
		optional("max", t.Max, t.Max != nil)
		optional("step", t.Step, t.Step != nil)
		optional("unit", t.Unit, t.Unit != nil)
	case "enum":
		fields = append(fields, field{"options", emptyIfNil(t.Options)})
	case "asset":
		fields = append(fields, field{"accepts", emptyIfNil(t.Accepts)})
	case "list":
		fields = append(fields, field{"of", t.Of})
		optional("maxItems", t.MaxItems, t.MaxItems != nil)
	case "object":
		fields = append(fields, field{"fields", emptyIfNil(t.Fields)})
	}
	return marshalFields(fields)
}

// PropSpec is one setting of a component: its name, value type, default and
// editor hints.
type PropSpec struct {
	Name        string
	Title       *string
	Description *string
	Type        PropType
	// Default is the value the prop holds when an instance does not set it.
	Default     any
	Group       *string
	VisibleWhen *Condition
	Bindable    *bool
	Localizable *bool
}

// MarshalJSON writes the spec's keys in the order the definition schema
// lists them, leaving out the optional ones it does not set.
func (p PropSpec) MarshalJSON() ([]byte, error) {
	fields := []field{{"name", p.Name}}
	if p.Title != nil {
		fields = append(fields, field{"title", p.Title})
	}
	if p.Description != nil {
		fields = append(fields, field{"description", p.Description})
	}
	fields = append(fields, field{"type", p.Type}, field{"default", p.Default})
	if p.Group != nil {
		fields = append(fields, field{"group", p.Group})
	}
	if p.VisibleWhen != nil {
		fields = append(fields, field{"visibleWhen", p.VisibleWhen})
	}
	if p.Bindable != nil {
		fields = append(fields, field{"bindable", p.Bindable})
	}
	if p.Localizable != nil {
		fields = append(fields, field{"localizable", p.Localizable})
	}
	return marshalFields(fields)
}

// PayloadField is one field an emitted event carries.
type PayloadField struct {
	Name string   `json:"name"`
	Type PropType `json:"type"`
}

// EventSpec is something a component emits that a paywall binds to an action.
type EventSpec struct {
	Name        string         `json:"name"`
	Title       *string        `json:"title,omitempty"`
	Description *string        `json:"description,omitempty"`
	Payload     []PayloadField `json:"payload"`
}

// SlotSpec is a named place where an instance's children render.
type SlotSpec struct {
	Name  string  `json:"name"`
	Title *string `json:"title,omitempty"`
}

// Children says what an instance may contain: "none", "any", "only" the
// listed definitions, or children in named "slots".
type Children struct {
	Kind        string
	Definitions []string
	Slots       []SlotSpec
}

// MarshalJSON writes the fields of the kind.
func (c Children) MarshalJSON() ([]byte, error) {
	fields := []field{{"kind", c.Kind}}
	switch c.Kind {
	case "only":
		fields = append(fields, field{"definitions", emptyIfNil(c.Definitions)})
	case "slots":
		fields = append(fields, field{"slots", emptyIfNil(c.Slots)})
	}
	return marshalFields(fields)
}

// Implementation says how a component runs: a "primitive" node, "native"
// code, or a "wasm" module.
type Implementation struct {
	Kind       string
	NodeType   string
	Name       string
	MinRuntime float64
	ABI        int
}

// MarshalJSON writes the fields of the kind.
func (i Implementation) MarshalJSON() ([]byte, error) {
	fields := []field{{"kind", i.Kind}}
	switch i.Kind {
	case "primitive":
		fields = append(fields, field{"nodeType", i.NodeType})
	case "native":
		fields = append(fields, field{"name", i.Name}, field{"minRuntime", i.MinRuntime})
	case "wasm":
		fields = append(fields, field{"abi", i.ABI})
	}
	return marshalFields(fields)
}

// FrameTrait says how the canvas resizes an instance.
type FrameTrait struct {
	Resize string  `json:"resize"`
	Aspect *string `json:"aspect,omitempty"`
}

// TraitNames lists the traits a definition can declare, in schema order.
var TraitNames = []string{
	"frame", "layout", "appearance", "fill", "border", "outline", "effects",
	"typography", "states", "interactions", "variables", "sharedElement",
}

// Traits are the editor capabilities a component opts into.
type Traits struct {
	Frame *FrameTrait
	// Present holds the declared traits other than frame.
	Present map[string]bool
}

// Has says whether the definition declares the trait.
func (t Traits) Has(trait string) bool {
	if trait == "frame" {
		return t.Frame != nil
	}
	return t.Present[trait]
}

// MarshalJSON writes the declared traits in schema order.
func (t Traits) MarshalJSON() ([]byte, error) {
	var fields []field
	for _, name := range TraitNames {
		switch {
		case name == "frame" && t.Frame != nil:
			fields = append(fields, field{name, t.Frame})
		case name != "frame" && t.Present[name]:
			fields = append(fields, field{name, struct{}{}})
		}
	}
	return marshalFields(fields)
}

// TraitStyleKeys lists the style keys each trait brings. A component's
// panel may declare only the keys of the traits its definition declares.
var TraitStyleKeys = map[string][]string{
	"frame": {
		"x", "y", "width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight",
		"marginTop", "marginRight", "marginBottom", "marginLeft", "position", "left", "top",
		"right", "bottom", "centerX", "centerY", "flex", "flexGrow", "flexShrink", "flexBasis",
		"alignSelf", "zIndex",
	},
	"layout": {
		"flexDirection", "justifyContent", "alignItems", "gap", "paddingTop", "paddingRight",
		"paddingBottom", "paddingLeft", "overflow", "safeAreaTop", "safeAreaBottom",
	},
	"appearance": {
		"opacity", "blendMode", "display", "borderTopLeftRadius", "borderTopRightRadius",
		"borderBottomRightRadius", "borderBottomLeftRadius",
	},
	"fill": {
		"backgroundEnabled", "backgroundType", "backgroundColor", "backgroundGradient",
		"backgroundImage", "fills",
	},
	"border": {
		"borderEnabled", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
		"borderLeftWidth", "borderColor", "borderStyle",
	},
	"outline": {"outlineEnabled", "outlineWidth", "outlineColor", "outlineOffset", "outlineStyle"},
	"effects": {
		"shadows", "shadowEnabled", "shadowColor", "shadowOffsetX", "shadowOffsetY", "shadowRadius",
		"shadowOpacity", "layerBlur", "backdropBlur", "rotation", "flipHorizontal", "flipVertical",
	},
	"typography": {
		"fontFamily", "fontSize", "fontWeight", "color", "textAlign", "lineHeight", "letterSpacing",
		"fontStyle", "textDecoration", "textTransform",
	},
}

// Definition is the one description of a component that the editor, the
// compiler and the runtime read.
type Definition struct {
	ID             string         `json:"id"`
	Version        string         `json:"version"`
	Title          string         `json:"title"`
	Description    string         `json:"description"`
	Icon           IconRef        `json:"icon"`
	Category       string         `json:"category"`
	Keywords       []string       `json:"keywords"`
	Implementation Implementation `json:"implementation"`
	Traits         Traits         `json:"traits"`
	Children       Children       `json:"children"`
	Props          []PropSpec     `json:"props"`
	Events         []EventSpec    `json:"events"`
	PreviewStates  []string       `json:"previewStates"`
	Capabilities   []string       `json:"capabilities"`
	// Panel says whether the component ships its own editor panel.
	Panel       bool   `json:"panel"`
	Fallback    string `json:"fallback"`
	DefaultSize *Size  `json:"defaultSize,omitempty"`
}

type field struct {
	name  string
	value any
}

func marshalFields(fields []field) ([]byte, error) {
	var out strings.Builder
	out.WriteByte('{')
	for index, entry := range fields {
		if index > 0 {
			out.WriteByte(',')
		}
		name, _ := json.Marshal(entry.name)
		value, err := json.Marshal(entry.value)
		if err != nil {
			return nil, err
		}
		out.Write(name)
		out.WriteByte(':')
		out.Write(value)
	}
	out.WriteByte('}')
	return []byte(out.String()), nil
}

func emptyIfNil[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

var definitionIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*/[A-Za-z0-9][A-Za-z0-9-]*$`)

// Decode reads a component definition from decoded JSON (the values
// encoding/json produces for an `any`), checking everything the definition
// schema checks. Keys the schema does not know are dropped. The error names
// every problem with where it is.
func Decode(value any) (*Definition, error) {
	d := &decoder{}
	definition := d.definition(value)
	if len(d.problems) > 0 {
		return nil, fmt.Errorf("%s", strings.Join(d.problems, "; "))
	}
	if issues := documentIssues(definition); len(issues) > 0 {
		return nil, fmt.Errorf("%s", strings.Join(issues, "; "))
	}
	return definition, nil
}

// path is where a value is, as a JSON path: ["props"][0]["type"].
type path string

func (p path) key(name string) path { return path(fmt.Sprintf(`%s[%q]`, string(p), name)) }
func (p path) index(i int) path     { return path(fmt.Sprintf(`%s[%d]`, string(p), i)) }

type decoder struct {
	problems []string
}

func (d *decoder) fail(at path, format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	if at != "" {
		message += " at " + string(at)
	}
	d.problems = append(d.problems, message)
}

func describe(value any) string {
	switch typed := value.(type) {
	case nil:
		return "null"
	case string:
		return fmt.Sprintf("%q", typed)
	case map[string]any:
		return "an object"
	case []any:
		return "an array"
	default:
		encoded, _ := json.Marshal(typed)
		return string(encoded)
	}
}

func (d *decoder) object(value any, at path) (map[string]any, bool) {
	object, ok := value.(map[string]any)
	if !ok {
		d.fail(at, "Expected an object, got %s", describe(value))
	}
	return object, ok
}

// required reads a key that must be present.
func (d *decoder) required(object map[string]any, key string, at path) (any, bool) {
	value, ok := object[key]
	if !ok {
		d.fail(at.key(key), "Missing key")
	}
	return value, ok
}

// unknown accepts any value; only its key is required.
func (d *decoder) unknown(value any, _ path) any { return value }

func (d *decoder) string(value any, at path) string {
	text, ok := value.(string)
	if !ok {
		d.fail(at, "Expected a string, got %s", describe(value))
	}
	return text
}

func (d *decoder) nonEmpty(value any, at path) string {
	text := d.string(value, at)
	if _, ok := value.(string); ok && text == "" {
		d.fail(at, "Expected a non-empty string")
	}
	return text
}

func (d *decoder) boolean(value any, at path) bool {
	flag, ok := value.(bool)
	if !ok {
		d.fail(at, "Expected a boolean, got %s", describe(value))
	}
	return flag
}

func (d *decoder) number(value any, at path) float64 {
	number, ok := value.(float64)
	if !ok {
		d.fail(at, "Expected a number, got %s", describe(value))
	}
	return number
}

func (d *decoder) nonNegativeInt(value any, at path) float64 {
	number := d.number(value, at)
	if _, ok := value.(float64); ok && (number != math.Trunc(number) || number <= -1) {
		d.fail(at, "Expected an integer of at least 0, got %s", describe(value))
	}
	return number
}

func (d *decoder) literal(value any, at path, options ...string) string {
	text, ok := value.(string)
	if ok {
		for _, option := range options {
			if text == option {
				return text
			}
		}
	}
	quoted := make([]string, len(options))
	for index, option := range options {
		quoted[index] = fmt.Sprintf("%q", option)
	}
	d.fail(at, "Expected %s, got %s", strings.Join(quoted, " | "), describe(value))
	return ""
}

func (d *decoder) array(value any, at path) []any {
	items, ok := value.([]any)
	if !ok {
		d.fail(at, "Expected an array, got %s", describe(value))
	}
	return items
}

func (d *decoder) strings(value any, at path, read func(any, path) string) []string {
	items := d.array(value, at)
	out := make([]string, len(items))
	for index, item := range items {
		out[index] = read(item, at.index(index))
	}
	return out
}

// field reads a required key with read, or the zero value when it is missing.
func requiredField[T any](d *decoder, object map[string]any, key string, at path, read func(any, path) T) T {
	var zero T
	value, ok := d.required(object, key, at)
	if !ok {
		return zero
	}
	return read(value, at.key(key))
}

// optionalField reads a key that may be absent.
func optionalField[T any](object map[string]any, key string, at path, read func(any, path) T) *T {
	value, ok := object[key]
	if !ok {
		return nil
	}
	result := read(value, at.key(key))
	return &result
}

func (d *decoder) iconRef(value any, at path) IconRef {
	object, ok := d.object(value, at)
	if !ok {
		return IconRef{}
	}
	switch object["kind"] {
	case "builtin":
		return IconRef{Kind: "builtin", Name: requiredField(d, object, "name", at, d.nonEmpty)}
	case "image":
		return IconRef{Kind: "image", URL: requiredField(d, object, "url", at, d.nonEmpty)}
	}
	d.fail(at.key("kind"), `Expected "builtin" | "image", got %s`, describe(object["kind"]))
	return IconRef{}
}

func (d *decoder) sizeHint(value any, at path) SizeHint {
	switch typed := value.(type) {
	case string:
		if typed == "fill" || typed == "hug" {
			return SizeHint{Keyword: typed}
		}
	case float64:
		if typed > 0 {
			return SizeHint{Points: typed}
		}
	}
	d.fail(at, `Expected "fill" | "hug" | a number greater than 0, got %s`, describe(value))
	return SizeHint{}
}

func (d *decoder) size(value any, at path) Size {
	object, ok := d.object(value, at)
	if !ok {
		return Size{}
	}
	return Size{
		Width:  requiredField(d, object, "width", at, d.sizeHint),
		Height: requiredField(d, object, "height", at, d.sizeHint),
	}
}

func (d *decoder) condition(value any, at path) Condition {
	object, ok := d.object(value, at)
	if !ok {
		return Condition{}
	}
	switch object["kind"] {
	case "equals":
		return Condition{Kind: "equals", Prop: requiredField(d, object, "prop", at, d.string), Value: requiredField(d, object, "value", at, d.unknown)}
	case "oneOf":
		return Condition{
			Kind:   "oneOf",
			Prop:   requiredField(d, object, "prop", at, d.string),
			Values: requiredField(d, object, "values", at, d.array),
		}
	}
	d.fail(at.key("kind"), `Expected "equals" | "oneOf", got %s`, describe(object["kind"]))
	return Condition{}
}

var reservedPropName = `Prop names starting with "$" are reserved.`

func (d *decoder) propName(value any, at path) string {
	name := d.nonEmpty(value, at)
	if strings.HasPrefix(name, "$") {
		d.fail(at, "%s", reservedPropName)
	}
	return name
}

func (d *decoder) propType(value any, at path) PropType {
	object, ok := d.object(value, at)
	if !ok {
		return PropType{}
	}
	kind, _ := object["kind"].(string)
	propType := PropType{Kind: kind}
	switch kind {
	case "string":
		propType.Multiline = optionalField(object, "multiline", at, d.boolean)
		propType.MaxLength = optionalField(object, "maxLength", at, d.nonNegativeInt)
	case "number":
		propType.Min = optionalField(object, "min", at, d.number)
		propType.Max = optionalField(object, "max", at, d.number)
		propType.Step = optionalField(object, "step", at, func(value any, at path) float64 {
			step := d.number(value, at)
			if _, ok := value.(float64); ok && step <= 0 {
				d.fail(at, "Expected a number greater than 0, got %s", describe(value))
			}
			return step
		})
		propType.Unit = optionalField(object, "unit", at, func(value any, at path) string {
			return d.literal(value, at, "px", "%", "s", "deg", "x")
		})
	case "boolean", "color", "fill", "product":
	case "enum":
		propType.Options = requiredField(d, object, "options", at, func(value any, at path) []EnumOption {
			items := d.array(value, at)
			options := make([]EnumOption, len(items))
			for index, item := range items {
				at := at.index(index)
				option, ok := d.object(item, at)
				if !ok {
					continue
				}
				options[index] = EnumOption{
					Value: requiredField(d, option, "value", at, d.string),
					Title: requiredField(d, option, "title", at, d.string),
					Icon:  optionalField(option, "icon", at, d.iconRef),
				}
			}
			return options
		})
	case "asset":
		propType.Accepts = requiredField(d, object, "accepts", at, func(value any, at path) []string {
			return d.strings(value, at, d.nonEmpty)
		})
	case "list":
		of := requiredField(d, object, "of", at, d.propType)
		propType.Of = &of
		propType.MaxItems = optionalField(object, "maxItems", at, d.nonNegativeInt)
	case "object":
		propType.Fields = requiredField(d, object, "fields", at, d.propSpecs)
	default:
		d.fail(at.key("kind"), `Expected "string" | "number" | "boolean" | "enum" | "color" | "fill" | "asset" | "product" | "list" | "object", got %s`, describe(object["kind"]))
	}
	return propType
}

func (d *decoder) propSpecs(value any, at path) []PropSpec {
	items := d.array(value, at)
	specs := make([]PropSpec, len(items))
	for index, item := range items {
		at := at.index(index)
		object, ok := d.object(item, at)
		if !ok {
			continue
		}
		specs[index] = PropSpec{
			Name:        requiredField(d, object, "name", at, d.propName),
			Title:       optionalField(object, "title", at, d.string),
			Description: optionalField(object, "description", at, d.string),
			Type:        requiredField(d, object, "type", at, d.propType),
			Default:     requiredField(d, object, "default", at, d.unknown),
			Group:       optionalField(object, "group", at, d.string),
			VisibleWhen: optionalField(object, "visibleWhen", at, d.condition),
			Bindable:    optionalField(object, "bindable", at, d.boolean),
			Localizable: optionalField(object, "localizable", at, d.boolean),
		}
	}
	return specs
}

func (d *decoder) events(value any, at path) []EventSpec {
	items := d.array(value, at)
	events := make([]EventSpec, len(items))
	for index, item := range items {
		at := at.index(index)
		object, ok := d.object(item, at)
		if !ok {
			continue
		}
		events[index] = EventSpec{
			Name:        requiredField(d, object, "name", at, d.nonEmpty),
			Title:       optionalField(object, "title", at, d.string),
			Description: optionalField(object, "description", at, d.string),
			Payload: requiredField(d, object, "payload", at, func(value any, at path) []PayloadField {
				items := d.array(value, at)
				fields := make([]PayloadField, len(items))
				for index, item := range items {
					at := at.index(index)
					object, ok := d.object(item, at)
					if !ok {
						continue
					}
					fields[index] = PayloadField{
						Name: requiredField(d, object, "name", at, d.nonEmpty),
						Type: requiredField(d, object, "type", at, d.propType),
					}
				}
				return fields
			}),
		}
	}
	return events
}

func (d *decoder) children(value any, at path) Children {
	object, ok := d.object(value, at)
	if !ok {
		return Children{}
	}
	switch object["kind"] {
	case "none", "any":
		return Children{Kind: object["kind"].(string)}
	case "only":
		return Children{Kind: "only", Definitions: requiredField(d, object, "definitions", at, func(value any, at path) []string {
			return d.strings(value, at, d.nonEmpty)
		})}
	case "slots":
		return Children{Kind: "slots", Slots: requiredField(d, object, "slots", at, func(value any, at path) []SlotSpec {
			items := d.array(value, at)
			slots := make([]SlotSpec, len(items))
			for index, item := range items {
				at := at.index(index)
				object, ok := d.object(item, at)
				if !ok {
					continue
				}
				slots[index] = SlotSpec{
					Name:  requiredField(d, object, "name", at, d.nonEmpty),
					Title: optionalField(object, "title", at, d.string),
				}
			}
			return slots
		})}
	}
	d.fail(at.key("kind"), `Expected "none" | "any" | "only" | "slots", got %s`, describe(object["kind"]))
	return Children{}
}

func (d *decoder) implementation(value any, at path) Implementation {
	object, ok := d.object(value, at)
	if !ok {
		return Implementation{}
	}
	switch object["kind"] {
	case "primitive":
		return Implementation{Kind: "primitive", NodeType: requiredField(d, object, "nodeType", at, d.nonEmpty)}
	case "native":
		return Implementation{
			Kind:       "native",
			Name:       requiredField(d, object, "name", at, d.nonEmpty),
			MinRuntime: requiredField(d, object, "minRuntime", at, d.nonNegativeInt),
		}
	case "wasm":
		abi := requiredField(d, object, "abi", at, func(value any, at path) int {
			if value == float64(1) || value == float64(2) {
				return int(value.(float64))
			}
			d.fail(at, "Expected 1 | 2, got %s", describe(value))
			return 0
		})
		return Implementation{Kind: "wasm", ABI: abi}
	}
	d.fail(at.key("kind"), `Expected "primitive" | "native" | "wasm", got %s`, describe(object["kind"]))
	return Implementation{}
}

func (d *decoder) traits(value any, at path) Traits {
	object, ok := d.object(value, at)
	if !ok {
		return Traits{}
	}
	traits := Traits{Present: map[string]bool{}}
	for _, name := range TraitNames {
		declared, ok := object[name]
		if !ok {
			continue
		}
		at := at.key(name)
		trait, ok := d.object(declared, at)
		if !ok {
			continue
		}
		if name != "frame" {
			traits.Present[name] = true
			continue
		}
		traits.Frame = &FrameTrait{
			Resize: requiredField(d, trait, "resize", at, func(value any, at path) string {
				return d.literal(value, at, "both", "width", "height", "none")
			}),
			Aspect: optionalField(trait, "aspect", at, func(value any, at path) string {
				return d.literal(value, at, "free", "intrinsic")
			}),
		}
	}
	return traits
}

func (d *decoder) definition(value any) *Definition {
	const at = path("")
	object, ok := d.object(value, at)
	if !ok {
		return nil
	}
	plainStrings := func(value any, at path) []string { return d.strings(value, at, d.string) }
	return &Definition{
		ID: requiredField(d, object, "id", at, func(value any, at path) string {
			id := d.string(value, at)
			if _, ok := value.(string); ok && !definitionIDPattern.MatchString(id) {
				d.fail(at, "Expected a string matching the RegExp %s, got %s", definitionIDPattern, describe(value))
			}
			return id
		}),
		Version:        requiredField(d, object, "version", at, d.nonEmpty),
		Title:          requiredField(d, object, "title", at, d.nonEmpty),
		Description:    requiredField(d, object, "description", at, d.string),
		Icon:           requiredField(d, object, "icon", at, d.iconRef),
		Category:       requiredField(d, object, "category", at, d.string),
		Keywords:       requiredField(d, object, "keywords", at, plainStrings),
		Implementation: requiredField(d, object, "implementation", at, d.implementation),
		Traits:         requiredField(d, object, "traits", at, d.traits),
		Children:       requiredField(d, object, "children", at, d.children),
		Props:          requiredField(d, object, "props", at, d.propSpecs),
		Events:         requiredField(d, object, "events", at, d.events),
		PreviewStates: requiredField(d, object, "previewStates", at, func(value any, at path) []string {
			return d.strings(value, at, d.nonEmpty)
		}),
		Capabilities: requiredField(d, object, "capabilities", at, func(value any, at path) []string {
			return d.strings(value, at, func(value any, at path) string {
				return d.literal(value, at, "commerce", "links", "analytics", "navigation", "haptics")
			})
		}),
		Panel: requiredField(d, object, "panel", at, d.boolean),
		Fallback: requiredField(d, object, "fallback", at, func(value any, at path) string {
			return d.literal(value, at, "hide", "placeholder", "children")
		}),
		DefaultSize: optionalField(object, "defaultSize", at, d.size),
	}
}

func duplicates(names []string) []string {
	seen := map[string]bool{}
	reported := map[string]bool{}
	var out []string
	for _, name := range names {
		if seen[name] && !reported[name] {
			reported[name] = true
			out = append(out, name)
		}
		seen[name] = true
	}
	return out
}

// documentPropIssues says why documents cannot hold the values of props:
// names are unique at every level, lists do not hold lists, objects do not
// nest inside objects, and an enum offers at least one option.
func documentPropIssues(props []PropSpec, top bool) []string {
	declared := "Object field"
	if top {
		declared = "Prop"
	}
	names := make([]string, len(props))
	for index, prop := range props {
		names[index] = prop.Name
	}
	var issues []string
	for _, name := range duplicates(names) {
		issues = append(issues, fmt.Sprintf("%s \"%s\" is declared twice.", declared, name))
	}
	for _, prop := range props {
		item := prop.Type
		if item.Kind == "list" && item.Of != nil {
			item = *item.Of
		}
		switch {
		case item.Kind == "list":
			issues = append(issues, fmt.Sprintf("%s \"%s\": a list cannot hold lists.", declared, prop.Name))
		case item.Kind == "enum" && len(item.Options) == 0:
			issues = append(issues, fmt.Sprintf("%s \"%s\": an enum needs at least one option.", declared, prop.Name))
		case item.Kind == "object" && !top:
			issues = append(issues, fmt.Sprintf("%s \"%s\": an object's fields cannot hold objects.", declared, prop.Name))
		case item.Kind == "object":
			issues = append(issues, documentPropIssues(item.Fields, false)...)
		}
	}
	return issues
}

func documentIssues(definition *Definition) []string {
	issues := documentPropIssues(definition.Props, true)
	eventNames := make([]string, len(definition.Events))
	for index, event := range definition.Events {
		eventNames[index] = event.Name
	}
	for _, name := range duplicates(eventNames) {
		issues = append(issues, fmt.Sprintf("Event \"%s\" is declared twice.", name))
	}
	for _, event := range definition.Events {
		fields := make([]string, len(event.Payload))
		for index, payload := range event.Payload {
			fields[index] = payload.Name
		}
		for _, name := range duplicates(fields) {
			issues = append(issues, fmt.Sprintf("Event \"%s\" declares the payload field \"%s\" twice.", event.Name, name))
		}
	}
	if definition.Children.Kind == "slots" {
		slots := make([]string, len(definition.Children.Slots))
		for index, slot := range definition.Children.Slots {
			slots[index] = slot.Name
		}
		for _, name := range duplicates(slots) {
			issues = append(issues, fmt.Sprintf("Slot \"%s\" is declared twice.", name))
		}
	}
	for _, name := range duplicates(definition.PreviewStates) {
		issues = append(issues, fmt.Sprintf("Preview state \"%s\" is listed twice.", name))
	}
	return issues
}
