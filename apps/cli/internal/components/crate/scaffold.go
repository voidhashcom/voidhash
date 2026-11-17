package crate

import (
	_ "embed"
	"strings"
	"unicode"
)

var (
	//go:embed scaffold/Cargo.toml.tmpl
	cargoTomlTemplate string
	//go:embed scaffold/lib.rs.tmpl
	libTemplate string
	//go:embed scaffold/panel.rs.tmpl
	panelTemplate string
)

// ComponentID is the id of a working copy's component, which `#[component]`
// and `#[panel(for = …)]` both name: project/<slug>.
func ComponentID(slug string) string { return "project/" + slug }

// pascalCase turns plan-picker into PlanPicker, the component function's name.
func pascalCase(name string) string {
	var out strings.Builder
	for _, part := range strings.Split(name, "-") {
		if part == "" {
			continue
		}
		out.WriteString(strings.ToUpper(part[:1]))
		out.WriteString(part[1:])
	}
	return out.String()
}

// constantName turns PlanPicker into PLAN_PICKER: the constant `#[component]`
// generates for a function, whose words start at each capital that follows a
// lowercase letter or digit.
func constantName(functionName string) string {
	var out strings.Builder
	var previous rune
	for index, char := range functionName {
		if index > 0 && unicode.IsUpper(char) && !unicode.IsUpper(previous) {
			out.WriteByte('_')
		}
		out.WriteRune(unicode.ToUpper(char))
		previous = char
	}
	return out.String()
}

// MemberCargoToml is the Cargo.toml of a component crate in the working
// copy. It has no [workspace] or [profile.*] tables: those belong to the
// working copy's workspace manifest.
func MemberCargoToml(slug string) string {
	return strings.ReplaceAll(cargoTomlTemplate, "__SLUG__", slug)
}

// Scaffold returns the files of a new component of the working copy, by
// crate-relative path: a buildable `voidhash-ui` component and its editor
// panel, both with the id project/<slug>. The title holds letters, digits
// and spaces only, so it needs no escaping in Rust.
func Scaffold(slug, title string) map[string]string {
	function := pascalCase(slug)
	fill := strings.NewReplacer(
		"__SLUG__", slug,
		"__TITLE__", title,
		"__FUNCTION__", function,
		"__CONSTANT__", constantName(function),
	)
	return map[string]string{
		"Cargo.toml":   MemberCargoToml(slug),
		"src/lib.rs":   fill.Replace(libTemplate),
		"src/panel.rs": fill.Replace(panelTemplate),
	}
}
