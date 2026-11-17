// Package integrate holds `voidhash integrate`: adding Voidhash to an app,
// with the CLI doing what needs no knowledge of the app's code and a coding
// agent doing what does.
package integrate

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/initcmd"
	"github.com/voidhashcom/voidhash/apps/cli/internal/integrate"
)

// noAgent is the --agent value that writes the task instead of running one.
const noAgent = "none"

type options struct {
	project, platform, agent string
	model                    string
	perk, product, location  string
	checks                   []string
	allowDirty, restart      bool
	mcp, dryRun, yes, json   bool
	wait, timeout            time.Duration
}

// New creates `voidhash integrate`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "integrate",
		Aliases: []string{"wizard"},
		Short:   "Add Voidhash to this app, with a coding agent wiring it into your code.",
		Long: `Add Voidhash to the app in this directory, from nothing to a checked integration.

The CLI does what needs no knowledge of your code: it finds out what kind of app this is, signs you in, chooses or creates the project, creates the perk, product or location you ask for, installs the SDK with your package manager, and writes voidhash.json, the SDK client or environment values, and the generated types.

A coding agent you already have (Claude Code, Codex, OpenCode, Grok Build, Cursor or fx) then does what needs your code read: mounting the SDK where the app starts, identifying the user, gating on a perk, selling a product. It runs without its own interface and with your own account, may run your project's own checks but install nothing, and is kept to this directory and off .env files as far as that agent can be; the plan says how far, before anything runs. Its whole task is written to .voidhash/integrate/task.md first, so you can read what it is told. With no such agent, or --agent none, the task is written for you to hand to any agent or to follow yourself; run the command again afterwards to check the result.

Then the CLI checks the result instead of taking the agent's word: your typecheck or build must pass, the SDK must be in your code, and, when you start the app, its first event must arrive. The summary lists the files git shows as changed and what is left for you, such as store setup. Nothing is committed.

It needs a clean git working tree, so that everything it changes can be reviewed and undone; --allow-dirty lifts that. Run it again at any time: it continues an interrupted run and repeats nothing that is already done. --restart forgets the earlier run.

Platforms:
  expo, nextjs, react       supported
  react-native, web, node,  best effort: the same steps, with less of the
  ios, android              result checked`,
		Example: `voidhash integrate
voidhash integrate --dry-run
voidhash integrate --project acme/app --perk premium --product pro_monthly --yes
voidhash integrate --agent none
voidhash integrate --project acme/app --agent codex --yes --json`,
	}
	var opts options
	flags := cmd.Flags()
	flags.StringVar(&opts.project, "project", "", "The project to integrate: its slug, organization/slug, name or id (default: the one voidhash.json names, else asks)")
	platform := cli.AddChoiceFlag(cmd, "platform", "", integrate.PlatformIDs(), "", "The kind of app, when it is not the one found")
	agent := cli.AddChoiceFlag(cmd, "agent", "", append(integrate.AgentIDs(), noAgent), "",
		"The coding agent that edits your code, or none to write its task only (default: the one installed; asks in a terminal when there are several)")
	flags.StringVar(&opts.model, "model", "", "The model the agent works with, named as that agent names its models (default: the one the agent is set up with)")
	flags.StringVar(&opts.perk, "perk", "", "The slug of the perk the app gates on; created when the project has none by it")
	flags.StringVar(&opts.product, "product", "", "The slug of the product the app sells; created as a monthly subscription when the project has none by it")
	flags.StringVar(&opts.location, "location", "", "The slug of the paywall location the app presents; created when the project has none by it")
	checks := cli.AddStringsFlag(cmd, "check", "", "A command that must pass, instead of the project's typecheck or build")
	flags.BoolVar(&opts.allowDirty, "allow-dirty", false, "Run although git shows uncommitted changes, or this is not a git repository")
	flags.BoolVar(&opts.restart, "restart", false, "Forget an earlier run here and start over")
	flags.BoolVar(&opts.mcp, "mcp", false, "Also add the Voidhash MCP server to your AI agents (default: asks in a terminal)")
	flags.DurationVar(&opts.wait, "wait", 0, "How long to wait for the app's first event, such as 5m (default: asks in a terminal, otherwise does not wait)")
	flags.DurationVar(&opts.timeout, "timeout", 30*time.Minute, "How long the agent may work")
	flags.BoolVar(&opts.dryRun, "dry-run", false, "Show what would happen, and change nothing")
	flags.BoolVarP(&opts.yes, "yes", "y", false, "Go ahead without asking, with the defaults for what is not passed")
	flags.BoolVar(&opts.json, "json", false, "Print the result as JSON, for scripts")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		opts.platform, opts.agent, opts.checks = *platform, *agent, *checks
		r := &run{cmd: cmd, app: app, opts: opts}
		return r.execute(cmd.Context())
	}
	return cmd
}

