// Package initcmd holds `voidhash init`: setting a directory up for a
// Voidhash project.
package initcmd

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/types"
	"github.com/voidhashcom/voidhash/apps/cli/internal/codegen"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// New creates `voidhash init`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "init",
		Short: "Set this directory up for a Voidhash project.",
		Long: `Set this directory up for a Voidhash project: sign in if needed, choose or create the organization and project, and write voidhash.json, which names the project for every command run here and is meant to be committed.

What else is written depends on the app found here:
  a JavaScript project (package.json)
      the React Native SDK client, in src/lib or lib, with the project's
      publishable key, and the TypeScript declarations voidhash.gen.d.ts
  an Xcode project or a Swift package
      Swift types of the project's product, location and perk slugs
  a Gradle project
      Kotlin types of the same

The command asks before it replaces a configuration or a file it did not generate; --yes answers yes. Off a terminal, pass --project.`,
		Example: `voidhash init
voidhash init --project acme/app --yes`,
	}
	project := cmd.Flags().String("project", "", "The project to set up for: its slug, organization/slug, name or id (default: asks)")
	yes := cmd.Flags().BoolP("yes", "y", false, "Replace an existing configuration and files without asking")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		return run(cmd, app, *project, *yes)
	}
	return cmd
}

// Named is an organization or a project, by what init reads of it.
type Named struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

func run(cmd *cobra.Command, app *cli.App, projectFlag string, yes bool) error {
	ctx := cmd.Context()

	// 1. What is here already.
	existing, found, loadErr := app.LoadDirectoryConfig(app.Dir)
	switch {
	case loadErr != nil:
		// A configuration that cannot be read is still one to replace.
		app.Warnf("%s.", loadErr)
		if err := app.ConfirmChange(ctx, yes, "This directory has a Voidhash configuration that cannot be read. Set it up again, replacing it?"); err != nil {
			return err
		}
	case found:
		question := fmt.Sprintf("This directory is already set up: %s names the project %s/%s. Set it up again, replacing the configuration?",
			existing.FileBase(), existing.Team, existing.Project)
		if err := app.ConfirmChange(ctx, yes, question); err != nil {
			return err
		}
	}

	// 2. Who, and for which project.
	session, err := SignedIn(cmd, app)
	if err != nil {
		return err
	}
	organization, project, err := ChooseProject(ctx, app, session, projectFlag)
	if err != nil {
		return err
	}

	// 3. The keys apps ship with. The client uses the production one; the
	// test one is printed for debug, staging and test builds.
	publishable := api.ApiKeyType("publishable")
	keys, err := cli.ListAll[struct {
		Type        string  `json:"type"`
		Environment string  `json:"environment"`
		RawKey      *string `json:"rawKey"`
	}](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.ApiKeysList(ctx, project.ID, &api.ApiKeysListParams{Cursor: page.Cursor, Limit: page.Limit, Type: &publishable})
	})
	if err != nil {
		return err
	}
	keyOf := func(environment string) string {
		for _, key := range keys.Items {
			if key.Type == "publishable" && key.Environment == environment && key.RawKey != nil {
				return *key.RawKey
			}
		}
		return ""
	}
	publishableKey := keyOf("production")
	if publishableKey == "" {
		return cli.Failf("The project %s has no production publishable key for the app to use.", project.Slug).
			WithHint("Create one in the dashboard ('voidhash open keys'), then run 'voidhash init' again.")
	}

	// 4. What to write, decided and confirmed before anything is written.
	plan, err := planFiles(ctx, app, yes)
	if err != nil {
		return err
	}
	config := &projectconfig.Config{Team: organization.Slug, Project: project.Slug}
	// A lone TypeScript file at its usual path is the default, and left out.
	if len(plan.types) != 1 || plan.types[0].Language != projectconfig.TypeScript {
		config.Types = plan.types
	}

	// 5. Write.
	if _, err := projectconfig.Write(app.Dir, config); err != nil {
		return cli.Failf("Could not write %s: %s.", projectconfig.FileName, fileProblem(err))
	}
	written := []cli.Field{{Label: "Config", Value: projectconfig.FileName}}
	var notes []string
	for _, name := range projectconfig.LegacyFileNames {
		// The earlier configuration would only disagree with the new one.
		if err := os.Remove(filepath.Join(app.Dir, name)); err == nil {
			notes = append(notes, fmt.Sprintf("Removed %s, which %s replaces.", name, projectconfig.FileName))
		}
	}
	if plan.client != "" {
		if plan.writeClient {
			if err := writeFile(app.Dir, plan.client, clientSource(publishableKey)); err != nil {
				return cli.Failf("Could not write %s: %s.", plan.client, fileProblem(err))
			}
			written = append(written, cli.Field{Label: "Client", Value: plan.client})
		} else {
			notes = append(notes, fmt.Sprintf("Kept %s as it is.", plan.client))
		}
	}
	// Failing to generate the types does not undo the setup: they can be
	// generated later.
	if len(plan.types) > 0 {
		if outputs, err := generateTypes(ctx, app, project.ID, plan.types); err != nil {
			app.Warnf("Could not generate the types: %s. Run 'voidhash types generate' later.", oneLine(err))
		} else {
			written = append(written, cli.Field{Label: "Types", Value: strings.Join(outputs, "\n")})
		}
	}

	// 6. Say what happened and what comes next.
	app.Printf("Set up Voidhash for %s.\n", cli.Printable(project.Name+" ("+organization.Slug+"/"+project.Slug+")"))
	app.Println(cli.FormatFields(written))
	for _, note := range notes {
		app.Println(note)
	}
	app.Println("")
	if plan.client != "" {
		app.Println("The client uses the production publishable key.")
	} else {
		app.Println("Start the SDK with the production publishable key: " + cli.Printable(publishableKey))
	}
	if testKey := keyOf("test"); testKey != "" {
		app.Println("For debug, staging and test builds, use the test publishable key instead: " + cli.Printable(testKey))
		app.Println("  It reads store sandbox and test purchases only, and debug builds simulate purchases only with it; test purchases never unlock production.")
	}
	app.Println("")
	app.Println("Next steps:")
	steps := []string{}
	if plan.client != "" {
		steps = append(steps, fmt.Sprintf("Wrap your app with <voidhash.Provider> from %s.", plan.client))
	}
	for _, target := range plan.types {
		switch target.Language {
		case projectconfig.Swift:
			steps = append(steps, fmt.Sprintf("Add %s to your app's target if Xcode does not pick it up, and pass its cases where the SDK takes a slug: VoidhashPerkSlug.<perk>.rawValue.", target.Output))
		case projectconfig.Kotlin:
			steps = append(steps, fmt.Sprintf("Pass the constants of %s where the SDK takes a slug: VoidhashPerkSlug.<PERK>.value.", target.Output))
		}
	}
	steps = append(steps,
		"Create your products, perks and paywall locations ('voidhash product create', 'voidhash perk create', 'voidhash location create').",
		"Check what the project still needs with 'voidhash status'.",
	)
	if len(plan.types) > 0 {
		steps = append(steps, "Run 'voidhash types generate' again whenever the project's products, locations or perks change.")
	} else {
		steps = append(steps, fmt.Sprintf(`To get the project's slugs as types, list them under "types" in %s ('voidhash types --help'), then run 'voidhash types generate'.`, projectconfig.FileName))
	}
	for index, step := range steps {
		app.Printf("  %d. %s\n", index+1, step)
	}

	// 7. Agents.
	if !app.IsInteractive() {
		app.Notef("Connect your AI agents (Claude Code, Cursor, Codex, ...) to Voidhash with 'voidhash mcp install'.")
		return nil
	}
	connect, err := app.Prompter().Confirm(ctx, "Connect your AI agents (Claude Code, Cursor, Codex, ...) to Voidhash too?", true)
	if err != nil || !connect {
		return err
	}
	return runCommand(cmd, "mcp", "install")
}

