package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
)

// Who the CLI acts as and which project a command acts on.
//
// A project-scoped command acts on, in this order:
//
//  1. the project --project names (an id, a slug, organization/slug or a name);
//  2. the project of the current directory: the one its committed
//     configuration names, else the one `voidhash link` bound it, or the
//     nearest directory above it, to;
//  3. the default project `voidhash switch` chose;
//  4. the only project the credential can use (a project secret key has one).
//
// Otherwise the CLI asks on a terminal, and fails with the list off one.
//
// Links and the default live in the CLI config (~/.voidhash), under the
// active profile, never in the repository: they are personal (teammates may
// work in their own projects), and a project id is only meaningful to the
// API server and account the profile signs in to.

// Session is what the credential can do: who it acts for, and the
// organizations and projects it can use.
type Session struct {
	api.SessionJsonEncoding
	// Raw is the session as the server sent it, which --json prints.
	Raw json.RawMessage
}

// RawJSON is the session as the server sent it.
func (s *Session) RawJSON() json.RawMessage { return s.Raw }

// IsKey reports whether the credential is a project secret key, which acts
// for no person.
func (s *Session) IsKey() bool { return s.Person.Id == "" }

// Holder is who the session acts as, for messages: the person signed in, or
// "a project secret key".
func (s *Session) Holder() string {
	if s.IsKey() {
		return "a project secret key"
	}
	return s.Person.Name
}

// holderTitle is Holder at the start of a sentence.
func (s *Session) holderTitle() string {
	if s.IsKey() {
		return "A project secret key"
	}
	return s.Person.Name
}

// OrganizationOf is the organization project belongs to, or nil when the
// session does not list it (a secret key's may not).
func (s *Session) OrganizationOf(project api.SessionProjectJsonEncoding) *api.SessionOrganizationJsonEncoding {
	for index := range s.Organizations {
		if s.Organizations[index].Id == project.OrganizationId {
			return &s.Organizations[index]
		}
	}
	return nil
}

// ProjectsIn lists the projects of an organization the session can use.
func (s *Session) ProjectsIn(organizationID string) []api.SessionProjectJsonEncoding {
	var projects []api.SessionProjectJsonEncoding
	for _, project := range s.Projects {
		if project.OrganizationId == organizationID {
			projects = append(projects, project)
		}
	}
	return projects
}

// Project is the project with the id, or nil when the session cannot use it.
func (s *Session) Project(id string) *api.SessionProjectJsonEncoding {
	for index := range s.Projects {
		if s.Projects[index].Id == id {
			return &s.Projects[index]
		}
	}
	return nil
}

// APIOrigin is the origin of the configured API server, as messages name it.
func (a *App) APIOrigin(settings config.Settings) string {
	if origin, ok := credentials.Origin(settings.APIURL); ok {
		return origin
	}
	return settings.APIURL
}

// Session is the session of the run's credential, read once per run. It
// fails with exit code 3, saying on which server and how to sign in, when
// no one is signed in or the API no longer accepts the credential.
// VOIDHASH_API_KEY wins over any sign-in, so when the server refuses it the
// failure says so instead: signing in cannot help.
func (a *App) Session(ctx context.Context) (*Session, error) {
	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()
	if a.session != nil {
		return a.session, nil
	}
	settings, err := a.Config()
	if err != nil {
		return nil, err
	}
	creds := a.Credentials(ctx)
	notSignedIn := func() error {
		origin := a.APIOrigin(settings)
		if creds.EnvironmentKey() != "" {
			return &UserError{
				Message:  fmt.Sprintf("The server on %s refused the key in VOIDHASH_API_KEY.", origin),
				Hint:     "Check that the key is current and belongs to this server, or unset VOIDHASH_API_KEY to use your sign-in.",
				ExitCode: ExitUnauthenticated,
			}
		}
		return &UserError{
			Message:  fmt.Sprintf("You are not signed in on %s.", origin),
			Hint:     "Run 'voidhash login' first.",
			ExitCode: ExitUnauthenticated,
		}
	}
	credential, err := creds.Resolve(ctx, settings.APIURL)
	if err != nil {
		return nil, &UserError{Message: err.Error() + "."}
	}
	if credential == nil {
		a.Debugf("No credential found for the API origin")
		return nil, notSignedIn()
	}
	fetched, err := Fetch[api.SessionJsonEncoding](ctx, a, func(c *api.Client) (*http.Response, error) {
		return c.SessionGet(ctx)
	})
	if err != nil {
		if APIErrorType(err) == "unauthenticated" || voidhash.StatusCode(err) == http.StatusUnauthorized {
			return nil, notSignedIn()
		}
		return nil, err
	}
	a.session = &Session{SessionJsonEncoding: fetched.Value, Raw: fetched.Raw}
	return a.session, nil
}

