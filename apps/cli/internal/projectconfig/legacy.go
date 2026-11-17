package projectconfig

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Earlier versions of the CLI kept the configuration in a voidhash.config.ts
// and ran it to read it. This CLI runs no JavaScript, so it reads the file
// as text and understands the one shape those versions wrote and documented:
// a default-exported object literal of string literals,
//
//	import { defineConfig } from "voidhash-cli";
//
//	export default defineConfig({
//	  team: "acme",
//	  project: "app",
//	});
//
// also without defineConfig, as `module.exports = …`, or through one
// `const config = …`. Comments, trailing commas, `as const` and `satisfies`
// are fine. Anything computed (an environment lookup, a spread, a template
// with ${…}, a call) cannot be known without running the file, so it is
// refused with how to move to voidhash.json.

// LegacyFileNames are the configuration files of earlier versions of the
// CLI, in the order they are looked for.
var LegacyFileNames = []string{"voidhash.config.ts", "voidhash.config.js", "voidhash.config.cjs", "voidhash.config.mjs"}

// legacyFile finds dir's voidhash.config.* file.
func legacyFile(dir string) (string, bool) {
	for _, name := range LegacyFileNames {
		path := filepath.Join(dir, name)
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			return path, true
		}
	}
	return "", false
}

func loadLegacy(dir string) (*Config, bool, error) {
	path, ok := legacyFile(dir)
	if !ok {
		return nil, false, nil
	}
	config, err := readLegacy(path)
	if err != nil {
		return nil, false, err
	}
	return config, true, nil
}

func readLegacy(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("could not read %s: %w", path, err)
	}
	config, err := ParseLegacy(string(data))
	if err != nil {
		var static *StaticError
		if errors.As(err, &static) {
			return nil, fmt.Errorf("%s cannot be read without running it (line %d: %s). %s",
				path, static.Line, static.Reason, migration(static.Partial))
		}
		return nil, fmt.Errorf("%s %w", path, err)
	}
	config.Path = path
	return config, nil
}

// migration says how to replace a legacy file the CLI cannot read.
func migration(partial Config) string {
	if partial.Team == "" || partial.Project == "" {
		return "Replace it with a " + FileName + ` like {"team": "<organization slug>", "project": "<project slug>"}, or delete it and run 'voidhash init'`
	}
	// Compact, so the whole message stays on one line.
	replacement, _ := json.Marshal(&partial)
	return "Replace it with a " + FileName + " holding " + string(replacement) + ", or delete it and run 'voidhash init'"
}

// StaticError is why a legacy configuration cannot be read as text.
type StaticError struct {
	// Line is where reading stopped, counted from 1.
	Line int
	// Reason is what was found there.
	Reason string
	// Partial holds the values that were read before, to suggest the
	// voidhash.json that replaces the file.
	Partial Config
}

func (e *StaticError) Error() string {
	return fmt.Sprintf("line %d: %s", e.Line, e.Reason)
}

// ParseLegacy reads the text of a voidhash.config.* file. It fails with a
// [*StaticError] when the file is not the supported shape, and with a plain
// error, continuing a sentence that starts with the file's name, when the
// shape is fine but a required value is missing.
func ParseLegacy(source string) (*Config, error) {
	tokens, err := scan(source)
	if err != nil {
		return nil, err
	}
	parser := &legacyParser{tokens: tokens, bindings: map[string]binding{}}
	exported, err := parser.file()
	if err != nil {
		var static *StaticError
		if errors.As(err, &static) {
			static.Partial = parser.partial
		}
		return nil, err
	}
	if exported == nil {
		return nil, &StaticError{Line: parser.lastLine(), Reason: "it exports no configuration: expected `export default { team: \"…\", project: \"…\" }`"}
	}
	config := &Config{
		Team:        exported.fields["team"],
		Project:     exported.fields["project"],
		TypesOutput: exported.fields["typesOutput"],
	}
	for _, key := range []string{"team", "project"} {
		if strings.TrimSpace(exported.fields[key]) == "" {
			return nil, fmt.Errorf("has no %q: add it, or run 'voidhash init' to write a %s", key, FileName)
		}
	}
	return config, nil
}

