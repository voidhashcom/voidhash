package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// The catalog is the management operations of the API, read from the
// OpenAPI document of the server the CLI talks to, so `voidhash api` reaches
// every operation that server has, whatever version the CLI is.
//
// The document is read in the order it is written (Go maps would lose it):
// operations list in the order the API declares them, and `describe` prints
// schemas with their keys where the API put them.

// excludedGroups are left out: the client API, which apps call as one of
// their end users with a publishable key.
var excludedGroups = []string{"sdk"}

var methods = []struct{ key, name string }{
	{"get", "GET"}, {"post", "POST"}, {"put", "PUT"}, {"patch", "PATCH"}, {"delete", "DELETE"},
}

// member is one key of a JSON object, with its value as it was written.
type member struct {
	key   string
	value json.RawMessage
}

// members reads a JSON object's keys in the order they are written. ok is
// false when raw is not an object.
func members(raw json.RawMessage) (list []member, ok bool) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if start, err := decoder.Token(); err != nil || start != json.Delim('{') {
		return nil, false
	}
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			return nil, false
		}
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			return nil, false
		}
		list = append(list, member{key: key.(string), value: value})
	}
	return list, true
}

func find(list []member, key string) (json.RawMessage, bool) {
	for _, item := range list {
		if item.key == key {
			return item.value, true
		}
	}
	return nil, false
}

// text is the string a JSON value holds; ok is false for anything else.
func text(raw json.RawMessage) (value string, ok bool) {
	if len(raw) == 0 || raw[0] != '"' {
		return "", false
	}
	return value, json.Unmarshal(raw, &value) == nil
}

// operation is one management operation of the API.
type operation struct {
	// id is the OpenAPI operation id, <group>.<endpoint>.
	id     string
	method string
	// path is the OpenAPI path template: /api/v1/projects/{projectId}/webhooks.
	path string
	// description and summary are empty when the document has none.
	description, summary string
	hasDescription       bool
	spec                 []member
}

// isProjectScoped reports whether the operation addresses one project.
func (o operation) isProjectScoped() bool { return strings.Contains(o.path, "{projectId}") }

var sentenceEnd = regexp.MustCompile(`\.\s`)

// line is the first sentence of the operation's summary or description.
func (o operation) line() string {
	whole := o.summary
	if whole == "" {
		whole = o.description
	}
	if end := sentenceEnd.FindStringIndex(whole); end != nil {
		return whole[:end[0]+1]
	}
	return whole
}

// catalog is the API's operations and the schemas they refer to.
type catalog struct {
	operations []operation
	schemas    map[string]json.RawMessage
}

// readCatalog reads an OpenAPI document.
func readCatalog(document []byte) (*catalog, error) {
	root, ok := members(document)
	if !ok {
		return nil, errors.New("it is not a JSON object")
	}
	rawPaths, _ := find(root, "paths")
	paths, ok := members(rawPaths)
	if !ok {
		return nil, errors.New(`it has no "paths"`)
	}
	read := &catalog{schemas: map[string]json.RawMessage{}}
	if rawComponents, ok := find(root, "components"); ok {
		components, _ := members(rawComponents)
		rawSchemas, _ := find(components, "schemas")
		schemas, _ := members(rawSchemas)
		for _, schema := range schemas {
			read.schemas[schema.key] = schema.value
		}
	}
	for _, path := range paths {
		item, _ := members(path.value)
		for _, method := range methods {
			raw, ok := find(item, method.key)
			if !ok {
				continue
			}
			spec, _ := members(raw)
			rawID, _ := find(spec, "operationId")
			id, ok := text(rawID)
			if !ok || slices.Contains(excludedGroups, strings.SplitN(id, ".", 2)[0]) {
				continue
			}
			found := operation{id: id, method: method.name, path: path.key, spec: spec}
			if raw, ok := find(spec, "description"); ok {
				found.description, found.hasDescription = text(raw)
			}
			if raw, ok := find(spec, "summary"); ok {
				found.summary, _ = text(raw)
			}
			read.operations = append(read.operations, found)
		}
	}
	return read, nil
}

