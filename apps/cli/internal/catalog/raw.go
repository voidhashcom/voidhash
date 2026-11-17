package catalog

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// RawField is one field added to an API object for --json: a name and its
// JSON value.
type RawField struct {
	Name  string
	Value json.RawMessage
}

// Extend returns the JSON object raw with fields added after its own, so
// --json of a combined view keeps the server's object as it was sent.
func Extend(raw json.RawMessage, fields ...RawField) json.RawMessage {
	var out bytes.Buffer
	body := bytes.TrimSuffix(bytes.TrimSpace(raw), []byte("}"))
	out.Write(body)
	isEmpty := len(bytes.TrimSpace(bytes.TrimPrefix(body, []byte("{")))) == 0
	for index, field := range fields {
		if index > 0 || !isEmpty {
			out.WriteByte(',')
		}
		name, _ := json.Marshal(field.Name)
		out.Write(name)
		out.WriteByte(':')
		out.Write(field.Value)
	}
	out.WriteByte('}')
	return out.Bytes()
}

// RawObject is the JSON object of fields, in order.
func RawObject(fields ...RawField) json.RawMessage {
	return Extend(json.RawMessage("{}"), fields...)
}

// RawArray is the JSON array of items, in order.
func RawArray(items []json.RawMessage) json.RawMessage {
	return cli.List[struct{}]{Raw: items}.RawJSON()
}

// Encoded is value as JSON, for a field of [Extend] the command made itself.
func Encoded(value any) json.RawMessage {
	raw, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return raw
}

func objectOf[T any](kind cli.ItemKind[T], list cli.List[T], item T) cli.Object[T] {
	for index, candidate := range list.Items {
		if kind.ID(candidate) == kind.ID(item) && index < len(list.Raw) {
			return list.Object(index)
		}
	}
	return cli.NewObject(item)
}

// Find returns the item of list that input names, as the server sent it;
// see [cli.FindItem].
func Find[T any](kind cli.ItemKind[T], list cli.List[T], input string) (cli.Object[T], error) {
	item, err := cli.FindItem(kind, list.Items, input)
	if err != nil {
		return cli.Object[T]{}, err
	}
	return objectOf(kind, list, item), nil
}

// Require returns the item of list a command's argument names, as the
// server sent it, asking for it on a terminal; see [cli.RequireItem].
func Require[T any](ctx context.Context, app *cli.App, kind cli.ItemKind[T], list cli.List[T], input, usage string) (cli.Object[T], error) {
	item, err := cli.RequireItem(ctx, app, kind, list.Items, input, usage)
	if err != nil {
		return cli.Object[T]{}, err
	}
	return objectOf(kind, list, item), nil
}

// Append adds an object to a list, keeping its raw JSON.
func Append[T any](list cli.List[T], object cli.Object[T]) cli.List[T] {
	return cli.List[T]{Items: append(list.Items, object.Value), Raw: append(list.Raw, object.Raw)}
}