// run is one `voidhash integrate`: what it found, decided and did.
type run struct {
	cmd  *cobra.Command
	app  *cli.App
	opts options

	project  integrate.Project
	platform integrate.Platform
	// target is the Voidhash project.
	organization, target initcmd.Named
	// inGit is true when the directory is in a git work tree.
	inGit bool
	state integrate.State
	// resumed is true when an earlier run here is being continued.
	resumed bool
	facts   integrate.Facts
	// checks are the commands that must pass.
	checks [][]string
	agent  integrate.Agent
	// model is the model the agent is asked to use; empty for its own.
	model string
	// catalog are the perk, product and location to create.
	create []creation
	// env are the variables to add to the environment file.
	env []envLine

	result result
}

// step prints a finished step to standard error.
func (r *run) step(format string, args ...any) {
	r.app.Notef("%s %s", r.app.ErrStyle().Green("✓"), fmt.Sprintf(format, args...))
}

func (r *run) execute(ctx context.Context) error {
	if err := r.inspect(ctx); err != nil {
		return err
	}
	if err := r.chooseProject(ctx); err != nil {
		return err
	}
	if err := r.readProject(ctx); err != nil {
		return err
	}
	if err := r.chooseAgent(ctx); err != nil {
		return err
	}
	r.printPlan()
	if r.opts.dryRun {
		r.app.Notef("Nothing changed: this was --dry-run.")
		return nil
	}
	if !r.opts.yes && r.app.IsInteractive() {
		proceed, err := r.app.Prompter().Confirm(ctx, "Go ahead?", true)
		if err != nil {
			return err
		}
		if !proceed {
			return &cli.UserError{Message: "Nothing changed."}
		}
	}

	r.state.Platform, r.state.Project = r.platform.ID, r.organization.Slug+"/"+r.target.Slug
	if r.state.StartedAt.IsZero() {
		r.state.StartedAt = r.app.Now()
	}
	if err := r.save(); err != nil {
		return err
	}
	// Each step looks at the project first and does only what is missing,
	// so a second run repeats nothing.
	steps := []func(context.Context) error{
		r.baseline, r.createCatalog, r.installPackages, r.writeFiles, r.runAgent, r.verify, r.connectAgents,
	}
	for _, step := range steps {
		if err := step(ctx); err != nil {
			return err
		}
	}
	return r.summarize(ctx)
}

// inspect finds out what is in the directory: the app, an earlier run, and
// whether git can show what changes.
func (r *run) inspect(ctx context.Context) error {
	project, err := integrate.Inspect(r.app.Dir)
	if err != nil {
		return cli.Failf("Could not read package.json: %s.", err).WithHint("Fix the file, then run 'voidhash integrate' again.")
	}
	r.project = project

	if r.opts.restart {
		if err := integrate.ClearState(r.app.Dir); err != nil {
			return cli.Failf("Could not remove the earlier run's record in %s: %s.", integrate.StateDir, err)
		}
	}
	r.state, r.resumed = integrate.LoadState(r.app.Dir)

	switch {
	case r.opts.platform != "":
		r.platform, _ = integrate.FindPlatform(r.opts.platform)
	case r.resumed:
		r.platform, _ = integrate.FindPlatform(r.state.Platform)
	}
	if r.platform.ID == "" {
		found := integrate.Detect(project)
		if len(found) == 0 {
			return cli.Usagef("This directory does not look like an app the CLI can integrate: it has no package.json, Xcode project, Swift package or Gradle build.").
				WithHint("Run it in your app's root, or name the kind of app: --platform " + strings.Join(integrate.PlatformIDs(), ", ") + ".")
		}
		r.platform = found[0]
	}
	if r.resumed && r.state.Platform != r.platform.ID {
		return cli.Usagef("An earlier run here set this directory up as %s, not %s.", r.state.Platform, r.platform.ID).
			WithHint("Pass --restart to start over.")
	}

	status, code, err := r.capture(ctx, "git", "status", "--porcelain", "--", ".")
	r.inGit = err == nil && code == 0
	if r.resumed || r.opts.allowDirty || r.opts.dryRun {
		return nil
	}
	if !r.inGit {
		return cli.Usagef("This directory is not in a git repository, so what the run changes could not be reviewed or undone.").
			WithHint("Run 'git init' and commit, or pass --allow-dirty to go ahead anyway.")
	}
	if strings.TrimSpace(status) != "" {
		return cli.Usagef("This directory has uncommitted changes, which the run's own changes would be mixed with.").
			WithHint("Commit them or set them aside first, or pass --allow-dirty to go ahead anyway.")
	}
	return nil
}

