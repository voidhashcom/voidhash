package voidhash

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/voidhashcom/voidhash-go/api"
)

// invoker matches the shape of every generated client method.
type invoker func(reqEditors ...api.RequestEditorFn) (*http.Response, error)

// call executes an API call, decoding a successful JSON body into out (which
// may be nil) and mapping failures to [*APIError].
func (c *Client) call(out any, invoke invoker) error {
	resp, err := invoke()
	if err != nil {
		return fmt.Errorf("voidhash: request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("voidhash: reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return newAPIError(resp.StatusCode, body)
	}

	if out == nil || len(bytes.TrimSpace(body)) == 0 {
		return nil
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("voidhash: decoding response: %w", err)
	}
	return nil
}
