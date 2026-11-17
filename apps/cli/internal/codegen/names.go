package codegen

import (
	"strconv"
	"strings"
)

// words splits a slug into the words of an identifier: runs of ASCII
// letters and digits, also split where a capital follows a small letter or
// a digit ("proMonthly" is "pro", "Monthly").
func words(slug string) []string {
	var found []string
	var current []byte
	flush := func() {
		if len(current) > 0 {
			found = append(found, string(current))
			current = nil
		}
	}
	for index := 0; index < len(slug); index++ {
		char := slug[index]
		lower := char >= 'a' && char <= 'z'
		upper := char >= 'A' && char <= 'Z'
		digit := char >= '0' && char <= '9'
		if !lower && !upper && !digit {
			flush()
			continue
		}
		if upper && len(current) > 0 {
			if previous := current[len(current)-1]; previous < 'A' || previous > 'Z' {
				flush()
			}
		}
		current = append(current, char)
	}
	flush()
	return found
}

// identifiers names each slug, in order, with an identifier of a language.
// convert turns a slug's words into its usual name there; fallback names a
// slug without letters or digits; reserved names cannot be used as they
// are. Slugs that convert to the same name are told apart by a number, in
// the order of the slugs: "pro-monthly" is proMonthly and "pro_monthly"
// proMonthly2.
func identifiers(slugs []string, convert func(words []string) string, fallback, numberSeparator string, reserved map[string]bool) []string {
	names := make([]string, len(slugs))
	used := map[string]bool{}
	for index, slug := range slugs {
		base := fallback
		if parts := words(slug); len(parts) > 0 {
			base = convert(parts)
		}
		if base[0] >= '0' && base[0] <= '9' {
			base = "_" + base
		}
		if reserved[base] {
			base += "_"
		}
		name := base
		for number := 2; used[name]; number++ {
			name = base + numberSeparator + strconv.Itoa(number)
		}
		used[name] = true
		names[index] = name
	}
	return names
}

// lowerCamel is words as a Swift case name: proMonthly.
func lowerCamel(parts []string) string {
	var name strings.Builder
	for index, part := range parts {
		part = strings.ToLower(part)
		if index > 0 {
			part = strings.ToUpper(part[:1]) + part[1:]
		}
		name.WriteString(part)
	}
	return name.String()
}

// upperSnake is words as a Kotlin enum constant: PRO_MONTHLY.
func upperSnake(parts []string) string {
	return strings.ToUpper(strings.Join(parts, "_"))
}

// quoted writes text as a string literal of Swift or Kotlin, with unicode
// giving the escape of a character by its code.
func quoted(text string, escapeDollar bool, unicode func(char rune) string) string {
	var literal strings.Builder
	literal.WriteByte('"')
	for _, char := range text {
		switch {
		case char == '"' || char == '\\':
			literal.WriteByte('\\')
			literal.WriteRune(char)
		case char == '$' && escapeDollar:
			literal.WriteString(`\$`)
		case char == '\n':
			literal.WriteString(`\n`)
		case char == '\r':
			literal.WriteString(`\r`)
		case char == '\t':
			literal.WriteString(`\t`)
		case char < 0x20 || char == 0x7f || char == 0x2028 || char == 0x2029:
			literal.WriteString(unicode(char))
		default:
			literal.WriteRune(char)
		}
	}
	literal.WriteByte('"')
	return literal.String()
}
