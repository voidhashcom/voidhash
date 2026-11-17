// Package home holds what `voidhash` does on a terminal without a command:
// it starts the screen, a separate program drawn with OpenTUI, and answers
// what the screen asks with the CLI's own commands.
package home

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/auth"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/status"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
	"github.com/voidhashcom/voidhash/apps/cli/internal/integrate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

const docsURL = "https://voidhash.com/docs"

// commands are the commands a person runs, in the order help lists them.
func commands(root *cobra.Command) []Command {
	var found []Command
	var walk func(cmd *cobra.Command, path []string)
	walk = func(cmd *cobra.Command, path []string) {
		for _, sub := range cmd.Commands() {
			if sub.Hidden || sub.Name() == "help" || sub.Name() == "completion" {
				continue
			}
			args := append(append([]string{}, path...), sub.Name())
			if sub.HasAvailableSubCommands() {
				walk(sub, args)
				continue
			}
			found = append(found, Command{Args: args, Short: sub.Short})
		}
	}
	walk(root, nil)
	return found
}

// output is where the CLI's own printing goes while the screen is up:
// nowhere, to whoever listens, or to the terminal while a command has it.
type output struct {
	stdout, stderr io.Writer

	mu       sync.Mutex
	toScreen bool
	listen   func(line string)
	pending  bytes.Buffer
}

type outputWriter struct {
	output *output
	stderr bool
}

func (o *output) writer(stderr bool) io.Writer { return outputWriter{output: o, stderr: stderr} }

// direct gives the terminal to the CLI's printing, or takes it back.
func (o *output) direct(on bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.toScreen = on
}

// lines sends each line printed from now on to listen; nil stops it.
func (o *output) lines(listen func(line string)) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.listen = listen
	o.pending.Reset()
}

func (w outputWriter) Write(p []byte) (int, error) {
	o := w.output
	o.mu.Lock()
	defer o.mu.Unlock()
	switch {
	case o.toScreen && w.stderr:
		return o.stderr.Write(p)
	case o.toScreen:
		return o.stdout.Write(p)
	case o.listen == nil:
		return len(p), nil
	}
	o.pending.Write(p)
	for {
		index := bytes.IndexByte(o.pending.Bytes(), '\n')
		if index < 0 {
			break
		}
		text := strings.TrimRight(escapes.ReplaceAllString(string(o.pending.Next(index+1)), ""), "\r\n")
		if strings.TrimSpace(text) != "" {
			o.listen(text)
		}
	}
	return len(p), nil
}

// escapes are the terminal's color and cursor sequences, which a line of
// progress is shown without.
var escapes = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

type backend struct {
	app      *cli.App
	root     *cobra.Command
	terminal *output

	mu sync.Mutex
	// approvals are the sign-ins waiting for the browser, by handle.
	approvals map[string]*auth.Approval
}

// failure words an error for the screen: its message, and what to do.
func failure(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) {
		return &Failure{Message: "Stopped."}
	}
	var described *cli.UserError
	if !errors.As(err, &described) {
		if !errors.As(cli.APIError(err, nil), &described) {
			return &Failure{Message: err.Error()}
		}
	}
	return &Failure{Message: described.Message, Hint: described.Hint}
}

