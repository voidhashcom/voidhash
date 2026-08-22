package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	voidhash "github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash-go/api"
)

const (
	// proPerkSlug is the perk every paid Nimbus product grants.
	proPerkSlug = "pro"
	// entitlementTTL is how long a resolved access answer is reused. The check
	// sits on every write path, so it must not become one API call per request.
	entitlementTTL = 60 * time.Second
)

// errPerkNotConfigured means the project has no perk with [proPerkSlug]. That
// is a configuration mistake, not a transient failure, so it never turns into
// a retry.
var errPerkNotConfigured = fmt.Errorf("no perk with slug %q exists in this Voidhash project", proPerkSlug)

// Access is the resolved entitlement state of one person.
type Access struct {
	DistinctID string
	// Person is the Voidhash person record, or nil when the distinct id is one
	// Voidhash has never seen.
	Person *voidhash.Person
	// Pro reports an active grant for the "pro" perk.
	Pro bool
	// Grants is every grant Voidhash returned, not just the Pro one.
	Grants []voidhash.EntitlementGrant
	// ResolvedAt is when the underlying answer was read from Voidhash.
	ResolvedAt time.Time
	// Stale is true when Voidhash was unreachable and this answer came out of
	// an expired cache entry.
	Stale bool
}

// Plan is the person's `plan` attribute value: "pro" or "free".
func (a Access) Plan() string {
	if a.Pro {
		return "pro"
	}
	return "free"
}

// NoteLimit is the value to pass to [noteStore.Create].
func (a Access) NoteLimit() int {
	if a.Pro {
		return unlimitedNotes
	}
	return freeNoteLimit
}

type cacheEntry struct {
	access    Access
	expiresAt time.Time
}

// entitlementCache is a short read-through cache over the Voidhash access
// check. It caches the person record alongside the grants, because grants are
// resolved through the person anyway and a route showing both should show one
// consistent snapshot rather than a fresh person next to stale grants.
//
// Its real job is the failure policy. A 404 means "Voidhash has never seen
// this distinct id", which is a free user and a perfectly good answer. A
// transport error or a 5xx means the state is *unknown*, which is not the same
// thing: rather than revoking a paying customer because a network hiccup
// looked like "no grants", the last known answer is served stale and the
// caller is told so.
type entitlementCache struct {
	client *voidhash.Client
	logger *slog.Logger
	ttl    time.Duration

	mu      sync.Mutex
	entries map[string]cacheEntry

	perkMu sync.Mutex
	perkID string
}

func newEntitlementCache(client *voidhash.Client, logger *slog.Logger, ttl time.Duration) *entitlementCache {
	return &entitlementCache{
		client:  client,
		logger:  logger,
		ttl:     ttl,
		entries: map[string]cacheEntry{},
	}
}

// Access resolves the person's entitlement state, serving a cached answer when
// one is fresh. The returned error is only ever a failure the caller cannot
// paper over: an unknown distinct id resolves to a free user.
func (c *entitlementCache) Access(ctx context.Context, distinctID string) (Access, error) {
	now := time.Now()
	if entry, ok := c.lookup(distinctID); ok && now.Before(entry.expiresAt) {
		return entry.access, nil
	}

	perkID, err := c.resolveProPerkID(ctx)
	if err != nil {
		return c.fallback(distinctID, err)
	}

	access := Access{DistinctID: distinctID, ResolvedAt: now}

	person, err := c.client.Persons.GetByDistinctID(ctx, distinctID)
	switch {
	case err == nil:
		access.Person = person
	case voidhash.IsNotFound(err):
		// A distinct id Voidhash has never seen is a free user, not an error.
		// Nobody has identified with it yet, so there is nothing to grant.
		c.store(distinctID, cacheEntry{access: access, expiresAt: now.Add(c.ttl)})
		return access, nil
	default:
		return c.fallback(distinctID, fmt.Errorf("resolving person %q: %w", distinctID, err))
	}

	grants, err := c.client.Persons.Entitlements.GrantsByDistinctID(ctx, distinctID)
	if err != nil {
		return c.fallback(distinctID, fmt.Errorf("resolving entitlements for %q: %w", distinctID, err))
	}

	access.Grants = grants
	access.Pro = holdsActivePerk(grants, perkID, now)
	c.store(distinctID, cacheEntry{access: access, expiresAt: now.Add(c.ttl)})
	return access, nil
}

