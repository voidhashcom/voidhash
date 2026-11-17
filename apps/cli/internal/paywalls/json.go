package paywalls

import (
	"bytes"
	"encoding/json"
	"io"
)

// JSONContentType is the content type of a [JSONBody].
const JSONContentType = "application/json"

// JSONBody is value as a request body. Commands build bodies as maps where a
// field left out and a field sent as null mean different things to the API:
// "keep it" and "clear it".
func JSONBody(value any) io.Reader {
	encoded, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return bytes.NewReader(encoded)
}

// Member is one member added to an API object by [ExtendObject].
type Member struct {
	Key string
	// Value is the member's JSON; nil is written as null.
	Value json.RawMessage
}

// ExtendObject is the API object raw with members added after its own, for
// a view that prints an object together with what belongs to it. The
// object's own JSON stays as the server sent it.
func ExtendObject(raw json.RawMessage, members ...Member) json.RawMessage {
	var out bytes.Buffer
	trimmed := bytes.TrimSpace(raw)
	out.Write(bytes.TrimSuffix(trimmed, []byte("}")))
	empty := len(bytes.TrimSpace(bytes.TrimPrefix(bytes.TrimSuffix(trimmed, []byte("}")), []byte("{")))) == 0
	for _, member := range members {
		if !empty {
			out.WriteByte(',')
		}
		empty = false
		key, _ := json.Marshal(member.Key)
		out.Write(key)
		out.WriteByte(':')
		if member.Value == nil {
			out.WriteString("null")
		} else {
			out.Write(member.Value)
		}
	}
	out.WriteByte('}')
	return out.Bytes()
}