func (b *backend) Load(ctx context.Context) (Situation, error) {
	app := b.app
	situation := Situation{Directory: filepath.Base(app.Dir)}
	settings, err := app.Config()
	if err != nil {
		return situation, failure(err)
	}
	situation.Server = app.APIOrigin(settings)

	if project, err := integrate.Inspect(app.Dir); err == nil {
		if found := integrate.Detect(project); len(found) > 0 {
			situation.App = found[0].Name
			if project.PackageManager != "" {
				situation.Details = append(situation.Details, project.PackageManager)
			}
			if project.TypeScript {
				situation.Details = append(situation.Details, "TypeScript")
			}
		}
	}
	var changes bytes.Buffer
	code, err := app.RunProcess(ctx, cli.Process{Name: "git", Args: []string{"status", "--porcelain", "--", "."}, Dir: app.Dir, Stdout: &changes})
	situation.CleanGit = err == nil && code == 0 && strings.TrimSpace(changes.String()) == ""
	if state, found := integrate.LoadState(app.Dir); found {
		situation.Interrupted = state.AgentStage != integrate.AgentFinished && state.AgentStage != integrate.AgentHandedOff
	}
	for _, agent := range integrate.Agents() {
		if _, err := app.LookPath(agent.Program()); err == nil {
			situation.Agents = append(situation.Agents, Agent{ID: agent.ID(), Name: agent.Name(), ModelHint: agent.ModelHint()})
		}
	}

	session, err := app.Session(ctx)
	if err != nil {
		var refused *cli.UserError
		if errors.As(err, &refused) && refused.ExitCode == cli.ExitUnauthenticated && app.Credentials(ctx).EnvironmentKey() == "" {
			return situation, nil
		}
		return situation, failure(err)
	}
	situation.SignedIn, situation.ReadOnly = true, session.IsReadOnly
	if !session.IsKey() {
		situation.Person = session.Person.Email
	}
	project := func(found api.SessionProjectJsonEncoding) Project {
		listed := Project{ID: found.Id, Name: found.Name, Slug: found.Slug}
		if organization := session.OrganizationOf(found); organization != nil {
			listed.Organization = organization.Slug
		}
		return listed
	}
	for _, organization := range session.Organizations {
		situation.Organizations = append(situation.Organizations, Organization{ID: organization.Id, Name: organization.Name, Slug: organization.Slug})
	}
	for _, found := range session.Projects {
		situation.Projects = append(situation.Projects, project(found))
	}

	// The directory's project is the one its committed configuration
	// names, else the one it is linked to. A default project is not the
	// directory's: the person is asked which this one is.
	directoryConfig, configured, err := app.DirectoryConfig()
	if err != nil {
		return situation, failure(err)
	}
	if configured {
		_, named, err := cli.ProjectNamedBy(directoryConfig, session)
		if err != nil {
			return situation, failure(err)
		}
		linked := project(*named)
		situation.Project = &linked
	} else if _, projectID, ok := cli.LinkFor(settings.Links, app.Dir); ok {
		if found := session.Project(projectID); found != nil {
			linked := project(*found)
			situation.Project = &linked
		}
	}
	return situation, nil
}

func (b *backend) StartSignIn(ctx context.Context) (SignIn, error) {
	approval, err := auth.Begin(ctx, b.app, false, false)
	if err != nil {
		return SignIn{}, failure(err)
	}
	signIn := SignIn{Code: approval.Code, Address: approval.Address, Handle: b.app.NewID()}
	b.mu.Lock()
	if b.approvals == nil {
		b.approvals = map[string]*auth.Approval{}
	}
	b.approvals[signIn.Handle] = approval
	b.mu.Unlock()
	if approval.BrowserURL != "" {
		signIn.Opened = b.app.OpenURL(approval.BrowserURL) == nil
	}
	return signIn, nil
}

func (b *backend) FinishSignIn(ctx context.Context, handle string) error {
	b.mu.Lock()
	approval := b.approvals[handle]
	delete(b.approvals, handle)
	b.mu.Unlock()
	if approval == nil {
		return &Failure{Message: "That sign-in is no longer waiting.", Hint: "Start it again."}
	}
	_, err := approval.Wait(ctx)
	return failure(err)
}

func (b *backend) CreateProject(ctx context.Context, organizationID, name string) (Project, error) {
	created, err := cli.Fetch[api.SessionProjectJsonEncoding](ctx, b.app, func(c *api.Client) (*http.Response, error) {
		return c.ProjectsCreate(ctx, organizationID, api.ProjectsCreateJSONRequestBody{Name: name})
	})
	if err != nil {
		return Project{}, failure(err)
	}
	// The session read so far does not list the new project.
	b.app.ForgetSession()
	project := Project{ID: created.Value.Id, Name: created.Value.Name, Slug: created.Value.Slug}
	if session, err := b.app.Session(ctx); err == nil {
		for _, organization := range session.Organizations {
			if organization.Id == organizationID {
				project.Organization = organization.Slug
			}
		}
	}
	return project, nil
}

func (b *backend) Link(ctx context.Context, projectID string) error {
	settings, err := b.app.Config()
	if err != nil {
		return failure(err)
	}
	links := map[string]string{b.app.Dir: projectID}
	for directory, linked := range settings.Links {
		if directory != b.app.Dir {
			links[directory] = linked
		}
	}
	return failure(b.app.WriteConfig(config.Changes{Links: links}))
}