// ForgetSession drops the session read so far, so the next [App.Session]
// asks the server again. Call it after what changes the session within one
// run, such as creating a project.
func (a *App) ForgetSession() {
	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()
	a.session = nil
}

// ProjectKind is how projects read in messages and prompts, and what they
// answer to: their id, slug, organization/slug or name.
func ProjectKind(session *Session) ItemKind[api.SessionProjectJsonEncoding] {
	path := func(project api.SessionProjectJsonEncoding) string {
		if organization := session.OrganizationOf(project); organization != nil {
			return organization.Slug + "/" + project.Slug
		}
		return project.OrganizationId + "/" + project.Slug
	}
	return ItemKind[api.SessionProjectJsonEncoding]{
		Noun:        "project",
		ID:          func(project api.SessionProjectJsonEncoding) string { return project.Id },
		Label:       func(project api.SessionProjectJsonEncoding) string { return project.Name + " (" + path(project) + ")" },
		ListCommand: "voidhash whoami",
		Keys:        func(project api.SessionProjectJsonEncoding) []string { return []string{project.Slug, path(project)} },
		Names:       func(project api.SessionProjectJsonEncoding) []string { return []string{project.Name} },
	}
}

// DirectoryConfig reads the committed configuration of the current
// directory. found is false when it has none. What is wrong with the
// configuration without stopping it from being used, such as two files
// that disagree, is printed as warnings the first time a run reads it.
func (a *App) DirectoryConfig() (*projectconfig.Config, bool, error) {
	directoryConfig, found, err := a.LoadDirectoryConfig(a.Dir)
	if err != nil {
		return nil, false, &UserError{Message: capitalize(err.Error()) + ".", Cause: err}
	}
	if found {
		a.directoryWarnings.Do(func() {
			for _, warning := range directoryConfig.Warnings {
				a.Warnf("%s", warning)
			}
		})
	}
	return directoryConfig, found, nil
}

// ProjectNamedBy finds the organization and project a directory's
// configuration names, among those the session can use.
func ProjectNamedBy(directoryConfig *projectconfig.Config, session *Session) (*api.SessionOrganizationJsonEncoding, *api.SessionProjectJsonEncoding, error) {
	for index := range session.Organizations {
		organization := &session.Organizations[index]
		if organization.Slug != directoryConfig.Team {
			continue
		}
		for projectIndex := range session.Projects {
			project := &session.Projects[projectIndex]
			if project.OrganizationId == organization.Id && project.Slug == directoryConfig.Project {
				return organization, project, nil
			}
		}
	}
	return nil, nil, &UserError{
		Message: fmt.Sprintf("%s names the project %s/%s, which %s cannot reach.",
			directoryConfig.FileBase(), directoryConfig.Team, directoryConfig.Project, session.Holder()),
		Hint:     "Sign in with the account that can ('voidhash login'), or run 'voidhash init' again.",
		ExitCode: ExitNotFound,
	}
}

// LinkFor finds the nearest of the linked directories that directory is, or
// is inside, with the project it is linked to.
func LinkFor(links map[string]string, directory string) (linked, projectID string, ok bool) {
	separator := string(filepath.Separator)
	for candidate, id := range links {
		prefix := candidate
		if !strings.HasSuffix(prefix, separator) {
			prefix += separator
		}
		contains := directory == candidate || strings.HasPrefix(directory, prefix)
		if contains && (!ok || len(candidate) > len(linked)) {
			linked, projectID, ok = candidate, id, true
		}
	}
	return linked, projectID, ok
}

// ProjectSource says where the project a command acts on came from: "flag",
// "config", "link", "default", "only" or "chosen".
type ProjectSource struct {
	Kind string
	// Directory is the linked directory, for a "link".
	Directory string
	// File is the configuration file's name, for a "config".
	File string
}

// Describe is how the source reads after the project: "linked to /work/app".
func (s ProjectSource) Describe() string {
	switch s.Kind {
	case "flag":
		return "named by --project"
	case "config":
		return "named by " + s.File + " here"
	case "link":
		return "linked to " + s.Directory
	case "default":
		return "your default project"
	case "only":
		return "the only project you can use"
	default:
		return "chosen just now"
	}
}

// ProjectContext is the project a command acts on, with the session that can
// use it.
type ProjectContext struct {
	Session *Session
	Project api.SessionProjectJsonEncoding
	// Organization is the project's organization, or nil when the session
	// does not list it.
	Organization *api.SessionOrganizationJsonEncoding
	Source       ProjectSource
}

