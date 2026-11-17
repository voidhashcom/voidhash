package integrate

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd/initcmd"
	"github.com/voidhashcom/voidhash/apps/cli/internal/integrate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

// What the CLI does itself, before the agent: everything that follows from
// the kind of app and the project, with no reading of the app's code.

// creation is one thing to create in the project's catalog, as the
// arguments of the command that creates it.
type creation struct {
	what, slug string
	command    []string
}

// envLine is one variable to add to the environment file.
type envLine struct {
	name, value string
	secret      bool
}

// capture runs a program in the project and returns what it printed, both
// streams together.
func (r *run) capture(ctx context.Context, name string, args ...string) (output string, exitCode int, err error) {
	var out bytes.Buffer
	exitCode, err = r.app.RunProcess(ctx, cli.Process{Name: name, Args: args, Dir: r.app.Dir, Stdout: &out, Stderr: &out})
	return out.String(), exitCode, err
}

// sub runs another command of the CLI as part of this one. What it prints
// as its result is progress here: it goes to standard error, or nowhere
// when the run says the same in its own words.
func (r *run) sub(ctx context.Context, result io.Writer, args ...string) error {
	other, rest, err := r.cmd.Root().Find(args)
	if err != nil || other == r.cmd.Root() || other.RunE == nil {
		return cli.Failf("Could not run 'voidhash %s' from here.", strings.Join(args, " ")).WithHint("Run it yourself.")
	}
	if err := other.ParseFlags(rest); err != nil {
		return err
	}
	other.SetContext(ctx)
	stdout := r.app.Stdout
	r.app.Stdout = result
	defer func() { r.app.Stdout = stdout }()
	return other.RunE(other, other.Flags().Args())
}

