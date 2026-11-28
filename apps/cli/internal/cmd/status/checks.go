package status

import (
	"fmt"
	"strings"
)

// The states of one part of a project's setup.
const (
	stateOK        = "ok"
	stateAttention = "attention"
	stateProblem   = "problem"
	stateUnknown   = "unknown"
)

// check is one line of the health report, with the command that fixes it.
type check struct {
	Name    string `json:"name"`
	State   string `json:"state"`
	Summary string `json:"summary"`
	// Next is what to do about it; empty when nothing needs doing.
	Next string `json:"next,omitempty"`
}

// provider is a payment provider, by what the checks read of it.
type provider struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Name      string `json:"name"`
	IsEnabled bool   `json:"isEnabled"`
	// ConnectionCheck is a store's last check of its credentials with the
	// store; nil until checked.
	ConnectionCheck *connectionCheck `json:"connectionCheck"`
}

// connectionCheck is what a store said when its credentials were checked:
// working, failing, pending (waiting on the store) or unverified.
type connectionCheck struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// connectionIs reports whether the provider's last check found status.
func (p provider) connectionIs(status string) bool {
	return p.ConnectionCheck != nil && p.ConnectionCheck.Status == status
}

var storeLabels = map[string]string{"app_store": "App Store", "google_play": "Google Play", "stripe": "Stripe"}

// label is the provider as people know it: the store, or a payment
// source's own name.
func (p provider) label() string {
	if label, ok := storeLabels[p.Type]; ok {
		return label
	}
	return p.Name
}

func labels(providers []provider) string {
	names := make([]string, len(providers))
	for index, item := range providers {
		names[index] = item.label()
	}
	return strings.Join(names, ", ")
}

// storesCheck says whether a store is connected to take purchases.
func storesCheck(providers []provider) check {
	var enabled, off []provider
	for _, item := range providers {
		if item.IsEnabled {
			enabled = append(enabled, item)
		} else {
			off = append(off, item)
		}
	}
	var failing, waiting []provider
	for _, item := range enabled {
		if item.connectionIs("failing") {
			failing = append(failing, item)
		} else if item.connectionIs("pending") {
			waiting = append(waiting, item)
		}
	}
	switch {
	case len(failing) > 0:
		return check{Name: "Stores", State: stateProblem,
			Summary: labels(enabled) + " connected; " + labels(failing) + " failing its connection check",
			Next:    failing[0].label() + ": " + failing[0].ConnectionCheck.Message}
	case len(waiting) > 0:
		return check{Name: "Stores", State: stateAttention,
			Summary: labels(enabled) + " connected; " + labels(waiting) + " waiting on the store",
			Next:    waiting[0].label() + ": " + waiting[0].ConnectionCheck.Message}
	case len(enabled) == 0 && len(off) == 0:
		return check{Name: "Stores", State: stateProblem, Summary: "none connected",
			Next: "Connect a store: 'voidhash provider connect app-store' (or google-play, stripe)"}
	case len(enabled) == 0:
		return check{Name: "Stores", State: stateProblem, Summary: labels(off) + " turned off",
			Next: "Connect a store: 'voidhash provider connect app-store' (or google-play, stripe)"}
	case len(off) == 0:
		return check{Name: "Stores", State: stateOK, Summary: labels(enabled) + " connected"}
	}
	return check{Name: "Stores", State: stateAttention, Summary: labels(enabled) + " connected; " + labels(off) + " turned off",
		Next: "voidhash provider list"}
}

// product is a product, and mapping a store product mapped to one.
type product struct {
	ID   string `json:"id"`
	Slug string `json:"slug"`
}

type mapping struct {
	ProductID string `json:"productId"`
	IsActive  bool   `json:"isActive"`
}

// productsCheck says whether there are products, each sold as a store
// product.
func productsCheck(products []product, mappings []mapping) check {
	if len(products) == 0 {
		return check{Name: "Products", State: stateProblem, Summary: "none yet", Next: "voidhash product create"}
	}
	var unmapped []string
	for _, item := range products {
		mapped := false
		for _, candidate := range mappings {
			mapped = mapped || (candidate.ProductID == item.ID && candidate.IsActive)
		}
		if !mapped {
			unmapped = append(unmapped, item.Slug)
		}
	}
	if len(unmapped) == 0 {
		return check{Name: "Products", State: stateOK, Summary: fmt.Sprintf("%d, each mapped to a store product", len(products))}
	}
	them := "them"
	if len(unmapped) == 1 {
		them = "it"
	}
	return check{
		Name:    "Products",
		State:   stateAttention,
		Summary: fmt.Sprintf("%d of %d not mapped to a store product: %s", len(unmapped), len(products), strings.Join(unmapped, ", ")),
		Next:    fmt.Sprintf("Map %s to store products: 'voidhash provider products --unmapped', then 'voidhash provider map <store-product> %s'", them, unmapped[0]),
	}
}

