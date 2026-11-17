package devserver

import (
	"bytes"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func writeJSON(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// Handler serves the dev server's routes over state, for requests carrying
// token as `Authorization: Bearer <token>`:
//
//	GET /v1/status          the status of every component
//	GET /v1/modules/<hash>  a built component module
//	GET /v1/panels/<hash>   a built editor panel module
//
// Browsers preflight every path, so OPTIONS answers on any; everything else
// is unknown. Every answer allows any origin: the token, not the origin,
// authorizes.
func Handler(state *State, token string) http.Handler {
	notFound := func(w http.ResponseWriter) { writeJSON(w, http.StatusNotFound, []byte(`{"error":"not found"}`)) }
	authorized := func(r *http.Request) bool {
		bearer, isBearer := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		// An empty token never authorizes, even against a server given one.
		return isBearer && bearer != "" && subtle.ConstantTimeCompare([]byte(bearer), []byte(token)) == 1
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		kind, hash := "", ""
		if rest, ok := strings.CutPrefix(r.URL.Path, "/v1/modules/"); ok {
			kind, hash = "module", rest
		} else if rest, ok := strings.CutPrefix(r.URL.Path, "/v1/panels/"); ok {
			kind, hash = "panel", rest
		}
		isRoute := r.URL.Path == "/v1/status" || (kind != "" && hash != "" && !strings.Contains(hash, "/"))
		switch {
		case r.Method == http.MethodGet && isRoute && !authorized(r):
			writeJSON(w, http.StatusUnauthorized, []byte(`{"error":"unauthorized"}`))
		case r.Method == http.MethodGet && r.URL.Path == "/v1/status":
			var body bytes.Buffer
			encoder := json.NewEncoder(&body)
			encoder.SetEscapeHTML(false)
			if err := encoder.Encode(state.Status()); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			writeJSON(w, http.StatusOK, bytes.TrimSuffix(body.Bytes(), []byte("\n")))
		case r.Method == http.MethodGet && isRoute:
			module, found := state.module(kind, hash)
			if !found {
				notFound(w)
				return
			}
			w.Header().Set("Content-Type", "application/wasm")
			w.Header().Set("Content-Length", strconv.Itoa(len(module)))
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			_, _ = w.Write(module)
		case r.Method == http.MethodOptions:
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "authorization")
			w.Header().Set("Access-Control-Allow-Private-Network", "true")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
		default:
			notFound(w)
		}
	})
}