// chooseProject decides the Voidhash project: the one --project or this
// directory's voidhash.json names, else one chosen or created on a terminal.
func (r *run) chooseProject(ctx context.Context) error {
	session, err := initcmd.SignedIn(r.cmd, r.app)
	if err != nil {
		return err
	}
	_, configured, configErr := r.app.DirectoryConfig()
	if configErr != nil {
		return configErr
	}
	// On a terminal a new app gets to choose, or create, its project. Off
	// one the project is decided as for any command: a link, the default,
	// or the only project there is.
	if r.opts.project == "" && !configured && r.app.IsInteractive() {
		r.organization, r.target, err = initcmd.ChooseProject(ctx, r.app, session, "")
		return err
	}
	resolved, err := r.app.ResolveProject(ctx, r.opts.project)
	if err != nil {
		return err
	}
	if resolved.Organization == nil {
		return cli.Failf("The project %s is named by its organization, which this key does not show.", resolved.Project.Slug).
			WithHint("Sign in as yourself with 'voidhash login', then run 'voidhash integrate' again.")
	}
	r.organization = initcmd.Named{ID: resolved.Organization.Id, Name: resolved.Organization.Name, Slug: resolved.Organization.Slug}
	r.target = initcmd.Named{ID: resolved.Project.Id, Name: resolved.Project.Name, Slug: resolved.Project.Slug}
	if r.resumed && r.state.Project != r.organization.Slug+"/"+r.target.Slug {
		return cli.Usagef("An earlier run here integrated the project %s, not %s/%s.", r.state.Project, r.organization.Slug, r.target.Slug).
			WithHint("Pass --restart to start over.")
	}
	return nil
}

// chooseAgent picks the agent --agent names, else the one an earlier run
// used, else one that is installed: the person's choice in a terminal when
// there are several, and the first otherwise.
// None leaves r.agent nil: the task is then written for the person.
func (r *run) chooseAgent(ctx context.Context) error {
	if r.opts.agent == noAgent {
		return nil
	}
	// A run that was handed off stays so until an agent is asked for.
	if r.opts.agent == "" && r.state.AgentStage == integrate.AgentHandedOff {
		return nil
	}
	wanted := r.opts.agent
	if wanted == "" {
		wanted = r.state.Agent
	}
	var installed []integrate.Agent
	for _, candidate := range integrate.Agents() {
		if wanted != "" && candidate.ID() != wanted {
			continue
		}
		if _, err := r.app.LookPath(candidate.Program()); err == nil {
			installed = append(installed, candidate)
		}
	}
	switch {
	case len(installed) > 1 && !r.opts.yes && r.app.IsInteractive():
		names := make([]string, len(installed))
		for index, candidate := range installed {
			names[index] = candidate.Name()
		}
		picked, err := r.app.Prompter().Select(ctx, "Which coding agent should wire the SDK into your code?", names)
		if err != nil {
			return err
		}
		r.agent = installed[picked]
	case len(installed) > 0:
		r.agent = installed[0]
	case r.opts.agent != "":
		agent, _ := integrate.FindAgent(r.opts.agent)
		r.app.Warnf("%s is not installed here ('%s' is not on your PATH), so the task is written for you instead.", agent.Name(), agent.Program())
	}
	return r.chooseModel()
}

// chooseModel takes the model --model names, else the one an earlier run
// here gave the same agent. Without either the agent uses its own.
func (r *run) chooseModel() error {
	if r.agent == nil {
		if r.opts.model != "" {
			r.app.Warnf("--model is left out: no agent runs.")
		}
		return nil
	}
	r.model = r.opts.model
	if r.model == "" && r.state.Agent == r.agent.ID() {
		r.model = r.state.Model
	}
	switch {
	case r.model == "":
	case !integrate.ValidModel(r.model):
		return cli.Usagef("%q does not look like a model's name.", r.model).
			WithHint("Pass it as " + r.agent.Name() + " names it: letters, digits and . _ : / @ -.")
	case r.agent.ModelHint() == "":
		r.app.Warnf("--model is left out: %s takes its model from its own settings.", r.agent.Name())
		r.model = ""
	}
	return nil
}

// save writes the run's record.
func (r *run) save() error {
	if err := integrate.SaveState(r.app.Dir, r.state); err != nil {
		return cli.Failf("Could not write the run's record in %s: %s.", integrate.StateDir, err)
	}
	return nil
}

// interrupted reports whether err is the run being stopped, by Ctrl+C or
// by its context ending.
func interrupted(ctx context.Context, err error) bool {
	return ctx.Err() != nil || errors.Is(err, context.Canceled)
}

func agentName(id string) string {
	if agent, ok := integrate.FindAgent(id); ok {
		return agent.Name()
	}
	return id
}
