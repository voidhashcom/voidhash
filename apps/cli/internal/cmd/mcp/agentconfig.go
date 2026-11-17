package mcp

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
)

// How the Voidhash MCP server is added to agents' configuration. Nothing
// secret is written: an agent signs in through the person's browser on its
// first request and then acts as them.

// serverName is the name agents list Voidhash under.
const serverName = "voidhash"

// serverURL is the MCP endpoint of the API at apiURL.
func serverURL(apiURL string) string {
	return strings.TrimRight(apiURL, "/") + "/api/mcp"
}

var errNotAnObject = errors.New("not a JSON object")

// member is one key of a JSON object, with its value as it was written.
type member struct {
	key   string
	value json.RawMessage
}

// members reads a JSON object's keys in the order they are written, so a
// person's file keeps its order when one key changes.
func members(raw []byte) ([]member, error) {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if start, err := decoder.Token(); err != nil || start != json.Delim('{') {
		return nil, errNotAnObject
	}
	var list []member
	for decoder.More() {
		key, err := decoder.Token()
		if err != nil {
			return nil, errNotAnObject
		}
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			return nil, errNotAnObject
		}
		list = append(list, member{key: key.(string), value: value})
	}
	if _, err := decoder.Token(); err != nil {
		return nil, errNotAnObject
	}
	if decoder.More() {
		return nil, errNotAnObject
	}
	return list, nil
}

// with returns list with key set to value: in place when it is there, at
// the end otherwise.
func with(list []member, key string, value json.RawMessage) []member {
	for index := range list {
		if list[index].key == key {
			list[index].value = value
			return list
		}
	}
	return append(list, member{key: key, value: value})
}

func encodeObject(list []member) json.RawMessage {
	var out bytes.Buffer
	out.WriteByte('{')
	for index, item := range list {
		if index > 0 {
			out.WriteByte(',')
		}
		out.Write(encodeText(item.key))
		out.WriteByte(':')
		out.Write(item.value)
	}
	out.WriteByte('}')
	return out.Bytes()
}

func encodeText(text string) []byte {
	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	// Text always encodes.
	_ = encoder.Encode(text)
	return bytes.TrimSuffix(out.Bytes(), []byte("\n"))
}

// withCursorServer is Cursor's mcp.json with the Voidhash server set to
// url, keeping every other server and setting. It fails when the existing
// file is not a JSON object, rather than overwriting it.
func withCursorServer(existing, url string) (string, error) {
	var config []member
	if existing != "" {
		read, err := members([]byte(existing))
		if err != nil {
			return "", err
		}
		config = read
	}
	var servers []member
	for _, item := range config {
		if item.key == "mcpServers" {
			// Servers that are not an object are replaced, as nothing in
			// them can be kept.
			servers, _ = members(item.value)
		}
	}
	server := encodeObject([]member{{key: "url", value: encodeText(url)}})
	config = with(config, "mcpServers", encodeObject(with(servers, serverName, server)))

	var out bytes.Buffer
	if err := json.Indent(&out, encodeObject(config), "", "  "); err != nil {
		return "", err
	}
	return out.String() + "\n", nil
}

// withCodexServer is Codex's config.toml with a Voidhash server section
// added. changed is false when one is already there: it is left as the
// person configured it.
func withCodexServer(existing, url string) (content string, changed bool) {
	header := "[mcp_servers." + serverName + "]"
	for _, line := range strings.Split(existing, "\n") {
		if strings.TrimSpace(line) == header {
			return existing, false
		}
	}
	separator := "\n\n"
	switch {
	case existing == "" || strings.HasSuffix(existing, "\n\n"):
		separator = ""
	case strings.HasSuffix(existing, "\n"):
		separator = "\n"
	}
	return existing + separator + header + "\nurl = \"" + url + "\"\n", true
}

// vscodeServer is the JSON VS Code's --add-mcp flag takes.
func vscodeServer(url string) string {
	return string(encodeObject([]member{
		{key: "name", value: encodeText(serverName)},
		{key: "type", value: encodeText("http")},
		{key: "url", value: encodeText(url)},
	}))
}