func (b *backend) Integrate(ctx context.Context, options IntegrateOptions, progress func(line string)) error {
	agent := options.Agent
	if agent == "" {
		agent = "none"
	}
	args := []string{"integrate", "--yes", "--project", options.ProjectID, "--agent", agent,
		"--mcp=" + boolean(options.MCP), "--allow-dirty=" + boolean(options.AllowDirty)}
	// The model flag is always passed, so a second setup in the same run
	// does not keep the first one's.
	args = append(args, "--model="+options.Model)
	command, rest, err := b.root.Find(args)
	if err != nil || command.RunE == nil {
		return &Failure{Message: "Could not run 'voidhash integrate' from here.", Hint: "Run it yourself."}
	}
	if err := command.ParseFlags(rest); err != nil {
		return failure(err)
	}
	command.SetContext(ctx)
	b.terminal.lines(progress)
	defer b.terminal.lines(nil)
	return failure(command.RunE(command, command.Flags().Args()))
}

func boolean(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func (b *backend) Checks(ctx context.Context, projectID string) (Checks, error) {
	found, next, err := status.Checks(ctx, b.app, projectID)
	if err != nil {
		return Checks{}, failure(err)
	}
	checks := Checks{Next: next}
	for _, each := range found {
		checks.Items = append(checks.Items, Check{Name: each.Name, State: each.State, Summary: each.Summary})
	}
	return checks, nil
}

func (b *backend) Events(ctx context.Context, projectID string) ([]Event, error) {
	type event struct {
		ID         string  `json:"id"`
		Name       string  `json:"name"`
		DistinctID string  `json:"distinctId"`
		PersonID   *string `json:"personId"`
		Source     string  `json:"source"`
		ReceivedAt string  `json:"receivedAt"`
	}
	limit := 50
	found, _, err := cli.FetchPage[event](ctx, b.app, func(c *api.Client) (*http.Response, error) {
		return c.EventsList(ctx, projectID, &api.EventsListParams{Limit: &limit})
	})
	if err != nil {
		return nil, failure(err)
	}
	today := b.app.Now().In(b.app.Location).Format(time.DateOnly)
	events := make([]Event, 0, len(found.Items))
	for _, each := range found.Items {
		received := each.ReceivedAt
		if at, err := time.Parse(time.RFC3339, each.ReceivedAt); err == nil {
			at = at.In(b.app.Location)
			received = at.Format("15:04:05")
			if at.Format(time.DateOnly) != today {
				received = at.Format("2 Jan 15:04")
			}
		}
		events = append(events, Event{ID: each.ID, Name: each.Name, Person: each.DistinctID, Source: each.Source, ReceivedAt: received})
	}
	return events, nil
}

func (b *backend) Keys(ctx context.Context, projectID string) ([]Key, error) {
	found, err := cli.ListAll[api.ApiKeyJsonEncoding](ctx, b.app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ApiKeysList(ctx, projectID, &api.ApiKeysListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return nil, failure(err)
	}
	keys := make([]Key, 0, len(found.Items))
	for _, each := range found.Items {
		key := Key{ID: each.Id, Name: each.Name, Type: string(each.Type), Environment: string(each.Environment), Value: each.Prefix + "…" + each.End}
		if each.Type == "publishable" && each.RawKey != nil {
			key.Value, key.Copyable = *each.RawKey, true
		}
		keys = append(keys, key)
	}
	return keys, nil
}

func (b *backend) Perks(ctx context.Context, projectID string) ([]Perk, error) {
	var (
		found    cli.List[api.PerkJsonEncoding]
		products cli.List[api.ProductJsonEncoding]
	)
	err := cli.Together(ctx,
		func(ctx context.Context) (err error) {
			found, err = catalog.ListPerks(ctx, b.app, projectID)
			return err
		},
		func(ctx context.Context) (err error) {
			products, err = catalog.ListProducts(ctx, b.app, projectID)
			return err
		},
	)
	if err != nil {
		return nil, failure(err)
	}
	granted, err := cli.Each(ctx, products.Items, 4, func(ctx context.Context, product api.ProductJsonEncoding) (cli.List[api.PerkJsonEncoding], error) {
		return catalog.ListProductPerks(ctx, b.app, projectID, product.Id)
	})
	if err != nil {
		return nil, failure(err)
	}
	grantedBy := map[string][]string{}
	for index, list := range granted {
		for _, perk := range list.Items {
			grantedBy[perk.Id] = append(grantedBy[perk.Id], products.Items[index].Slug)
		}
	}
	perks := make([]Perk, 0, len(found.Items))
	for _, each := range found.Items {
		perks = append(perks, Perk{ID: each.Id, Name: each.Name, Slug: each.Slug, GrantedBy: grantedBy[each.Id]})
	}
	return perks, nil
}

func (b *backend) CreatePerk(ctx context.Context, projectID, name string) error {
	return failure(cli.Call(ctx, b.app, func(c *api.Client) (*http.Response, error) {
		return c.PerksCreate(ctx, projectID, api.CreatePerkBodyJsonEncoding{Name: name, Slug: catalog.SlugFrom(name)})
	}))
}

func (b *backend) Locations(ctx context.Context, projectID string) ([]Location, error) {
	var (
		found cli.List[paywalls.Location]
		shown cli.List[paywalls.Paywall]
	)
	err := cli.Together(ctx,
		func(ctx context.Context) (err error) {
			found, err = paywalls.ListLocations(ctx, b.app, projectID)
			return err
		},
		func(ctx context.Context) (err error) {
			shown, err = paywalls.ListPaywalls(ctx, b.app, projectID)
			return err
		},
	)
	if err != nil {
		return nil, failure(err)
	}
	names := map[string]string{}
	for _, each := range shown.Items {
		names[each.Id] = each.Name
	}
	locations := make([]Location, 0, len(found.Items))
	for _, each := range found.Items {
		if each.IsArchived {
			continue
		}
		location := Location{ID: each.ID, Name: each.Name, Slug: each.Slug}
		switch showing := each.Showing; {
		case showing == nil:
		case showing.PaywallID != nil:
			location.Shows = names[*showing.PaywallID]
		default:
			location.Shows = "what an experiment decides"
		}
		locations = append(locations, location)
	}
	return locations, nil
}

func (b *backend) CreateLocation(ctx context.Context, projectID, name string) error {
	body := map[string]any{"name": name, "slug": catalog.SlugFrom(name)}
	return failure(cli.Call(ctx, b.app, func(c *api.Client) (*http.Response, error) {
		return c.PaywallLocationsCreateWithBody(ctx, projectID, paywalls.JSONContentType, paywalls.JSONBody(body))
	}))
}

func (b *backend) Webhooks(ctx context.Context, projectID string) ([]Webhook, error) {
	found, err := cli.ListAll[api.WebhookJsonEncoding](ctx, b.app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.WebhooksList(ctx, projectID, &api.WebhooksListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return nil, failure(err)
	}
	webhooks := make([]Webhook, 0, len(found.Items))
	for _, each := range found.Items {
		webhook := Webhook{ID: each.Id, Name: each.Name, URL: each.Url, Environment: string(each.Environment), Health: "delivering"}
		switch {
		case each.Status == "disabled":
			webhook.Health, webhook.Failing = "turned off", true
		case each.Status == "failed":
			webhook.Health, webhook.Failing = "stopped after failing", true
		case each.ConsecutiveFailures > 0:
			webhook.Health, webhook.Failing = "failing", true
		case each.LastSuccessAt != nil:
			webhook.Health = "delivered " + b.app.FormatTimeAgo(*each.LastSuccessAt)
		}
		webhooks = append(webhooks, webhook)
	}
	return webhooks, nil
}

// copyTools are the programs that put their input on the clipboard.
var copyTools = map[string][][]string{
	"darwin":  {{"pbcopy"}},
	"windows": {{"clip"}},
	"linux":   {{"wl-copy"}, {"xclip", "-selection", "clipboard"}, {"xsel", "--clipboard", "--input"}},
}

func (b *backend) Copy(value string) error {
	for _, tool := range copyTools[b.app.GOOS] {
		if _, err := b.app.LookPath(tool[0]); err != nil {
			continue
		}
		code, err := b.app.RunProcess(context.Background(), cli.Process{Name: tool[0], Args: tool[1:], Dir: b.app.Dir, Stdin: strings.NewReader(value)})
		if err == nil && code == 0 {
			return nil
		}
	}
	return errors.New("no clipboard tool")
}

func (b *backend) Open(ctx context.Context, what string) error {
	address := docsURL
	if what != "docs" {
		settings, err := b.app.Config()
		if err != nil {
			return failure(err)
		}
		target, err := b.app.ResolveProject(ctx, "")
		if err != nil {
			return failure(err)
		}
		page := ""
		if what == "keys" {
			page = "settings/api-keys"
		}
		dashboard, ok := cli.DashboardURL(settings.WebURL, target, page)
		if !ok {
			return &Failure{Message: "This key does not show the project's organization, so its dashboard address is not known."}
		}
		address = dashboard
	}
	if err := b.app.OpenURL(address); err != nil {
		return &Failure{Message: "Could not open " + address + "."}
	}
	return nil
}