// Invalidate drops the cached answer for a person, so the next request reads
// Voidhash again instead of waiting out the TTL. Webhooks call this the moment
// a purchase or subscription changes.
func (c *entitlementCache) Invalidate(distinctID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, distinctID)
}

// fallback applies the "failure is not a denial" rule: serve the expired entry
// when the failure left the state unknown, and surface the error otherwise.
func (c *entitlementCache) fallback(distinctID string, err error) (Access, error) {
	if !isUnknownFailure(err) {
		return Access{DistinctID: distinctID}, err
	}
	entry, ok := c.lookup(distinctID)
	if !ok {
		return Access{DistinctID: distinctID}, err
	}
	c.logger.Warn("serving stale entitlements",
		"distinctId", distinctID,
		"resolvedAt", entry.access.ResolvedAt,
		"error", err,
	)
	stale := entry.access
	stale.Stale = true
	return stale, nil
}

func (c *entitlementCache) lookup(distinctID string) (cacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[distinctID]
	return entry, ok
}

func (c *entitlementCache) store(distinctID string, entry cacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[distinctID] = entry
}

// resolveProPerkID maps the "pro" slug to its perk id. Perk ids never change,
// so the lookup happens once per process; the lock is held across the call on
// purpose, so a cold-start burst issues one request rather than one each.
//
// The SDK also offers client.Persons.Entitlements.HasActivePerk with a
// PerkSlug, which does this same lookup internally. It is the right call for a
// one-off check; here the perk id is needed alongside the full grant list, and
// re-listing every perk on every request is not something to put on a hot path.
func (c *entitlementCache) resolveProPerkID(ctx context.Context) (string, error) {
	c.perkMu.Lock()
	defer c.perkMu.Unlock()

	if c.perkID != "" {
		return c.perkID, nil
	}
	perks, err := c.client.Perks.List(ctx)
	if err != nil {
		return "", fmt.Errorf("listing perks: %w", err)
	}
	for _, perk := range perks {
		if perk.Slug == proPerkSlug {
			c.perkID = perk.Id
			return perk.Id, nil
		}
	}
	return "", errPerkNotConfigured
}

func holdsActivePerk(grants []voidhash.EntitlementGrant, perkID string, now time.Time) bool {
	for _, grant := range grants {
		if grant.PerkId == perkID && grantIsActive(grant, now) {
			return true
		}
	}
	return false
}

// grantIsActive re-checks the expiry locally because a cached answer can
// outlive the grant it describes: Voidhash said "active" up to a minute ago.
func grantIsActive(grant voidhash.EntitlementGrant, now time.Time) bool {
	if grant.Status != api.SdkEntitlementGrantJsonEncodingStatusActive {
		return false
	}
	if grant.ExpiresAt == nil {
		return true
	}
	expiresAt, err := time.Parse(time.RFC3339, *grant.ExpiresAt)
	if err != nil {
		// An expiry we cannot parse is not grounds for revoking access; trust
		// the status Voidhash sent.
		return true
	}
	return expiresAt.After(now)
}

// isUnknownFailure reports whether err leaves the true state unknown rather
// than answering the question. A transport failure carries no status code, and
// a 5xx is the server admitting it could not answer either; every other status
// is a real answer from Voidhash.
func isUnknownFailure(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, errPerkNotConfigured) {
		return false
	}
	status := voidhash.StatusCode(err)
	return status == 0 || status >= 500
}
