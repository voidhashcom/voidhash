// Package componentapi is what the component commands (`dev`, `new`,
// `publish`, `test`, `registry`) share of the CLI: the project's working
// copy, the component calls of the API, and how versions are shown.
package componentapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/devserver"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/workingcopy"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
	voidhash "github.com/voidhashcom/voidhash/libraries/go"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// ConformanceCheck is one check of the conformance suite.
type ConformanceCheck struct {
	Name   string   `json:"name"`
	Status string   `json:"status"`
	Errors []string `json:"errors"`
}

// Conformance is the outcome of the conformance suite for a version.
type Conformance struct {
	HasPassed bool               `json:"hasPassed"`
	Checks    []ConformanceCheck `json:"checks"`
}

// Version is a catalog version of a project component, as the API describes
// it. BuildLog and SourceFiles are only in the answer for one version.
type Version struct {
	ID          string          `json:"id"`
	ComponentID string          `json:"componentId"`
	Version     int             `json:"version"`
	SourceKind  string          `json:"sourceKind"`
	Status      string          `json:"status"`
	ContentHash *string         `json:"contentHash"`
	PanelHash   *string         `json:"panelHash"`
	ByteSize    *int            `json:"byteSize"`
	Conformance *Conformance    `json:"conformance"`
	Warnings    []string        `json:"warnings"`
	CreatedAt   string          `json:"createdAt"`
	BuiltAt     *string         `json:"builtAt"`
	BuildLog    *string         `json:"buildLog"`
	SourceFiles json.RawMessage `json:"sourceFiles"`
}

// Component is a component of the project's catalog.
type Component struct {
	ID                 string   `json:"id"`
	Slug               string   `json:"slug"`
	Title              string   `json:"title"`
	LatestVersion      *Version `json:"latestVersion"`
	LatestReadyVersion *Version `json:"latestReadyVersion"`
}

// Error gives a refused component call its next step. The server's message
// names every problem it found with a module or crate.
func Error(err error) error {
	return cli.APIError(err, map[string]string{
		"consent_required": "Review it, then run the command again with --yes.",
	})
}

// WarningLabels say what each version warning means, and what to do about
// it. A warning a newer server reports that this CLI does not know is
// printed as its code.
var WarningLabels = map[string]string{
	"conformance_not_run": "Not run through the conformance suite, because the server had no component build service when it was stored. Run 'voidhash test' on it.",
	"panel_not_built":     "The build returned no editor panel, so the editor shows the default panels. Publish the source again to build it.",
}

// WarningLabel is the line shown for a version warning.
func WarningLabel(warning string) string {
	if label, ok := WarningLabels[warning]; ok {
		return label
	}
	return warning
}

func orDash(value *string) string {
	if value == nil {
		return "-"
	}
	return *value
}

// FormatVersion lists the facts of a version of the project component slug,
// one aligned line each, then the checks it failed and its warnings.
func FormatVersion(app *cli.App, slug string, version Version) string {
	size := "-"
	if version.ByteSize != nil {
		size = fmt.Sprintf("%d bytes", *version.ByteSize)
	}
	conformance := "not run"
	if version.Conformance != nil {
		conformance = "failed; it cannot be inserted"
		if version.Conformance.HasPassed {
			conformance = "passed"
		}
	}
	built := "-"
	if version.BuiltAt != nil {
		built = app.FormatDate(*version.BuiltAt)
	}
	lines := []string{
		fmt.Sprintf("%s v%d", slug, version.Version),
		cli.FormatFields([]cli.Field{
			{Label: "Status", Value: version.Status},
			{Label: "Source", Value: version.SourceKind},
			{Label: "Created", Value: app.FormatDate(version.CreatedAt)},
			{Label: "Built", Value: built},
			{Label: "Content hash", Value: orDash(version.ContentHash)},
			{Label: "Panel hash", Value: orDash(version.PanelHash)},
			{Label: "Size", Value: size},
			{Label: "Conformance", Value: conformance},
		}),
	}
	if version.Conformance != nil {
		for _, check := range version.Conformance.Checks {
			if check.Status != "fail" {
				continue
			}
			for _, problem := range check.Errors {
				lines = append(lines, cli.PrintableLines(fmt.Sprintf("  ✗ %s: %s", check.Name, problem)))
			}
		}
	}
	for _, warning := range version.Warnings {
		lines = append(lines, "  ! "+cli.Printable(WarningLabel(warning)))
	}
	return strings.Join(lines, "\n")
}

