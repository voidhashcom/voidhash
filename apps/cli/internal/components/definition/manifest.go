package definition

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/wasm"
)

// slugPattern matches component names and catalog slugs: lowercase letters,
// digits and dashes, starting with a letter or digit, at most 63 characters.
var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

// IsSlug says whether name is a component slug.
func IsSlug(name string) bool { return slugPattern.MatchString(name) }

// abi1Capabilities are the host actions an ABI 1 module can request. ABI 1
// does not declare capabilities, so a module may use every one of them.
var abi1Capabilities = []string{"commerce", "links", "analytics", "navigation"}

var manifestPropTypes = []string{"string", "number", "boolean", "color", "image", "product"}

// manifestPropType is the definition prop type of a manifest prop or payload
// field type.
func manifestPropType(name string) PropType {
	if rest, isList := strings.CutSuffix(name, "[]"); isList {
		of := manifestPropType(rest)
		return PropType{Kind: "list", Of: &of}
	}
	switch name {
	case "number", "boolean", "color", "product":
		return PropType{Kind: name}
	case "image":
		return PropType{Kind: "asset", Accepts: []string{"image"}}
	default:
		// ABI 1 does not validate payload field types; anything else reads as a string.
		return PropType{Kind: "string"}
	}
}

// sizeAxis resolves one axis of an ABI 1 size hint: "fill", "hug" or a
// positive number; anything else takes fallback.
func sizeAxis(value any, fallback string) SizeHint {
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
	return SizeHint{Keyword: fallback}
}

// definitionFromManifest decodes a guest ABI 1 manifest and upgrades it into
// the definition the runtime reads it as: no traits, the manifest's props,
// actions (as events), states, slot and size, named project/<name>.
func definitionFromManifest(object map[string]any, payloadFields [][]string) (*Definition, error) {
	d := &decoder{}
	const at = path("")
	if object["abi"] != float64(1) {
		return nil, errors.New(`Unsupported guest ABI: ABI 1 manifests declare "abi": 1, and ABI 2 manifests are component definitions without an "abi" key.`)
	}
	name := requiredField(d, object, "name", at, func(value any, at path) string {
		name := d.string(value, at)
		if _, ok := value.(string); ok && !IsSlug(name) {
			d.fail("", "The manifest name must be kebab-case and at most 63 characters.")
		}
		return name
	})
	title := optionalField(object, "title", at, d.string)
	description := optionalField(object, "description", at, d.string)
	props := optionalField(object, "props", at, func(value any, at path) []PropSpec {
		items := d.array(value, at)
		specs := make([]PropSpec, len(items))
		for index, item := range items {
			at := at.index(index)
			prop, ok := d.object(item, at)
			if !ok {
				continue
			}
			typeName := requiredField(d, prop, "type", at, func(value any, at path) string {
				var options []string
				for _, base := range manifestPropTypes {
					options = append(options, base)
				}
				for _, base := range manifestPropTypes {
					options = append(options, base+"[]")
				}
				return d.literal(value, at, options...)
			})
			specs[index] = PropSpec{
				Name:        requiredField(d, prop, "name", at, d.propName),
				Title:       optionalField(prop, "title", at, d.string),
				Description: optionalField(prop, "description", at, d.string),
				Type:        manifestPropType(typeName),
				Default:     prop["default"],
			}
		}
		return specs
	})
	actions := optionalField(object, "actions", at, func(value any, at path) []EventSpec {
		items := d.array(value, at)
		events := make([]EventSpec, len(items))
		for index, item := range items {
			at := at.index(index)
			action, ok := d.object(item, at)
			if !ok {
				continue
			}
			event := EventSpec{Name: requiredField(d, action, "name", at, d.nonEmpty), Payload: []PayloadField{}}
			if declared, ok := action["payload"]; ok {
				at := at.key("payload")
				if payload, ok := d.object(declared, at); ok {
					for _, field := range payloadFieldNames(payload, payloadFields, index) {
						event.Payload = append(event.Payload, PayloadField{
							Name: field,
							Type: manifestPropType(d.string(payload[field], at.key(field))),
						})
					}
				}
			}
			events[index] = event
		}
		return events
	})
	states := optionalField(object, "states", at, func(value any, at path) []string {
		return d.strings(value, at, d.string)
	})
	slot := optionalField(object, "slot", at, d.boolean)
	if len(d.problems) > 0 {
		return nil, errors.New(strings.Join(d.problems, "; "))
	}
	if props != nil {
		names := make([]string, len(*props))
		for index, prop := range *props {
			names[index] = prop.Name
		}
		if len(duplicates(names)) > 0 {
			return nil, errors.New("Prop names must be unique.")
		}
	}

	definition := &Definition{
		ID:             "project/" + name,
		Version:        "1",
		Title:          name,
		Icon:           IconRef{Kind: "builtin", Name: "component"},
		Category:       "Project",
		Keywords:       []string{},
		Implementation: Implementation{Kind: "wasm", ABI: 1},
		Traits:         Traits{Present: map[string]bool{}},
		Children:       Children{Kind: "none"},
		Props:          []PropSpec{},
		Events:         []EventSpec{},
		PreviewStates:  []string{"default"},
		Capabilities:   append([]string{}, abi1Capabilities...),
		Fallback:       "placeholder",
	}
	if title != nil {
		definition.Title = *title
	}
	if description != nil {
		definition.Description = *description
	}
	if props != nil {
		definition.Props = *props
	}
	if actions != nil {
		definition.Events = *actions
	}
	if states != nil && len(*states) > 0 {
		definition.PreviewStates = *states
	}
	if slot != nil && *slot {
		definition.Children = Children{Kind: "slots", Slots: []SlotSpec{{Name: "default"}}}
	}
	// A malformed axis is not an error: the width fills and the height hugs.
	size, _ := object["size"].(map[string]any)
	definition.DefaultSize = &Size{Width: sizeAxis(size["width"], "fill"), Height: sizeAxis(size["height"], "hug")}
	return definition, nil
}

