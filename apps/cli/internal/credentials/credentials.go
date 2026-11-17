package credentials

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
)

// Credential is the token the CLI sends to one API origin, and where it came
// from.
type Credential struct {
	Token  string
	Source Source
	Origin string
}

// DescribeSource is how a credential's source reads after "from": "the
// macOS keychain".
func DescribeSource(source Source, filePath string) string {
	switch source {
	case SourceEnvironment:
		return "the VOIDHASH_API_KEY environment variable"
	case SourceKeychain:
		return "the macOS keychain"
	case SourceSecretService:
		return "the Secret Service keyring"
	default:
		return filePath
	}
}

var tokenPrefix = regexp.MustCompile(`^[a-z]+_[a-z]+_`)

// MaskToken shows a token without its secret part: vh_oat_…3f9a.
func MaskToken(token string) string {
	prefix := tokenPrefix.FindString(token)
	if len(token)-len(prefix) > 8 {
		return prefix + "…" + token[len(token)-4:]
	}
	return prefix + "…"
}

var projectKey = regexp.MustCompile(`^vh_[sp]k_`)

// IsSessionToken reports whether token is a sign-in that revocation ends.
// As on the server, that is every key but a project key (vh_sk_…, vh_pk_…):
// a token from `login` (vh_oat_…), a key an earlier version of the CLI
// signed in with (vh_cli_…), or a personal key from before sessions, whose
// prefix may be its own.
func IsSessionToken(token string) bool {
	return !projectKey.MatchString(token)
}

// Credentials decides which credential a request carries: VOIDHASH_API_KEY
// when it is set, else the token stored for the API origin. A stored token
// is looked up once per origin per run, since that may run a keychain tool.
// It is safe for concurrent use: one lock covers the cache and the store,
// so requests sent together wait for a single lookup.
type Credentials struct {
	store *Store
	// environmentKey is VOIDHASH_API_KEY, when set.
	environmentKey string
	mu             sync.Mutex
	cache          map[string]*Credential
}

// New creates the credentials of a run. environmentKey is the value of
// VOIDHASH_API_KEY.
func New(store *Store, environmentKey string) *Credentials {
	if strings.TrimSpace(environmentKey) == "" {
		environmentKey = ""
	}
	return &Credentials{store: store, environmentKey: environmentKey, cache: map[string]*Credential{}}
}

// EnvironmentKey is VOIDHASH_API_KEY, or empty when it is not set.
func (c *Credentials) EnvironmentKey() string { return c.environmentKey }

// Store is the store the tokens are kept in.
func (c *Credentials) Store() *Store { return c.store }

// Stored returns the token stored for apiURL's origin, ignoring
// VOIDHASH_API_KEY, or nil when there is none. A credential is only ever
// looked up for the origin it will be sent to.
func (c *Credentials) Stored(ctx context.Context, apiURL string) (*Credential, error) {
	origin, ok := Origin(apiURL)
	if !ok {
		return nil, fmt.Errorf("The API URL %s is not a valid URL", apiURL)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lookUp(ctx, origin)
}

func (c *Credentials) lookUp(ctx context.Context, origin string) (*Credential, error) {
	if cached, ok := c.cache[origin]; ok {
		return cached, nil
	}
	stored, err := c.store.Get(ctx, origin)
	if err != nil {
		return nil, err
	}
	var credential *Credential
	if stored != nil {
		credential = &Credential{Token: stored.Token, Source: stored.Source, Origin: origin}
	}
	c.cache[origin] = credential
	return credential, nil
}

// Resolve returns the credential a request to apiURL carries, or nil:
// VOIDHASH_API_KEY, then the stored token.
func (c *Credentials) Resolve(ctx context.Context, apiURL string) (*Credential, error) {
	if c.environmentKey != "" {
		origin, ok := Origin(apiURL)
		if !ok {
			origin = apiURL
		}
		return &Credential{Token: c.environmentKey, Source: SourceEnvironment, Origin: origin}, nil
	}
	return c.Stored(ctx, apiURL)
}

// Reload is Resolve, reading the stored token again instead of the one this
// run looked up before: another run may have signed in since, which ended
// the earlier token's session.
func (c *Credentials) Reload(ctx context.Context, apiURL string) (*Credential, error) {
	origin, ok := Origin(apiURL)
	if c.environmentKey != "" || !ok {
		return c.Resolve(ctx, apiURL)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, origin)
	return c.lookUp(ctx, origin)
}

// Save stores token for apiURL's origin, replacing the one stored before.
func (c *Credentials) Save(ctx context.Context, apiURL, token string) (*Credential, error) {
	origin, ok := Origin(apiURL)
	if !ok {
		return nil, fmt.Errorf("The API URL %s is not a valid URL", apiURL)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	source, err := c.store.Set(ctx, origin, token)
	if err != nil {
		return nil, err
	}
	credential := &Credential{Token: token, Source: source, Origin: origin}
	c.cache[origin] = credential
	return credential, nil
}

// Forget deletes credential, a token Stored returned. It fails when the
// token could not be deleted from where it was found.
func (c *Credentials) Forget(ctx context.Context, credential *Credential) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.store.Remove(ctx, credential.Origin, credential.Source); err != nil {
		return err
	}
	c.cache[credential.Origin] = nil
	return nil
}