// Target is the project of the current directory and its component working
// copy.
type Target struct {
	WorkingCopy  *workingcopy.WorkingCopy
	Organization *api.SessionOrganizationJsonEncoding
	Project      *api.SessionProjectJsonEncoding
}

// Open finds the project the current directory's configuration names and
// opens its component working copy, which is created (and added to
// .gitignore) when it does not exist yet. `dev`, `new` and `publish` start
// with it.
func Open(ctx context.Context, app *cli.App) (*Target, error) {
	directoryConfig, found, err := app.DirectoryConfig()
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, cli.Failf("There is no %s here, so the CLI cannot tell which project's components these are.", projectconfig.FileName).
			WithHint("Run this command in your project's root, or set the project up with 'voidhash init'.")
	}
	session, err := app.Session(ctx)
	if err != nil {
		return nil, err
	}
	organization, project, err := cli.ProjectNamedBy(directoryConfig, session)
	if err != nil {
		return nil, err
	}
	workingCopy, notes, err := workingcopy.Prepare(app.Dir, project.Id)
	if err != nil {
		return nil, FileError(err, "Could not prepare the working copy")
	}
	for _, note := range notes {
		app.Notef("%s", note)
	}
	return &Target{WorkingCopy: workingCopy, Organization: organization, Project: project}, nil
}

// FileError turns a failure of the working copy into the error to show: a
// state the CLI cannot use says so itself, and anything else is what could
// not be read or written.
func FileError(err error, doing string) error {
	var stateError *workingcopy.StateError
	var userError *cli.UserError
	switch {
	case err == nil:
		return nil
	case errors.As(err, &stateError):
		return cli.Failf("%s", stateError.Message)
	case errors.As(err, &userError), cli.IsAPIError(err), errors.Is(err, context.Canceled):
		return err
	}
	return &cli.UserError{Message: doing + ": " + err.Error(), Cause: err}
}

// JSONBody encodes a request body the CLI builds itself, leaving source
// text readable.
func JSONBody(value any) io.Reader {
	var body bytes.Buffer
	encoder := json.NewEncoder(&body)
	encoder.SetEscapeHTML(false)
	// The values are plain data, which always encodes.
	_ = encoder.Encode(value)
	return &body
}

// Catalog reads the catalog of one project for a sync of its working copy.
type Catalog struct {
	App       *cli.App
	ProjectID string
}