// runCommand runs another command of the CLI as part of this one, with its
// flags at their defaults.
func runCommand(cmd *cobra.Command, path ...string) error {
	other, _, err := cmd.Root().Find(path)
	if err != nil || other.RunE == nil || other.CommandPath() != cmd.Root().Name()+" "+strings.Join(path, " ") {
		return cli.Failf("Could not run 'voidhash %s' from here.", strings.Join(path, " ")).WithHint("Run it yourself.")
	}
	other.SetContext(cmd.Context())
	return other.RunE(other, nil)
}

// SignedIn is the session, after signing in on a terminal when nobody is.
func SignedIn(cmd *cobra.Command, app *cli.App) (*cli.Session, error) {
	ctx := cmd.Context()
	session, err := app.Session(ctx)
	var refused *cli.UserError
	if err == nil || !errors.As(err, &refused) || refused.ExitCode != cli.ExitUnauthenticated {
		return session, err
	}
	// VOIDHASH_API_KEY wins over any sign-in, so when the server refuses
	// it, signing in cannot help.
	if !app.IsInteractive() || app.Credentials(ctx).EnvironmentKey() != "" {
		return nil, err
	}
	proceed, askErr := app.Prompter().Confirm(ctx, "You are not signed in. Sign in now? You approve a code in your browser.", true)
	if askErr != nil {
		return nil, askErr
	}
	if !proceed {
		return nil, err
	}
	if err := runCommand(cmd, "login"); err != nil {
		return nil, err
	}
	return app.Session(ctx)
}