// payloadFieldNames lists the fields of an action's payload in the order the
// manifest wrote them, which is the order the event carries them in. orders
// holds that order per action when it could be read; names sort otherwise.
func payloadFieldNames(payload map[string]any, orders [][]string, action int) []string {
	if action < len(orders) && len(orders[action]) == len(payload) {
		return orders[action]
	}
	names := make([]string, 0, len(payload))
	for name := range payload {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// payloadFieldOrders reads the key order of every action's payload object
// from the manifest's text, which decoding into a map loses.
func payloadFieldOrders(manifest []byte) [][]string {
	var shape struct {
		Actions []struct {
			Payload json.RawMessage `json:"payload"`
		} `json:"actions"`
	}
	if json.Unmarshal(manifest, &shape) != nil {
		return nil
	}
	orders := make([][]string, len(shape.Actions))
	for index, action := range shape.Actions {
		tokens := json.NewDecoder(bytes.NewReader(action.Payload))
		if first, err := tokens.Token(); err != nil || first != json.Delim('{') {
			continue
		}
		seen := map[string]bool{}
		for tokens.More() {
			key, err := tokens.Token()
			name, isName := key.(string)
			var value json.RawMessage
			if err != nil || !isName || tokens.Decode(&value) != nil {
				break
			}
			if !seen[name] {
				seen[name] = true
				orders[index] = append(orders[index], name)
			}
		}
	}
	return orders
}

// FromManifest reads the definition a module's `vh.manifest` JSON describes
// the module by: JSON with an "abi" key is a guest ABI 1 manifest, which is
// upgraded; anything else is an ABI 2 component definition, which must
// declare {"kind": "wasm", "abi": 2} as its implementation. The error is a
// sentence naming the problem.
func FromManifest(manifest []byte) (*Definition, error) {
	var value any
	if !utf8.Valid(manifest) || json.Unmarshal(manifest, &value) != nil {
		return nil, errors.New("The vh.manifest section is not valid UTF-8 JSON.")
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, errors.New("The manifest is not an object.")
	}
	if _, isABI1 := object["abi"]; isABI1 {
		return definitionFromManifest(object, payloadFieldOrders(manifest))
	}
	definition, err := Decode(object)
	if err != nil {
		return nil, fmt.Errorf("The manifest is not a component definition: %s", err)
	}
	if definition.Implementation.Kind != "wasm" || definition.Implementation.ABI != 2 {
		return nil, errors.New(`An ABI 2 module's definition must declare implementation { "kind": "wasm", "abi": 2 }.`)
	}
	return definition, nil
}

// ReadModule reads the definition a component module describes itself by,
// from its `vh.manifest` section. The error is a sentence naming the problem.
func ReadModule(module []byte) (*Definition, error) {
	read, err := wasm.Read(module)
	if err != nil {
		return nil, err
	}
	for _, section := range read.CustomSections {
		if section.Name != "vh.manifest" {
			continue
		}
		return FromManifest(section.Payload)
	}
	return nil, errors.New("The module has no vh.manifest section.")
}