func (c *catalog) find(id string) (operation, bool) {
	for _, candidate := range c.operations {
		if candidate.id == id {
			return candidate, true
		}
	}
	return operation{}, false
}

// search is the operations whose id, path or description holds every word.
func (c *catalog) search(words []string) []operation {
	var wanted []string
	for _, word := range words {
		wanted = append(wanted, strings.Fields(strings.ToLower(word))...)
	}
	var matches []operation
	for _, candidate := range c.operations {
		haystack := strings.ToLower(candidate.id + " " + candidate.path + " " + candidate.description)
		if !slices.ContainsFunc(wanted, func(word string) bool { return !strings.Contains(haystack, word) }) {
			matches = append(matches, candidate)
		}
	}
	return matches
}

// object writes a JSON object key by key, in the order given.
type object struct {
	buffer bytes.Buffer
}

func (o *object) set(key string, value json.RawMessage) {
	if o.buffer.Len() == 0 {
		o.buffer.WriteByte('{')
	} else {
		o.buffer.WriteByte(',')
	}
	o.buffer.Write(encode(key))
	o.buffer.WriteByte(':')
	o.buffer.Write(value)
}

func (o *object) raw() json.RawMessage {
	if o.buffer.Len() == 0 {
		return json.RawMessage("{}")
	}
	return append(bytes.Clone(o.buffer.Bytes()), '}')
}

// encode is value as JSON, with <, > and & left as they are.
func encode(value any) json.RawMessage {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	// The values are text, numbers and lists of raw JSON, which encode.
	_ = encoder.Encode(value)
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
}

var null = json.RawMessage("null")

// statusNumber is a response's status as a JSON number; null for `default`.
func statusNumber(status string) json.RawMessage {
	if _, err := strconv.Atoi(status); err != nil {
		return null
	}
	return json.RawMessage(status)
}

// jsonSchema is the schema of a body or response sent as JSON, or null.
func jsonSchema(carrier []member) json.RawMessage {
	rawContent, _ := find(carrier, "content")
	content, _ := members(rawContent)
	rawJSON, _ := find(content, "application/json")
	media, _ := members(rawJSON)
	if schema, ok := find(media, "schema"); ok {
		return schema
	}
	return null
}

// describe is everything needed to call the operation: its parameters, body
// and response schemas, possible errors, and the component schemas those
// refer to, directly or through other components.
func (c *catalog) describe(described operation) json.RawMessage {
	var pathParameters, queryParameters []json.RawMessage
	rawParameters, _ := find(described.spec, "parameters")
	var parameters []json.RawMessage
	_ = json.Unmarshal(rawParameters, &parameters)
	for _, parameter := range parameters {
		fields, _ := members(parameter)
		rawIn, _ := find(fields, "in")
		switch in, _ := text(rawIn); in {
		case "path":
			pathParameters = append(pathParameters, parameter)
		case "query":
			queryParameters = append(queryParameters, parameter)
		}
	}

	rawResponses, _ := find(described.spec, "responses")
	responses, _ := members(rawResponses)
	// Statuses in ascending order, then `default`, as the API lists them.
	slices.SortStableFunc(responses, func(a, b member) int {
		left, leftErr := strconv.Atoi(a.key)
		right, rightErr := strconv.Atoi(b.key)
		switch {
		case leftErr != nil && rightErr != nil:
			return 0
		case leftErr != nil:
			return 1
		case rightErr != nil:
			return -1
		}
		return left - right
	})
	response := null
	failures := []json.RawMessage{}
	succeeded := false
	for _, candidate := range responses {
		fields, _ := members(candidate.value)
		if strings.HasPrefix(candidate.key, "2") {
			if !succeeded {
				succeeded = true
				var success object
				success.set("status", statusNumber(candidate.key))
				success.set("schema", jsonSchema(fields))
				response = success.raw()
			}
			continue
		}
		var failure object
		failure.set("status", statusNumber(candidate.key))
		if description, ok := find(fields, "description"); ok {
			failure.set("errors", description)
		}
		failures = append(failures, failure.raw())
	}

	description := null
	if described.hasDescription {
		description = encode(described.description)
	}
	rawBody, _ := find(described.spec, "requestBody")
	requestBody, _ := members(rawBody)

	var shape object
	shape.set("operation", encode(described.id))
	shape.set("method", encode(described.method))
	shape.set("path", encode(described.path))
	shape.set("description", description)
	shape.set("pathParameters", list(pathParameters))
	shape.set("queryParameters", list(queryParameters))
	shape.set("body", jsonSchema(requestBody))
	shape.set("response", response)
	shape.set("errors", list(failures))
	shape.set("schemas", c.referenced(shape.raw()))
	return shape.raw()
}