// validName accepts the name of a new organization or project.
func validName(what string) func(string) (string, error) {
	return func(answer string) (string, error) {
		if length := len([]rune(answer)); length < 3 || length > 32 {
			return "", fmt.Errorf("The %s's name must have 3 to 32 characters.", what)
		}
		return answer, nil
	}
}

// ChooseProject is the organization and project to set up for: the one
// --project names, else chosen, or created, on a terminal.
func ChooseProject(ctx context.Context, app *cli.App, session *cli.Session, flag string) (Named, Named, error) {
	var none Named
	if flag != "" {
		project, err := cli.FindItem(cli.ProjectKind(session), session.Projects, flag)
		if err != nil {
			return none, none, err
		}
		organization := session.OrganizationOf(project)
		if organization == nil {
			return none, none, cli.Failf("%s names the project by its organization, which this key does not show.", projectconfig.FileName).
				WithHint("Sign in as yourself with 'voidhash login', then run 'voidhash init' again.")
		}
		return Named{organization.Id, organization.Name, organization.Slug}, Named{project.Id, project.Name, project.Slug}, nil
	}
	if !app.IsInteractive() {
		return none, none, cli.MissingInput("the project", "voidhash init --project <project>")
	}

	const create = -1
	var organization Named
	chosen := create
	if len(session.Organizations) > 0 {
		choices := make([]cli.Choice[int], 0, len(session.Organizations)+1)
		for index, candidate := range session.Organizations {
			choices = append(choices, cli.Choice[int]{Title: candidate.Name + " (" + candidate.Slug + ")", Value: index})
		}
		choices = append(choices, cli.Choice[int]{Title: "+ Create a new organization", Value: create})
		var err error
		if chosen, err = cli.RequireChoice(ctx, app, nil, cli.ChoicePrompt[int]{Message: "Which organization owns the project?", Choices: choices}); err != nil {
			return none, none, err
		}
	}
	if chosen == create {
		name, err := app.RequireText(ctx, "", cli.TextPrompt{Message: "A name for the new organization", Validate: validName("organization")})
		if err != nil {
			return none, none, err
		}
		created, err := cli.Fetch[Named](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.OrganizationsCreate(ctx, api.OrganizationsCreateJSONRequestBody{Name: name})
		})
		if err != nil {
			return none, none, err
		}
		organization = created.Value
		app.Notef("Created the organization %s.", cli.Printable(organization.Name))
	} else {
		picked := session.Organizations[chosen]
		organization = Named{picked.Id, picked.Name, picked.Slug}
	}

	projects := session.ProjectsIn(organization.ID)
	chosen = create
	if len(projects) > 0 {
		choices := make([]cli.Choice[int], 0, len(projects)+1)
		for index, candidate := range projects {
			choices = append(choices, cli.Choice[int]{Title: candidate.Name + " (" + candidate.Slug + ")", Value: index})
		}
		choices = append(choices, cli.Choice[int]{Title: "+ Create a new project", Value: create})
		var err error
		if chosen, err = cli.RequireChoice(ctx, app, nil, cli.ChoicePrompt[int]{Message: "Which project is this app built for?", Choices: choices}); err != nil {
			return none, none, err
		}
	}
	if chosen != create {
		picked := projects[chosen]
		return organization, Named{picked.Id, picked.Name, picked.Slug}, nil
	}
	name, err := app.RequireText(ctx, "", cli.TextPrompt{Message: "A name for the new project", Validate: validName("project")})
	if err != nil {
		return none, none, err
	}
	created, err := cli.Fetch[Named](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ProjectsCreate(ctx, organization.ID, api.ProjectsCreateJSONRequestBody{Name: name})
	})
	if err != nil {
		return none, none, err
	}
	app.Notef("Created the project %s.", cli.Printable(created.Value.Name))
	return organization, created.Value, nil
}

// plan is what init writes besides voidhash.json.
type plan struct {
	// client is the SDK client file of a JavaScript project; empty for
	// other apps. writeClient is false when the person keeps theirs.
	client      string
	writeClient bool
	types       []projectconfig.TypeTarget
}

