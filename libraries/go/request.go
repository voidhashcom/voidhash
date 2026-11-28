package voidhash

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// call executes an API call, decoding a successful JSON body into out (which
// may be nil) and mapping failures to [*APIError].
func (c *Client) call(out any, send func() (*http.Response, error)) error {
	resp, err := send()
	if err != nil {
		return fmt.Errorf("voidhash: request failed: %w", err)
	}
	body, err := ReadResponse(resp)
	if err != nil {
		return err
	}

	if out == nil || len(bytes.TrimSpace(body)) == 0 {
		return nil
	}

	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("voidhash: decoding response: %w", err)
	}
	return nil
}

// ReadResponse reads and closes the body of a response from the generated
// client (see [Client.API]). It returns the body of a 2xx response, which is
// empty for one without content, and an [*APIError] for any other status.
func ReadResponse(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("voidhash: reading response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, newAPIError(resp, body)
	}
	return body, nil
}

// page is the envelope every list endpoint returns.
type page[T any] struct {
	Data     []T          `json:"data"`
	PageInfo api.PageInfo `json:"pageInfo"`
}

// listAll follows a list endpoint's cursor until the last page and returns
// every item. fetch requests the page after cursor, which is nil for the first
// page.
func listAll[T any](c *Client, fetch func(cursor *string) (*http.Response, error)) ([]T, error) {
	items := []T{}
	var cursor *string
	seen := map[string]bool{}
	for {
		current := page[T]{}
		err := c.call(&current, func() (*http.Response, error) {
			return fetch(cursor)
		})
		if err != nil {
			return nil, err
		}
		items = append(items, current.Data...)
		if !current.PageInfo.HasNextPage {
			return items, nil
		}
		next := current.PageInfo.EndCursor
		if next == nil || seen[*next] {
			return nil, fmt.Errorf("voidhash: paginated response did not advance its cursor")
		}
		seen[*next] = true
		cursor = next
	}
}