// Label is the project as messages name it: "App (acme/app)".
func (c *ProjectContext) Label() string {
	return ProjectKind(c.Session).Label(c.Project)
}

// ResolveProject decides the project a project-scoped command acts on, in
// the order this file describes. flag is the command's --project value,
// empty when it was not passed.
//
//	target, err := app.ResolveProject(ctx, *project)
//	if err != nil {
//		return err
//	}
//	projectID := target.Project.Id
func (a *App) ResolveProject(ctx context.Context, flag string) (*ProjectContext, error) {
	session, err := a.Session(ctx)
	if err != nil {
		return nil, err
	}
	kind := ProjectKind(session)
	resolved := func(project api.SessionProjectJsonEncoding, source ProjectSource) *ProjectContext {
		return &ProjectContext{Session: session, Project: project, Organization: session.OrganizationOf(project), Source: source}
	}

	if flag != "" {
		project, err := FindItem(kind, session.Projects, flag)
		if err != nil {
			return nil, err
		}
		return resolved(project, ProjectSource{Kind: "flag"}), nil
	}

	directoryConfig, found, err := a.DirectoryConfig()
	if err != nil {
		return nil, err
	}
	if found {
		_, project, err := ProjectNamedBy(directoryConfig, session)
		if err != nil {
			return nil, err
		}
		return resolved(*project, ProjectSource{Kind: "config", File: directoryConfig.FileBase()}), nil
	}

	settings, err := a.Config()
	if err != nil {
		return nil, err
	}
	stored := func(projectID, where, hint string) (*api.SessionProjectJsonEncoding, error) {
		if project := session.Project(projectID); project != nil {
			return project, nil
		}
		return nil, &UserError{
			Message:  fmt.Sprintf("%s %s, which %s cannot use.", where, projectID, session.Holder()),
			Hint:     hint,
			ExitCode: ExitNotFound,
		}
	}
	if directory, projectID, ok := LinkFor(settings.Links, a.Dir); ok {
		project, err := stored(projectID, directory+" is linked to",
			"Link it to another with 'voidhash link', or remove the link with 'voidhash unlink'.")
		if err != nil {
			return nil, err
		}
		return resolved(*project, ProjectSource{Kind: "link", Directory: directory}), nil
	}
	if settings.DefaultProject != "" {
		project, err := stored(settings.DefaultProject, "Your default project is", "Choose another with 'voidhash switch'.")
		if err != nil {
			return nil, err
		}
		return resolved(*project, ProjectSource{Kind: "default"}), nil
	}

	switch {
	case len(session.Projects) == 1:
		return resolved(session.Projects[0], ProjectSource{Kind: "only"}), nil
	case len(session.Projects) == 0:
		return nil, &UserError{
			Message:  session.holderTitle() + " cannot use any project.",
			Hint:     "Create one with 'voidhash project create', or sign in with another account ('voidhash login').",
			ExitCode: ExitNotFound,
		}
	case !a.IsInteractive():
		lines := []string{fmt.Sprintf("Which project? %s can use %d:", session.holderTitle(), len(session.Projects))}
		for _, project := range session.Projects {
			lines = append(lines, "  "+kind.Label(project)+"  "+project.Id)
		}
		return nil, &UserError{
			Message:  strings.Join(lines, "\n"),
			Hint:     "Pass --project <project>, link this directory with 'voidhash link <project>', or choose a default with 'voidhash switch <project>'.",
			ExitCode: ExitUsage,
		}
	}
	chosen, err := ChooseItem(ctx, a, kind, session.Projects, "")
	if err != nil {
		return nil, err
	}
	a.Notef("'voidhash link' makes a project this directory's; 'voidhash switch' makes it your default.")
	return resolved(chosen, ProjectSource{Kind: "chosen"}), nil
}

// DashboardURL is the dashboard address of page in the project, such as
// "products/prod_123"; an empty page is the project's home. ok is false
// when the project's organization is not known, as for a secret key.
func DashboardURL(webURL string, target *ProjectContext, page string) (address string, ok bool) {
	if target.Organization == nil {
		return "", false
	}
	base, err := url.Parse(webURL)
	if err != nil {
		return "", false
	}
	path := "/studio/" + target.Organization.Slug + "/" + target.Project.Slug
	if page != "" {
		path += "/" + page
	}
	relative, err := url.Parse(path)
	if err != nil {
		return "", false
	}
	return base.ResolveReference(relative).String(), true
}

func capitalize(text string) string {
	if text == "" {
		return text
	}
	return strings.ToUpper(text[:1]) + text[1:]
}