// slugPattern is what a slug passed to --perk, --product or --location
// must look like to be created.
var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,62}$`)

// nameOf makes a display name from a slug: pro_monthly is Pro Monthly.
func nameOf(slug string) string {
	words := strings.FieldsFunc(slug, func(r rune) bool { return r == '-' || r == '_' })
	for index, word := range words {
		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}
	return strings.Join(words, " ")
}

// readProject reads what the run needs of the Voidhash project, and decides
// everything that follows from it: the keys, what to create, the perk,
// product and location the app is wired to, the files, variables and checks.
func (r *run) readProject(ctx context.Context) error {
	settings, err := r.app.Config()
	if err != nil {
		return err
	}
	apiURL := strings.TrimRight(settings.APIURL, "/")
	facts := integrate.Facts{
		Platform:    r.platform,
		ProjectName: r.target.Name, Team: r.organization.Slug, Project: r.target.Slug,
		APIURL: apiURL, CustomAPI: apiURL != integrate.DefaultAPIURL,
		SourceDir: r.project.SourceDir, ScriptExt: "js",
		TypeScript: r.project.TypeScript, PackageManager: r.project.PackageManager,
	}
	if r.project.TypeScript {
		facts.ScriptExt = "ts"
	}

	if r.platform.Key == integrate.PublishableKey {
		publishable := api.ApiKeyType("publishable")
		keys, err := cli.ListAll[struct {
			Environment string  `json:"environment"`
			RawKey      *string `json:"rawKey"`
		}](ctx, r.app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.ApiKeysList(ctx, r.target.ID, &api.ApiKeysListParams{Cursor: page.Cursor, Limit: page.Limit, Type: &publishable})
		})
		if err != nil {
			return err
		}
		for _, key := range keys.Items {
			switch {
			case key.RawKey == nil:
			case key.Environment == "production" && facts.ProductionKey == "":
				facts.ProductionKey = *key.RawKey
			case key.Environment == "test" && facts.TestKey == "":
				facts.TestKey = *key.RawKey
			}
		}
		if facts.ProductionKey == "" {
			return cli.Failf("The project %s has no production publishable key for the app to use.", r.target.Slug).
				WithHint("Create one in the dashboard ('voidhash open keys'), then run 'voidhash integrate' again.")
		}
		if facts.TestKey == "" {
			r.app.Warnf("The project has no test publishable key, so debug builds use the production key too. Create one with 'voidhash open keys'.")
			facts.TestKey = facts.ProductionKey
		}
	}

	type slugged struct {
		Slug string `json:"slug"`
	}
	schema, err := cli.Fetch[struct {
		Products  []slugged `json:"products"`
		Locations []slugged `json:"locations"`
		Perks     []slugged `json:"perks"`
	}](ctx, r.app, func(c *api.Client) (*http.Response, error) {
		return c.SchemaGet(ctx, r.target.ID, nil)
	})
	if err != nil {
		return err
	}
	slugs := func(items []slugged) []string {
		found := make([]string, len(items))
		for index, item := range items {
			found[index] = item.Slug
		}
		return found
	}
	facts.Perks, facts.Products, facts.Locations = slugs(schema.Value.Perks), slugs(schema.Value.Products), slugs(schema.Value.Locations)

	if err := r.planCatalog(ctx, &facts); err != nil {
		return err
	}

	// Files, variables, types and checks follow from the platform's
	// description.
	for _, file := range r.platform.Files {
		path, err := integrate.Render(file.Role, file.Path, facts)
		if err != nil {
			return err
		}
		if file.Role == "client" {
			facts.ClientFile = path
		}
	}
	if r.platform.Env != nil {
		facts.EnvFile = r.platform.Env.File
		for _, value := range r.platform.Env.Values {
			facts.EnvNames = append(facts.EnvNames, value.Name)
			if value.OnlyCustomAPI && !facts.CustomAPI {
				continue
			}
			rendered, err := integrate.Render(value.Name, value.Value, facts)
			if err != nil {
				return err
			}
			r.env = append(r.env, envLine{name: value.Name, value: rendered, secret: value.Secret})
		}
	}
	for _, target := range r.typeTargets() {
		facts.TypesFiles = append(facts.TypesFiles, target.Output)
	}

	if len(r.opts.checks) > 0 {
		for _, command := range r.opts.checks {
			if fields := strings.Fields(command); len(fields) > 0 {
				r.checks = append(r.checks, fields)
			}
		}
	} else {
		r.checks = integrate.CheckCommands(r.platform, r.project)
	}
	for _, command := range r.checks {
		facts.Checks = append(facts.Checks, strings.Join(command, " "))
	}
	facts.BaselineFailed = r.state.BaselineFailed
	r.facts = facts
	return nil
}

// planCatalog decides the perk, product and location the app is wired to,
// and which of them have to be created first: the ones the flags name, or,
// asked on a terminal, a first perk and product for a project with none.
func (r *run) planCatalog(ctx context.Context, facts *integrate.Facts) error {
	project := "--project=" + r.target.ID
	ask := func(what, suggestion string) (string, error) {
		if r.opts.yes || !r.app.IsInteractive() || r.resumed {
			return "", nil
		}
		answer, err := r.app.Prompter().Text(ctx,
			fmt.Sprintf("The project has no %s yet. Create one for the app to use? Type its slug, or - for none", what),
			prompt.TextOptions{Default: suggestion, Validate: func(answer string) (string, error) {
				if answer == "-" || slugPattern.MatchString(answer) {
					return answer, nil
				}
				return "", errors.New("A slug has lowercase letters, digits, - and _.")
			}})
		if answer == "-" {
			answer = ""
		}
		return answer, err
	}
	choose := func(flag, what, capability, suggestion string, existing *[]string) (string, bool, error) {
		if !r.platform.Has(capability) {
			if flag != "" {
				r.app.Warnf("--%s is left out: the %s SDK has no %ss.", what, r.platform.Name, what)
			}
			return "", false, nil
		}
		wanted := flag
		if wanted == "" && len(*existing) == 0 && suggestion != "" {
			var err error
			if wanted, err = ask(what, suggestion); err != nil {
				return "", false, err
			}
		}
		if wanted == "" {
			if len(*existing) > 0 && suggestion != "" {
				if len(*existing) > 1 {
					r.app.Notef("The project has several %ss; the app is wired to %s. Pass --%s to choose another.", what, (*existing)[0], what)
				}
				return (*existing)[0], false, nil
			}
			return "", false, nil
		}
		if slices.Contains(*existing, wanted) {
			return wanted, false, nil
		}
		if !slugPattern.MatchString(wanted) {
			return "", false, cli.Usagef("The project has no %s %q, and it cannot be created by that slug.", what, wanted).
				WithHint("A slug has lowercase letters, digits, - and _.")
		}
		*existing = append(*existing, wanted)
		return wanted, true, nil
	}

	var isNew bool
	var err error
	if facts.Perk, isNew, err = choose(r.opts.perk, "perk", "perks", "premium", &facts.Perks); err != nil {
		return err
	} else if isNew {
		r.create = append(r.create, creation{"perk", facts.Perk,
			[]string{"perk", "create", "--name", nameOf(facts.Perk), "--slug", facts.Perk, project}})
	}
	// A server checks access but sells nothing, so it gets no product.
	if facts.Product, isNew, err = choose(r.opts.product, "product", "purchases", "pro_monthly", &facts.Products); err != nil {
		return err
	} else if isNew {
		command := []string{"product", "create", "--name", nameOf(facts.Product), "--slug", facts.Product, "--type", "subscription", "--period", "monthly", project}
		if facts.Perk != "" {
			command = append(command, "--perk", facts.Perk)
		}
		r.create = append(r.create, creation{"product", facts.Product, command})
	}
	// A location is wired only when asked for: presenting needs a paywall
	// deployed to it.
	if facts.Location, isNew, err = choose(r.opts.location, "location", "paywalls", "", &facts.Locations); err != nil {
		return err
	} else if isNew {
		r.create = append(r.create, creation{"location", facts.Location,
			[]string{"location", "create", "--name", nameOf(facts.Location), "--slug", facts.Location, project}})
	}
	return nil
}

// typeTargets are the type files generated for the platform: the ones the
// directory's configuration lists, else the platform's default.
func (r *run) typeTargets() []projectconfig.TypeTarget {
	if r.platform.Types == "" {
		return nil
	}
	if config, found, err := r.app.DirectoryConfig(); err == nil && found {
		return config.TypeTargets()
	}
	switch r.platform.Types {
	case projectconfig.Swift:
		if _, output, found := initcmd.SwiftProject(r.app.Dir); found {
			return []projectconfig.TypeTarget{{Language: projectconfig.Swift, Output: output}}
		}
	case projectconfig.Kotlin:
		if output, found := initcmd.GradleProject(r.app.Dir); found {
			return []projectconfig.TypeTarget{{Language: projectconfig.Kotlin, Output: output}}
		}
	case projectconfig.TypeScript:
		return []projectconfig.TypeTarget{{Language: projectconfig.TypeScript, Output: projectconfig.DefaultTypesOutput}}
	}
	return nil
}

// baseline runs the project's checks before anything changes, so a check
// that already fails is not held against the integration.
func (r *run) baseline(ctx context.Context) error {
	if r.state.BaselineRun || len(r.checks) == 0 {
		return nil
	}
	for index, command := range r.checks {
		joined := strings.Join(command, " ")
		r.app.Notef("Running %s before changing anything…", joined)
		output, code, err := r.capture(ctx, command[0], command[1:]...)
		if interrupted(ctx, err) {
			return ctx.Err()
		}
		if err != nil || code != 0 {
			r.state.BaselineFailed = append(r.state.BaselineFailed, joined)
			// Its output is kept, to tell the errors it has now from new ones.
			if err := integrate.WriteStateFile(r.app.Dir, baselineLog(index), output); err != nil {
				return cli.Failf("Could not write the run's record in %s: %s.", integrate.StateDir, err)
			}
			r.app.Warnf("%s already fails, before any change. The run goes on, and only errors it does not report now are held against it.", joined)
			continue
		}
		r.step("%s passes before any change", joined)
	}
	r.state.BaselineRun = true
	r.facts.BaselineFailed = r.state.BaselineFailed
	return r.save()
}

// createCatalog creates the perk, product and location the plan named.
// They were checked against the project when the run started, so a second
// run finds them and creates nothing.
func (r *run) createCatalog(ctx context.Context) error {
	for _, item := range r.create {
		if err := r.sub(ctx, io.Discard, item.command...); err != nil {
			return err
		}
		r.step("Created the %s %s", item.what, item.slug)
	}
	return nil
}

// installPackages adds the SDK's packages with the project's package
// manager, skipping the ones package.json already lists.
func (r *run) installPackages(ctx context.Context) error {
	missing := integrate.MissingPackages(r.platform, r.project)
	if len(missing) == 0 {
		return nil
	}
	if r.project.PackageManager == "pnpm" {
		if err := r.pnpmSettings(); err != nil {
			return err
		}
	}
	command := integrate.InstallCommand(r.project.PackageManager, missing)
	r.app.Notef("Installing %s (%s)…", packageNames(missing), strings.Join(command[:2], " "))
	output, code, err := r.capture(ctx, command[0], command[1:]...)
	if interrupted(ctx, err) {
		return ctx.Err()
	}
	if err != nil || code != 0 {
		problem := lastLines(output, 15)
		if err != nil {
			problem = err.Error()
		}
		return cli.Failf("%s failed:\n%s", strings.Join(command, " "), problem).
			WithHint("Fix what it reports, or install the packages yourself, then run 'voidhash integrate' again: it continues from here.")
	}
	r.step("Installed %s", packageNames(missing))
	// package.json changed: read it again for the steps that follow.
	if project, err := integrate.Inspect(r.app.Dir); err == nil {
		r.project = project
	}
	return nil
}

func packageNames(packages []integrate.Package) string {
	names := make([]string, len(packages))
	for index, item := range packages {
		names[index] = item.Name
	}
	return strings.Join(names, ", ")
}

// pnpmSettings adds the settings pnpm needs to install the SDK to this
// directory's pnpm-workspace.yaml. A workspace whose file is above this
// directory is the person's to change.
func (r *run) pnpmSettings() error {
	if len(r.platform.PnpmSettings) == 0 {
		return nil
	}
	path := filepath.Join(r.app.Dir, "pnpm-workspace.yaml")
	existing, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return cli.Failf("Could not read pnpm-workspace.yaml: %s.", err)
	}
	var added []string
	content := string(existing)
	for _, key := range sortedKeys(r.platform.PnpmSettings) {
		if regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(key) + `\s*:`).MatchString(content) {
			continue
		}
		if content != "" && !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		content += key + ": " + r.platform.PnpmSettings[key] + "\n"
		added = append(added, key)
	}
	if len(added) == 0 {
		return nil
	}
	if os.IsNotExist(err) {
		for dir := filepath.Dir(r.app.Dir); filepath.Dir(dir) != dir; dir = filepath.Dir(dir) {
			if _, statErr := os.Stat(filepath.Join(dir, "pnpm-workspace.yaml")); statErr == nil {
				r.app.Warnf("This app is in a pnpm workspace. If the install fails, add '%s: %s' to %s yourself: the CLI changes nothing outside this directory.",
					added[0], r.platform.PnpmSettings[added[0]], filepath.Join(dir, "pnpm-workspace.yaml"))
				return nil
			}
		}
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return cli.Failf("Could not write pnpm-workspace.yaml: %s.", err)
	}
	r.wrote("pnpm-workspace.yaml")
	r.step("Set %s in pnpm-workspace.yaml, which pnpm needs to install the SDK", strings.Join(added, ", "))
	return nil
}

func sortedKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

// wrote records a file the CLI itself wrote.
func (r *run) wrote(file string) {
	if !slices.Contains(r.state.Wrote, file) {
		r.state.Wrote = append(r.state.Wrote, file)
	}
}

// writeFiles writes voidhash.json, the platform's files, the environment
// values and the generated types. A file that exists is kept as it is.
func (r *run) writeFiles(ctx context.Context) error {
	var written []string
	if _, found, _ := r.app.DirectoryConfig(); !found {
		config := &projectconfig.Config{Team: r.organization.Slug, Project: r.target.Slug}
		targets := r.typeTargets()
		// A lone TypeScript file at its usual path is the default, and left out.
		if len(targets) > 0 && !(len(targets) == 1 && targets[0].Language == projectconfig.TypeScript) {
			config.Types = targets
		}
		if _, err := projectconfig.Write(r.app.Dir, config); err != nil {
			return cli.Failf("Could not write %s: %s.", projectconfig.FileName, err)
		}
		written = append(written, projectconfig.FileName)
		r.wrote(projectconfig.FileName)
	}

	for _, file := range r.platform.Files {
		path, err := integrate.Render(file.Role, file.Path, r.facts)
		if err != nil {
			return err
		}
		target := filepath.Join(r.app.Dir, filepath.FromSlash(path))
		if _, err := os.Stat(target); err == nil {
			continue
		}
		content, err := integrate.Render(file.Role, file.Content, r.facts)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return cli.Failf("Could not create the directory of %s: %s.", path, err)
		}
		if err := os.WriteFile(target, []byte(content), 0o644); err != nil {
			return cli.Failf("Could not write %s: %s.", path, err)
		}
		written = append(written, path)
		r.wrote(path)
	}

	added, err := r.writeEnv(ctx)
	if err != nil {
		return err
	}
	if len(added) > 0 {
		written = append(written, fmt.Sprintf("%s (%s)", r.facts.EnvFile, strings.Join(added, ", ")))
	}
	if len(written) > 0 {
		r.step("Wrote %s", strings.Join(written, ", "))
	}

	if len(r.facts.TypesFiles) > 0 {
		// Failing to generate the types does not undo the setup.
		if err := r.sub(ctx, io.Discard, "types", "generate"); err != nil {
			if interrupted(ctx, err) {
				return ctx.Err()
			}
			r.app.Warnf("Could not generate the types: %s Run 'voidhash types generate' later.", err)
		} else {
			for _, file := range r.facts.TypesFiles {
				r.wrote(file)
			}
			r.step("Generated the project's slugs as types: %s", strings.Join(r.facts.TypesFiles, ", "))
		}
	}
	return r.save()
}

// missingEnv names the platform's variables its environment file does not
// define yet.
func (r *run) missingEnv() []string {
	if len(r.env) == 0 {
		return nil
	}
	existing, _ := os.ReadFile(filepath.Join(r.app.Dir, r.facts.EnvFile))
	var missing []string
	for _, line := range r.env {
		if !regexp.MustCompile(`(?m)^\s*(export\s+)?` + regexp.QuoteMeta(line.name) + `\s*=`).Match(existing) {
			missing = append(missing, line.name)
		}
	}
	return missing
}

// writeEnv adds the platform's variables to its environment file, leaving
// every variable that is already there, and keeps the file out of git. It
// returns the names it added.
func (r *run) writeEnv(ctx context.Context) ([]string, error) {
	added := r.missingEnv()
	if len(added) == 0 {
		return nil, nil
	}
	path := filepath.Join(r.app.Dir, r.facts.EnvFile)
	existing, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return nil, cli.Failf("Could not read %s: %s.", r.facts.EnvFile, err)
	}
	content := string(existing)
	for _, line := range r.env {
		if !slices.Contains(added, line.name) {
			continue
		}
		if content != "" && !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		content += line.name + "=" + line.value + "\n"
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		return nil, cli.Failf("Could not write %s: %s.", r.facts.EnvFile, err)
	}
	r.wrote(r.facts.EnvFile)
	if r.inGit {
		if _, code, err := r.capture(ctx, "git", "check-ignore", "-q", r.facts.EnvFile); err == nil && code == 1 {
			ignore := filepath.Join(r.app.Dir, ".gitignore")
			rules, _ := os.ReadFile(ignore)
			text := string(rules)
			if text != "" && !strings.HasSuffix(text, "\n") {
				text += "\n"
			}
			if err := os.WriteFile(ignore, []byte(text+r.facts.EnvFile+"\n"), 0o644); err == nil {
				r.wrote(".gitignore")
				r.step("Added %s to .gitignore", r.facts.EnvFile)
			}
		}
	}
	return added, nil
}

// lastLines is the end of a program's output, for an error message.
func lastLines(output string, count int) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) > count {
		lines = lines[len(lines)-count:]
	}
	return "  " + strings.Join(lines, "\n  ")
}