// planFiles decides what to write for the app in this directory, asking
// where the types go and before a file init did not generate is replaced.
func planFiles(ctx context.Context, app *cli.App, yes bool) (plan, error) {
	var planned plan
	if isJavaScriptProject(app.Dir) {
		planned.client = clientFile(app.Dir)
		planned.writeClient = true
		if exists(app.Dir, filepath.FromSlash(planned.client)) && !yes {
			// Their client may hold their own options: kept unless they say so.
			planned.writeClient = false
			if app.IsInteractive() {
				replace, err := app.Prompter().Confirm(ctx, planned.client+" exists. Replace it with a new client?", false)
				if err != nil {
					return planned, err
				}
				planned.writeClient = replace
			}
		}
		planned.types = append(planned.types, projectconfig.TypeTarget{Language: projectconfig.TypeScript, Output: projectconfig.DefaultTypesOutput})
	}

	offer := func(language, what, output string) error {
		if app.IsInteractive() {
			wanted, err := app.Prompter().Confirm(ctx, fmt.Sprintf("This is %s. Generate %s types of the project's product, location and perk slugs?", what, languageName(language)), true)
			if err != nil || !wanted {
				return err
			}
			output, err = app.RequireText(ctx, "", cli.TextPrompt{
				Message: "Where should the file go",
				Initial: output,
				Validate: func(answer string) (string, error) {
					if filepath.IsAbs(answer) {
						return "", errors.New("Type a path inside this directory.")
					}
					return filepath.ToSlash(filepath.Clean(answer)), nil
				},
			})
			if err != nil {
				return err
			}
		}
		planned.types = append(planned.types, projectconfig.TypeTarget{Language: language, Output: output})
		return nil
	}
	if what, output, found := SwiftProject(app.Dir); found {
		if err := offer(projectconfig.Swift, what, output); err != nil {
			return planned, err
		}
	}
	if output, found := GradleProject(app.Dir); found {
		if err := offer(projectconfig.Kotlin, "a Gradle project", output); err != nil {
			return planned, err
		}
	}

	for _, target := range planned.types {
		content, err := os.ReadFile(filepath.Join(app.Dir, filepath.FromSlash(target.Output)))
		if err != nil || codegen.IsGenerated(string(content)) {
			continue
		}
		question := fmt.Sprintf("%s exists and was not generated by voidhash. Replace it with the generated types?", target.Output)
		if err := app.ConfirmChange(ctx, yes, question); err != nil {
			return planned, err
		}
	}
	return planned, nil
}

func languageName(language string) string {
	switch language {
	case projectconfig.Swift:
		return "Swift"
	case projectconfig.Kotlin:
		return "Kotlin"
	default:
		return "TypeScript"
	}
}

// clientSource is the SDK client module of a React Native app, with the
// publishable key filled in so it works as it is. The app uses it as one
// `voidhash` object: <voidhash.Provider>, voidhash.useProducts().
func clientSource(publishableKey string) string {
	return strings.Join([]string{
		`import { createVoidhashClient } from "@voidhash/react-native";`,
		"",
		"/**",
		" * Voidhash SDK client. Safe to edit.",
		" *",
		" * Use it like `<voidhash.Provider>` and `voidhash.useProducts()`. The",
		" * publishable key is safe to ship in client code.",
		" */",
		`export const voidhash = createVoidhashClient("` + publishableKey + `", { dev: true });`,
		"",
	}, "\n")
}

func writeFile(dir, relative, content string) error {
	path := filepath.Join(dir, filepath.FromSlash(relative))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

// generateTypes writes the type files from the project as it is now and
// returns their paths.
func generateTypes(ctx context.Context, app *cli.App, projectID string, targets []projectconfig.TypeTarget) ([]string, error) {
	withFlags := false
	for _, target := range targets {
		withFlags = withFlags || target.Language == codegen.TypeScript
	}
	schema, version, err := types.Fetch(ctx, app, projectID, withFlags)
	if err != nil {
		return nil, err
	}
	manifest, err := os.ReadFile(filepath.Join(app.Dir, "package.json"))
	if err != nil {
		manifest = nil
	}
	packages := codegen.SDKPackages(manifest)
	var outputs []string
	for _, target := range targets {
		emitter, ok := codegen.For(target.Language)
		if !ok {
			continue
		}
		content := emitter.Emit(schema, codegen.Options{
			Version:   version,
			FetchedAt: app.Now(),
			Output:    target.Output,
			Package:   target.Package,
			Packages:  packages,
		})
		if err := writeFile(app.Dir, target.Output, content); err != nil {
			return nil, cli.Failf("%s could not be written: %s", target.Output, fileProblem(err))
		}
		outputs = append(outputs, target.Output)
	}
	return outputs, nil
}

// fileProblem is a file error without the path the message already names.
func fileProblem(err error) string {
	var pathErr *os.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err.Error()
	}
	return err.Error()
}

// oneLine is an error as part of a sentence.
func oneLine(err error) string {
	var described *cli.UserError
	if errors.As(cli.APIError(err, nil), &described) {
		return strings.TrimSuffix(strings.SplitN(described.Message, "\n", 2)[0], ".")
	}
	return err.Error()
}