// waitingProduct is a store product purchases came in for that no product
// is mapped to.
type waitingProduct struct {
	ProviderProductKey string `json:"providerProductKey"`
	EventCount         int    `json:"eventCount"`
}

func plural(count int, noun string) string {
	if count == 1 {
		return noun
	}
	return noun + "s"
}

// waitingPurchasesCheck says whether store purchases wait for a product to
// be mapped to their store product.
func waitingPurchasesCheck(waiting []waitingProduct) check {
	if len(waiting) == 0 {
		return check{Name: "Purchases", State: stateOK, Summary: "none waiting for a product"}
	}
	var shown []string
	for index, item := range waiting {
		if index == 3 {
			shown = append(shown, "…")
			break
		}
		shown = append(shown, fmt.Sprintf("%s (%d %s)", item.ProviderProductKey, item.EventCount, plural(item.EventCount, "event")))
	}
	return check{
		Name:    "Purchases",
		State:   stateAttention,
		Summary: fmt.Sprintf("waiting on %d unmapped store %s: %s", len(waiting), plural(len(waiting), "product"), strings.Join(shown, ", ")),
		Next:    "Map them to products: 'voidhash provider products --unmapped' lists them, 'voidhash provider map <store-product> <product>' maps one",
	}
}

// trackingHealth is what the SDKs reported in the last seven days.
type trackingHealth struct {
	Apps []struct {
		Platform    string       `json:"platform"`
		LastEventAt string       `json:"lastEventAt"`
		SDKVersions []sdkVersion `json:"sdkVersions"`
	} `json:"apps"`
	Web struct {
		LastEventAt *string      `json:"lastEventAt"`
		SDKVersions []sdkVersion `json:"sdkVersions"`
	} `json:"web"`
}

type sdkVersion struct {
	Version *string `json:"version"`
}

// sdkCheck says whether the SDKs reported events in the last seven days,
// and when each platform last did. timeAgo words a time relative to now.
func sdkCheck(health trackingHealth, timeAgo func(iso string) string) check {
	describe := func(name, lastEventAt string, versions []sdkVersion) string {
		seen := name + " " + timeAgo(lastEventAt)
		if len(versions) > 0 && versions[0].Version != nil {
			seen += " (SDK " + *versions[0].Version + ")"
		}
		return seen
	}
	var platforms []string
	for _, app := range health.Apps {
		name := "Android"
		if app.Platform == "ios" {
			name = "iOS"
		}
		platforms = append(platforms, describe(name, app.LastEventAt, app.SDKVersions))
	}
	if health.Web.LastEventAt != nil {
		platforms = append(platforms, describe("web", *health.Web.LastEventAt, health.Web.SDKVersions))
	}
	if len(platforms) == 0 {
		return check{Name: "SDK events", State: stateProblem, Summary: "none in the last 7 days",
			Next: "Set up the SDK in your app ('voidhash init' in its root), then open the app"}
	}
	return check{Name: "SDK events", State: stateOK, Summary: strings.Join(platforms, ", ")}
}

type webhook struct {
	Name                string `json:"name"`
	Status              string `json:"status"`
	ConsecutiveFailures int    `json:"consecutiveFailures"`
}

// webhooksCheck says whether the webhooks deliver.
func webhooksCheck(webhooks []webhook) check {
	var failing []string
	active := 0
	for _, item := range webhooks {
		if item.Status == "failed" || item.ConsecutiveFailures > 0 {
			failing = append(failing, fmt.Sprintf("%s failing (%d deliveries in a row)", item.Name, item.ConsecutiveFailures))
		}
		if item.Status == "active" {
			active++
		}
	}
	switch {
	case len(failing) > 0:
		return check{Name: "Webhooks", State: stateProblem, Summary: strings.Join(failing, ", "),
			Next: "See how it answered with 'voidhash webhook deliveries --failed'; once it is fixed, 'voidhash webhook retry' sends what gave up"}
	case len(webhooks) == 0:
		return check{Name: "Webhooks", State: stateOK, Summary: "none set up"}
	case len(webhooks) > active:
		return check{Name: "Webhooks", State: stateOK, Summary: fmt.Sprintf("%d delivering, %d turned off", active, len(webhooks)-active)}
	}
	return check{Name: "Webhooks", State: stateOK, Summary: fmt.Sprintf("%d delivering", active)}
}

// nextStep is what to do first: the fix of the first problem, else of the
// first thing needing attention. It is empty when everything is set up.
func nextStep(checks []check) string {
	for _, state := range []string{stateProblem, stateAttention} {
		for _, item := range checks {
			if item.State == state && item.Next != "" {
				return item.Next
			}
		}
	}
	return ""
}