func list(items []json.RawMessage) json.RawMessage {
	if len(items) == 0 {
		return json.RawMessage("[]")
	}
	return encode(items)
}

// referenced is the component schemas root refers to, directly or through
// other components, in the order they are first met.
func (c *catalog) referenced(root json.RawMessage) json.RawMessage {
	var found object
	seen := map[string]bool{}
	var visit func(value json.RawMessage)
	visit = func(value json.RawMessage) {
		value = bytes.TrimSpace(value)
		if len(value) == 0 {
			return
		}
		switch value[0] {
		case '[':
			var items []json.RawMessage
			_ = json.Unmarshal(value, &items)
			for _, item := range items {
				visit(item)
			}
		case '{':
			fields, _ := members(value)
			if rawRef, ok := find(fields, "$ref"); ok {
				if ref, ok := text(rawRef); ok {
					name := strings.Replace(ref, "#/components/schemas/", "", 1)
					if !seen[name] {
						seen[name] = true
						if schema, ok := c.schemas[name]; ok {
							found.set(name, schema)
							visit(schema)
						}
					}
				}
			}
			for _, field := range fields {
				visit(field.value)
			}
		}
	}
	visit(root)
	return found.raw()
}

// assignment is one name of repeated name=value flags, with its values in
// the order they were passed.
type assignment struct {
	name   string
	values []string
}

// parseAssignments groups name=value flag values by name, each name where
// it first appeared.
func parseAssignments(flag string, values []string) ([]assignment, error) {
	var assigned []assignment
	for _, value := range values {
		name, item, ok := strings.Cut(value, "=")
		if !ok || name == "" {
			return nil, fmt.Errorf("--%s takes name=value, got %q", flag, value)
		}
		index := slices.IndexFunc(assigned, func(existing assignment) bool { return existing.name == name })
		if index < 0 {
			assigned = append(assigned, assignment{name: name})
			index = len(assigned) - 1
		}
		assigned[index].values = append(assigned[index].values, item)
	}
	return assigned, nil
}

var pathParameter = regexp.MustCompile(`\{([^}]+)\}`)

// requestURL is the path and query of one call, without a host. projectID,
// when not empty, fills {projectId} unless the call passes it itself; a
// repeated path parameter keeps its last value.
func requestURL(called operation, pathParameters, query []assignment, projectID string) (string, error) {
	values := map[string]string{}
	if projectID != "" {
		values["projectId"] = projectID
	}
	for _, parameter := range pathParameters {
		values[parameter.name] = parameter.values[len(parameter.values)-1]
	}
	var missing []string
	for _, match := range pathParameter.FindAllStringSubmatch(called.path, -1) {
		if values[match[1]] == "" {
			missing = append(missing, match[1])
		}
	}
	if len(missing) > 0 {
		return "", fmt.Errorf("%s needs the path parameters %s", called.id, strings.Join(missing, ", "))
	}
	path := pathParameter.ReplaceAllStringFunc(called.path, func(placeholder string) string {
		return url.PathEscape(values[placeholder[1:len(placeholder)-1]])
	})
	var pairs []string
	for _, parameter := range query {
		for _, value := range parameter.values {
			pairs = append(pairs, url.QueryEscape(parameter.name)+"="+url.QueryEscape(value))
		}
	}
	if len(pairs) == 0 {
		return path, nil
	}
	return path + "?" + strings.Join(pairs, "&"), nil
}