// List lists every component of the project.
func (c Catalog) List(ctx context.Context) ([]Component, error) {
	listed, err := cli.ListAll[Component](ctx, c.App, func(client *api.Client, page cli.Page) (*http.Response, error) {
		return client.ComponentsList(ctx, c.ProjectID, &api.ComponentsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	return listed.Items, Error(err)
}

// ListComponents lists every component of the project with its newest
// version.
func (c Catalog) ListComponents(ctx context.Context) ([]workingcopy.CatalogComponent, error) {
	listed, err := c.List(ctx)
	if err != nil {
		return nil, err
	}
	components := make([]workingcopy.CatalogComponent, len(listed))
	for index, component := range listed {
		components[index] = workingcopy.CatalogComponent{ID: component.ID, Slug: component.Slug, Title: component.Title}
		if latest := component.LatestVersion; latest != nil {
			components[index].Latest = &workingcopy.CatalogHead{
				ComponentID: component.ID, VersionID: latest.ID, Version: latest.Version, SourceKind: latest.SourceKind,
			}
		}
	}
	return components, nil
}

// GetVersion reads one version with its build log and source files.
func (c Catalog) GetVersion(ctx context.Context, componentID, versionID string) (Version, error) {
	version, err := cli.Fetch[Version](ctx, c.App, func(client *api.Client) (*http.Response, error) {
		return client.ComponentsGetVersion(ctx, c.ProjectID, componentID, versionID)
	})
	return version.Value, Error(err)
}

// SourceFiles reads the source files of a version; nil when it has none,
// or holds something other than text by path.
func (c Catalog) SourceFiles(ctx context.Context, componentID, versionID string) (workingcopy.Files, error) {
	version, err := c.GetVersion(ctx, componentID, versionID)
	if err != nil {
		return nil, err
	}
	var files workingcopy.Files
	if json.Unmarshal(version.SourceFiles, &files) != nil {
		return nil, nil
	}
	return files, nil
}

// Sessions makes the dev session calls of a run for one project.
type Sessions struct {
	App       *cli.App
	ProjectID string
}

// callError says what a failed dev session call means for the run.
func callError(err error) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	failure := &devserver.CallError{Message: err.Error(), Err: err}
	var apiError *voidhash.APIError
	var userError *cli.UserError
	if errors.As(err, &apiError) {
		failure.Status = apiError.StatusCode
	}
	shown := Error(err)
	if errors.As(shown, &userError) {
		failure.Message = userError.Message
		// A run that is not signed in cannot report at all.
		if failure.Status == 0 && userError.ExitCode == cli.ExitUnauthenticated {
			failure.Status = http.StatusUnauthorized
		}
	}
	failure.Err = shown
	return failure
}

// Create registers the run's session.
func (s Sessions) Create(ctx context.Context, url, token string, components []devserver.ReportedComponent) (string, error) {
	body := map[string]any{"url": url, "token": token, "components": components}
	session, err := cli.Fetch[struct {
		ID string `json:"id"`
	}](ctx, s.App, func(client *api.Client) (*http.Response, error) {
		return client.ComponentDevSessionsCreateWithBody(ctx, s.ProjectID, "application/json", JSONBody(body))
	})
	if err != nil {
		return "", callError(err)
	}
	return session.Value.ID, nil
}

// Update refreshes the session with the current components.
func (s Sessions) Update(ctx context.Context, id string, components []devserver.ReportedComponent) error {
	err := cli.Call(ctx, s.App, func(client *api.Client) (*http.Response, error) {
		return client.ComponentDevSessionsUpdateWithBody(ctx, s.ProjectID, id, "application/json", JSONBody(map[string]any{"components": components}))
	})
	if err != nil {
		return callError(err)
	}
	return nil
}

// Delete ends the session.
func (s Sessions) Delete(ctx context.Context, id string) error {
	err := cli.Call(ctx, s.App, func(client *api.Client) (*http.Response, error) {
		return client.ComponentDevSessionsDelete(ctx, s.ProjectID, id)
	})
	if err != nil {
		return callError(err)
	}
	return nil
}

// ListIDs lists the ids of the person's active sessions in the project.
func (s Sessions) ListIDs(ctx context.Context) ([]string, error) {
	// A person has at most one session per project, so the first page holds it.
	sessions, _, err := cli.FetchPage[struct {
		ID string `json:"id"`
	}](ctx, s.App, func(client *api.Client) (*http.Response, error) {
		return client.ComponentDevSessionsList(ctx, s.ProjectID, nil)
	})
	if err != nil {
		return nil, callError(err)
	}
	ids := make([]string, len(sessions.Items))
	for index, session := range sessions.Items {
		ids[index] = session.ID
	}
	return ids, nil
}

// Path resolves a path a person typed against the directory the command
// runs in.
func Path(app *cli.App, path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Join(app.Dir, path)
}

// Relative shows a path relative to the directory the command runs in, the
// way a person would type it there.
func Relative(app *cli.App, path string) string {
	if relative, err := filepath.Rel(app.Dir, path); err == nil {
		return relative
	}
	return path
}

// Label is the project as messages name it: "App (acme/app)".
func (t *Target) Label() string {
	return t.Project.Name + " (" + t.Organization.Slug + "/" + t.Project.Slug + ")"
}