type tokenKind int

const (
	tokenEOF tokenKind = iota
	tokenIdent
	tokenString
	tokenPunct
	// tokenOther is anything a configuration of the supported shape never
	// holds: a number, an operator, a template with ${…}.
	tokenOther
)

type token struct {
	kind tokenKind
	text string
	line int
}

func (t token) describe() string {
	switch t.kind {
	case tokenEOF:
		return "the end of the file"
	case tokenString:
		return "the text " + fmt.Sprintf("%q", t.text)
	default:
		return "`" + t.text + "`"
	}
}

func isIdentStart(char byte) bool {
	return char == '_' || char == '$' || (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char >= 0x80
}

func isIdentPart(char byte) bool {
	return isIdentStart(char) || (char >= '0' && char <= '9')
}

// scan splits the source into tokens, dropping whitespace and comments.
func scan(source string) ([]token, error) {
	var tokens []token
	line := 1
	fail := func(reason string) ([]token, error) {
		return nil, &StaticError{Line: line, Reason: reason}
	}
	source = strings.TrimPrefix(source, "\uFEFF")
	for index := 0; index < len(source); {
		char := source[index]
		switch {
		case char == '\n':
			line++
			index++
		case char == ' ' || char == '\t' || char == '\r':
			index++
		case strings.HasPrefix(source[index:], "//"):
			end := strings.IndexByte(source[index:], '\n')
			if end < 0 {
				end = len(source) - index
			}
			index += end
		case strings.HasPrefix(source[index:], "/*"):
			end := strings.Index(source[index+2:], "*/")
			if end < 0 {
				return fail("a comment is never closed")
			}
			line += strings.Count(source[index:index+2+end], "\n")
			index += end + 4
		case index == 0 && strings.HasPrefix(source, "#!"):
			end := strings.IndexByte(source, '\n')
			if end < 0 {
				end = len(source)
			}
			index = end
		case char == '"' || char == '\'' || char == '`':
			text, length, newlines, problem := scanString(source[index:])
			if problem != "" {
				return fail(problem)
			}
			tokens = append(tokens, token{kind: tokenString, text: text, line: line})
			line += newlines
			index += length
		case isIdentStart(char):
			end := index + 1
			for end < len(source) && isIdentPart(source[end]) {
				end++
			}
			tokens = append(tokens, token{kind: tokenIdent, text: source[index:end], line: line})
			index = end
		case strings.HasPrefix(source[index:], "..."):
			tokens = append(tokens, token{kind: tokenOther, text: "...", line: line})
			index += 3
		case strings.IndexByte("{}()[],:;=.", char) >= 0 && !strings.HasPrefix(source[index:], "=>") && !strings.HasPrefix(source[index:], "=="):
			tokens = append(tokens, token{kind: tokenPunct, text: string(char), line: line})
			index++
		default:
			end := index + 1
			for end < len(source) && !strings.ContainsRune(" \t\r\n{}()[],:;\"'`", rune(source[end])) {
				end++
			}
			tokens = append(tokens, token{kind: tokenOther, text: source[index:end], line: line})
			index = end
		}
	}
	return append(tokens, token{kind: tokenEOF, line: line}), nil
}

// scanString reads the string literal source starts with: its value, its
// length in the source and the line breaks it spans.
func scanString(source string) (text string, length, newlines int, problem string) {
	quote := source[0]
	var value strings.Builder
	for index := 1; index < len(source); index++ {
		char := source[index]
		switch {
		case char == quote:
			return value.String(), index + 1, newlines, ""
		case char == '\n' && quote != '`':
			return "", 0, 0, "a text value is never closed"
		case char == '\n':
			newlines++
			value.WriteByte(char)
		case quote == '`' && char == '$' && index+1 < len(source) && source[index+1] == '{':
			return "", 0, 0, "a template with ${…} is computed when the file runs"
		case char == '\\':
			index++
			if index >= len(source) {
				return "", 0, 0, "a text value is never closed"
			}
			switch escaped := source[index]; escaped {
			case 'n':
				value.WriteByte('\n')
			case 't':
				value.WriteByte('\t')
			case 'r':
				value.WriteByte('\r')
			case '\\', '\'', '"', '`', '/', '$':
				value.WriteByte(escaped)
			default:
				// Slugs and paths need none of the other escapes; decoding
				// them wrongly would name another project.
				return "", 0, 0, "a text value uses the escape \\" + string(escaped) + ", which is not read here"
			}
		default:
			value.WriteByte(char)
		}
	}
	return "", 0, 0, "a text value is never closed"
}

// object is an object literal of the supported shape.
type object struct {
	fields map[string]string
}

// binding is what a top-level `const name = …` holds.
type binding struct {
	text   *string
	object *object
	// helper marks a name imported or required, such as defineConfig.
	helper bool
}

type legacyParser struct {
	tokens   []token
	position int
	bindings map[string]binding
	// partial collects team, project and typesOutput as they are read.
	partial Config
}

func (p *legacyParser) peek() token { return p.tokens[p.position] }

func (p *legacyParser) peekAt(offset int) token {
	if p.position+offset >= len(p.tokens) {
		return p.tokens[len(p.tokens)-1]
	}
	return p.tokens[p.position+offset]
}

func (p *legacyParser) next() token {
	current := p.tokens[p.position]
	if current.kind != tokenEOF {
		p.position++
	}
	return current
}

func (p *legacyParser) lastLine() int { return p.tokens[len(p.tokens)-1].line }

func (p *legacyParser) fail(at token, format string, args ...any) error {
	return &StaticError{Line: at.line, Reason: fmt.Sprintf(format, args...)}
}

func (p *legacyParser) is(kind tokenKind, text string) bool {
	current := p.peek()
	return current.kind == kind && current.text == text
}

func (p *legacyParser) accept(kind tokenKind, text string) bool {
	if p.is(kind, text) {
		p.position++
		return true
	}
	return false
}

func (p *legacyParser) expect(kind tokenKind, text string) error {
	if !p.accept(kind, text) {
		return p.fail(p.peek(), "expected `%s`, found %s", text, p.peek().describe())
	}
	return nil
}

// file reads every statement and returns the exported object.
func (p *legacyParser) file() (*object, error) {
	var exported *object
	export := func(value *object, at token) error {
		if exported != nil {
			return p.fail(at, "the configuration is exported twice")
		}
		exported = value
		return nil
	}
	for {
		current := p.peek()
		switch {
		case current.kind == tokenEOF:
			return exported, nil
		case current.kind == tokenPunct && current.text == ";":
			p.next()
		case current.kind == tokenString:
			// A directive such as "use strict".
			p.next()
		case current.kind == tokenIdent && current.text == "import":
			if err := p.importStatement(); err != nil {
				return nil, err
			}
		case current.kind == tokenIdent && (current.text == "const" || current.text == "let" || current.text == "var"):
			if err := p.declaration(); err != nil {
				return nil, err
			}
		case current.kind == tokenIdent && current.text == "export":
			p.next()
			if !p.accept(tokenIdent, "default") {
				return nil, p.fail(p.peek(), "only `export default` is read, found `export %s`", p.peek().text)
			}
			value, err := p.objectExpression()
			if err != nil {
				return nil, err
			}
			if err := export(value, current); err != nil {
				return nil, err
			}
		case current.kind == tokenIdent && current.text == "module" && p.peekAt(1).text == "." && p.peekAt(2).text == "exports" && p.peekAt(3).text == "=":
			p.position += 4
			value, err := p.objectExpression()
			if err != nil {
				return nil, err
			}
			if err := export(value, current); err != nil {
				return nil, err
			}
		default:
			return nil, p.fail(current, "%s starts a statement that is not an import, a `const` or the exported configuration", current.describe())
		}
	}
}

// importStatement skips `import … from "module"` and remembers the names it
// brings in, so `defineConfig(…)` is known to be the CLI's own helper.
func (p *legacyParser) importStatement() error {
	start := p.next()
	for {
		current := p.next()
		switch current.kind {
		case tokenString:
			p.accept(tokenPunct, ";")
			return nil
		case tokenIdent:
			if current.text != "from" && current.text != "type" && current.text != "as" {
				p.bindings[current.text] = binding{helper: true}
			}
		case tokenPunct:
			if current.text != "{" && current.text != "}" && current.text != "," {
				return p.fail(current, "an import holds `%s`", current.text)
			}
		default:
			if current.kind == tokenOther && current.text == "*" {
				continue
			}
			return p.fail(start, "an import is not finished")
		}
	}
}

// declaration reads `const name = value` where the value is a string, an
// object of the supported shape, or `require("module")`.
func (p *legacyParser) declaration() error {
	p.next()
	var names []string
	destructured := p.accept(tokenPunct, "{")
	if destructured {
		// const { defineConfig } = require("voidhash-cli")
		for !p.accept(tokenPunct, "}") {
			name := p.next()
			if name.kind != tokenIdent {
				return p.fail(name, "expected a name, found %s", name.describe())
			}
			names = append(names, name.text)
			p.accept(tokenPunct, ",")
		}
	} else {
		name := p.next()
		if name.kind != tokenIdent {
			return p.fail(name, "expected a name, found %s", name.describe())
		}
		names = append(names, name.text)
		if p.accept(tokenPunct, ":") {
			if err := p.typeName(); err != nil {
				return err
			}
		}
	}
	if err := p.expect(tokenPunct, "="); err != nil {
		return err
	}

	value := p.peek()
	switch {
	case value.kind == tokenIdent && value.text == "require" && p.peekAt(1).text == "(":
		p.position += 2
		if module := p.next(); module.kind != tokenString {
			return p.fail(module, "`require` is given %s", module.describe())
		}
		if err := p.expect(tokenPunct, ")"); err != nil {
			return err
		}
		for _, name := range names {
			p.bindings[name] = binding{helper: true}
		}
	case destructured:
		return p.fail(value, "only `require(…)` can be taken apart with `{ … }`")
	case value.kind == tokenString:
		p.next()
		if err := p.suffixes(); err != nil {
			return err
		}
		text := value.text
		p.bindings[names[0]] = binding{text: &text}
	default:
		parsed, err := p.objectExpression()
		if err != nil {
			return err
		}
		p.bindings[names[0]] = binding{object: parsed}
		return nil
	}
	p.accept(tokenPunct, ";")
	return nil
}

// typeName skips a type such as `Config` or `cli.Config`.
func (p *legacyParser) typeName() error {
	for {
		name := p.next()
		if name.kind != tokenIdent {
			return p.fail(name, "expected a type name, found %s", name.describe())
		}
		if !p.accept(tokenPunct, ".") {
			return nil
		}
	}
}

// suffixes skips `as const`, `as Type` and `satisfies Type` after a value.
func (p *legacyParser) suffixes() error {
	for p.is(tokenIdent, "as") || p.is(tokenIdent, "satisfies") {
		p.next()
		if err := p.typeName(); err != nil {
			return err
		}
	}
	return nil
}

// objectExpression reads the configuration object: a literal, a name bound
// to one, either wrapped in defineConfig(…) or parentheses, with any type
// suffixes, up to the end of its statement.
func (p *legacyParser) objectExpression() (*object, error) {
	value, err := p.objectValue()
	if err != nil {
		return nil, err
	}
	if err := p.suffixes(); err != nil {
		return nil, err
	}
	if after := p.peek(); !p.accept(tokenPunct, ";") && after.kind != tokenEOF && after.line == p.tokens[p.position-1].line {
		return nil, p.fail(after, "%s follows the configuration", after.describe())
	}
	return value, nil
}

func (p *legacyParser) objectValue() (*object, error) {
	current := p.next()
	switch {
	case current.kind == tokenPunct && current.text == "{":
		return p.objectLiteral()
	case current.kind == tokenPunct && current.text == "(":
		value, err := p.objectValue()
		if err != nil {
			return nil, err
		}
		if err := p.suffixes(); err != nil {
			return nil, err
		}
		return value, p.expect(tokenPunct, ")")
	case current.kind == tokenIdent:
		name := current.text
		switch name {
		case "function", "async", "class", "new", "await":
			return nil, p.fail(current, "`%s` has no value until the file runs", name)
		}
		// cli.defineConfig(…)
		for p.is(tokenPunct, ".") && p.peekAt(1).kind == tokenIdent {
			if !p.bindings[name].helper {
				return nil, p.fail(current, "`%s.%s` is looked up when the file runs", name, p.peekAt(1).text)
			}
			p.next()
			name = p.next().text
		}
		if p.accept(tokenPunct, "(") {
			if name != "defineConfig" {
				return nil, p.fail(current, "`%s(…)` is a call, which has no value until the file runs", name)
			}
			value, err := p.objectValue()
			if err != nil {
				return nil, err
			}
			if err := p.suffixes(); err != nil {
				return nil, err
			}
			p.accept(tokenPunct, ",")
			return value, p.expect(tokenPunct, ")")
		}
		if bound := p.bindings[name]; bound.object != nil {
			return bound.object, nil
		}
		return nil, p.fail(current, "`%s` is not an object written out in this file", name)
	default:
		return nil, p.fail(current, "expected the configuration as `{ team: \"…\", project: \"…\" }`, found %s", current.describe())
	}
}

// objectLiteral reads the properties after `{`.
func (p *legacyParser) objectLiteral() (*object, error) {
	parsed := &object{fields: map[string]string{}}
	for {
		if p.accept(tokenPunct, "}") {
			return parsed, nil
		}
		key := p.next()
		switch {
		case key.kind == tokenOther && key.text == "...":
			return nil, p.fail(key, "a spread (`...`) copies values that are only known when the file runs")
		case key.kind == tokenPunct && key.text == "[":
			return nil, p.fail(key, "a computed key (`[…]`) is only known when the file runs")
		case key.kind != tokenIdent && key.kind != tokenString:
			return nil, p.fail(key, "expected a key, found %s", key.describe())
		}
		if key.text != "team" && key.text != "project" && key.text != "typesOutput" {
			return nil, p.fail(key, "the key `%s` is not one this file can hold (team, project, typesOutput)", key.text)
		}
		if _, repeated := parsed.fields[key.text]; repeated {
			return nil, p.fail(key, "the key `%s` is written twice", key.text)
		}

		var value string
		if p.accept(tokenPunct, ":") {
			found, err := p.textValue(key.text)
			if err != nil {
				return nil, err
			}
			value = found
		} else if bound := p.bindings[key.text]; key.kind == tokenIdent && bound.text != nil {
			// The shorthand `{ team }` of `const team = "acme"`.
			value = *bound.text
		} else {
			return nil, p.fail(key, "expected `%s: \"…\"`", key.text)
		}
		parsed.fields[key.text] = value
		switch key.text {
		case "team":
			p.partial.Team = value
		case "project":
			p.partial.Project = value
		case "typesOutput":
			p.partial.TypesOutput = value
		}

		if !p.accept(tokenPunct, ",") && !p.is(tokenPunct, "}") {
			return nil, p.fail(p.peek(), "the value of `%s` is followed by %s: only text written out in quotes can be read", key.text, p.peek().describe())
		}
	}
}

// textValue reads a property's value: a string literal, or a name bound to
// one by a `const` above.
func (p *legacyParser) textValue(key string) (string, error) {
	current := p.next()
	var value string
	switch {
	case current.kind == tokenString:
		value = current.text
	case current.kind == tokenIdent && p.bindings[current.text].text != nil && !p.is(tokenPunct, ".") && !p.is(tokenPunct, "("):
		value = *p.bindings[current.text].text
	case current.kind == tokenIdent && current.text == "process":
		return "", p.fail(current, "`%s` is read from the environment when the file runs", key)
	case current.kind == tokenIdent:
		return "", p.fail(current, "`%s` is set from `%s`, which is only known when the file runs", key, current.text)
	default:
		return "", p.fail(current, "`%s` must be text written out in quotes, found %s", key, current.describe())
	}
	return value, p.suffixes()
}
