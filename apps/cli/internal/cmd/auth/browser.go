package auth

import (
	"context"
	"net/url"
	"regexp"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
)

// printableURL is an address from the server, as printed: the URL's own
// serialization, which escapes anything a terminal could act on, or
// printable text when it is not a URL.
func printableURL(uri string) string {
	parsed, err := url.Parse(uri)
	if err != nil || parsed.Scheme == "" {
		return cli.Printable(uri)
	}
	return cli.Printable(parsed.String())
}

// shouldOpenBrowser decides whether `voidhash login` opens the browser: not
// with --no-browser, over SSH, or on a Linux or BSD machine without a
// graphical display.
func shouldOpenBrowser(noBrowser bool, goos string, getenv func(string) string) bool {
	switch {
	case noBrowser:
		return false
	case getenv("SSH_CONNECTION") != "" || getenv("SSH_TTY") != "":
		return false
	case goos == "darwin" || goos == "windows":
		return true
	default:
		return getenv("DISPLAY") != "" || getenv("WAYLAND_DISPLAY") != ""
	}
}

// Hosts plain HTTP may reach: this computer, as when a local server runs
// the dashboard.
func isLoopback(parsed *url.URL) bool {
	switch parsed.Hostname() {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}

// isSecure reports whether the URL is HTTPS, or plain HTTP to this
// computer, which nobody on the way can answer for.
func isSecure(parsed *url.URL) bool {
	return parsed.Scheme == "https" || (parsed.Scheme == "http" && isLoopback(parsed))
}

// plainOrigin is an origin safe to show inside a command to paste: nothing
// a shell would act on.
var plainOrigin = regexp.MustCompile(`^https?://[a-z0-9.:\[\]-]+$`)

// openableVerificationURL is the sign-in address to open in the browser:
// uri when it is a page of the dashboard at dashboardURL, over HTTPS (or
// plain HTTP on this computer), without a user name or password. The
// address comes from the API server, so anything else is only printed: an
// opener hands other schemes to whatever application handles them.
func openableVerificationURL(uri, dashboardURL string) (string, bool) {
	parsed, err := url.Parse(uri)
	if err != nil || !isSecure(parsed) || parsed.User != nil {
		return "", false
	}
	origin, ok := credentials.Origin(uri)
	dashboard, dashboardOK := credentials.Origin(dashboardURL)
	if !ok || !dashboardOK || origin != dashboard {
		return "", false
	}
	return parsed.String(), true
}

// isPlainHTTPOnDashboard reports whether uri is on the dashboard
// dashboardURL names, which the CLI would open but for it being plain HTTP
// to another computer.
func isPlainHTTPOnDashboard(uri, dashboardURL string) bool {
	parsed, err := url.Parse(uri)
	if err != nil {
		return false
	}
	origin, ok := credentials.Origin(uri)
	dashboard, dashboardOK := credentials.Origin(dashboardURL)
	return ok && dashboardOK && origin == dashboard && parsed.Scheme == "http" && !isSecure(parsed)
}

// parentDomain is the domain the dashboard of the API at hostname is on:
// the host without its first label (api.voidhash.com → voidhash.com). None
// for an IP address, or when that would leave a single label. Public
// suffixes such as co.uk are not told apart: the dashboard comes from the
// API's own HTTPS metadata, and that server can already send people to its
// own host, so all it could gain is a sibling of its host.
func parentDomain(hostname string) (string, bool) {
	if strings.Contains(hostname, ":") || regexp.MustCompile(`^[\d.]+$`).MatchString(hostname) {
		return "", false
	}
	labels := strings.Split(hostname, ".")
	if len(labels) < 3 {
		return "", false
	}
	return strings.Join(labels[1:], "."), true
}

// isDashboardOf reports whether the CLI may open pages of dashboard for the
// API at api: over HTTPS, on the API's own host, its parent domain, or a
// subdomain of either, or both on this computer.
func isDashboardOf(api, dashboard *url.URL) bool {
	if isLoopback(api) && isLoopback(dashboard) {
		return isSecure(dashboard)
	}
	// A trailing dot makes a host fully qualified, and names the same host.
	host := strings.TrimSuffix(strings.ToLower(dashboard.Hostname()), ".")
	apiHost := strings.TrimSuffix(strings.ToLower(api.Hostname()), ".")
	isOn := func(domain string) bool { return host == domain || strings.HasSuffix(host, "."+domain) }
	if dashboard.Scheme != "https" {
		return false
	}
	if isOn(apiHost) {
		return true
	}
	parent, ok := parentDomain(apiHost)
	return ok && isOn(parent)
}

// advertised is the dashboard a server names, and whether the CLI may open
// its pages.
type advertised struct {
	origin string
	// trusted: on the API's own domain; otherwise only suggested.
	trusted bool
}

// advertisedDashboard is the dashboard the server at apiURL sends people to
// sign in at: the origin of the authorization endpoint in its metadata
// (RFC 8414). A profile that sets only api_url, for staging or a server of
// your own, keeps the default web_url, while this is the dashboard of the
// server it does name.
//
// The metadata is read only over HTTPS, or plain HTTP on this computer,
// without following redirects, and only when its issuer is the API's
// origin, so no one else can answer for the server. Even then the dashboard
// is trusted only on the API's domain. None when the metadata cannot be
// read in time, or cannot be trusted.
func advertisedDashboard(ctx context.Context, app *cli.App, apiURL string) (advertised, bool) {
	parsed, err := url.Parse(apiURL)
	if err != nil || !isSecure(parsed) {
		return advertised{}, false
	}
	metadata, err := app.DeviceAuth(apiURL).ServerMetadata(ctx)
	if err != nil {
		app.Debugf("Reading the server's metadata failed: %v", err)
		return advertised{}, false
	}
	apiOrigin, _ := credentials.Origin(apiURL)
	if metadata.Issuer != apiOrigin {
		return advertised{}, false
	}
	dashboard, err := url.Parse(metadata.AuthorizationEndpoint)
	origin, ok := credentials.Origin(metadata.AuthorizationEndpoint)
	if err != nil || !ok {
		return advertised{}, false
	}
	return advertised{origin: origin, trusted: isDashboardOf(parsed, dashboard)}, true
}
