// Package types holds `voidhash types`: the type files generated from a
// project's products, paywall locations and perks.
package types

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/codegen"
	"github.com/voidhashcom/voidhash/apps/cli/internal/projectconfig"
)

const configured = `The files are listed under "types" in voidhash.json, each with its "language" (typescript, swift or kotlin) and "output" path. Without any, one TypeScript declaration file is written to voidhash.gen.d.ts.

A TypeScript file types the Voidhash SDKs the package.json in this directory depends on, @voidhash/react-native and @voidhash/web, or @voidhash/react-native without either. It also lists the project's feature flag keys, leaving archived flags out, and the text values of their variants; a flag or variant added since the file was written is not in it.`

// New creates `voidhash types`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "types",
		Short: "Generate and check the type files of the project's slugs.",
		Long: `Generate and check the type files of this directory's project: its product, paywall location and perk slugs as types of your app's language, so a mistyped slug does not compile.

` + configured,
	}
	cmd.AddCommand(newGenerate(app), newCheck(app))
	return cmd
}

// selection is the --language and --output flags both subcommands take.
type selection struct {
	language *string
	output   *string
}

func addSelection(cmd *cobra.Command) selection {
	return selection{
		language: cli.AddChoiceFlag(cmd, "language", "", projectconfig.Languages, "", "Only the files of this language"),
		output:   cmd.Flags().String("output", "", "Use this `path` instead of the configured one; needs --language when several files are configured"),
	}
}

// target is one type file, with where it is on this computer.
type target struct {
	projectconfig.TypeTarget
	path string
}

// targets are the type files a run is about: the configured ones, narrowed
// by --language, with --output replacing the path of the only one left.
func (s selection) targets(app *cli.App, config *projectconfig.Config) ([]target, error) {
	chosen := config.TypeTargets()
	if *s.language != "" {
		var matching []projectconfig.TypeTarget
		for _, candidate := range chosen {
			if candidate.Language == *s.language {
				matching = append(matching, candidate)
			}
		}
		if len(matching) == 0 {
			if *s.output == "" {
				return nil, cli.Usagef("%s lists no %s types.", config.FileBase(), *s.language).
					WithHint(fmt.Sprintf(`Add {"language": "%s", "output": "<path>"} to the "types" of %s, or pass --output <path>.`, *s.language, projectconfig.FileName))
			}
			matching = []projectconfig.TypeTarget{{Language: *s.language}}
		}
		chosen = matching
	}
	if *s.output != "" {
		if len(chosen) != 1 {
			return nil, cli.Usagef("--output names one file, but %d type files are selected.", len(chosen)).
				WithHint("Pass --language too, to choose which one it is.")
		}
		chosen[0].Output = *s.output
	}
	resolved := make([]target, len(chosen))
	for index, candidate := range chosen {
		path := candidate.Output
		if !filepath.IsAbs(path) {
			path = filepath.Join(app.Dir, path)
		}
		resolved[index] = target{TypeTarget: candidate, path: path}
	}
	return resolved, nil
}

// projectHere is the project this directory's configuration names. The
// type files belong to the app in this directory, so a link or a default
// project does not stand in for the configuration.
func projectHere(ctx context.Context, app *cli.App) (*projectconfig.Config, api.SessionProjectJsonEncoding, error) {
	var none api.SessionProjectJsonEncoding
	config, found, err := app.DirectoryConfig()
	if err != nil {
		return nil, none, err
	}
	if !found {
		return nil, none, cli.Failf("This directory has no %s, which names the project its types are generated from.", projectconfig.FileName).
			WithHint("Run 'voidhash init' here to create one.")
	}
	session, err := app.Session(ctx)
	if err != nil {
		return nil, none, err
	}
	_, project, err := cli.ProjectNamedBy(config, session)
	if err != nil {
		return nil, none, err
	}
	return config, *project, nil
}

// projectSchema is the part of the API's schema answer the types are made
// from.
type projectSchema struct {
	Version  string `json:"version"`
	Products []struct {
		Slug string `json:"slug"`
		Type string `json:"type"`
	} `json:"products"`
	Locations []struct {
		Slug      string `json:"slug"`
		Interface struct {
			Revision int `json:"revision"`
			Inputs   []struct {
				Name    string `json:"name"`
				Type    string `json:"type"`
				Default any    `json:"default"`
			} `json:"inputs"`
			Outputs []struct {
				Name    string `json:"name"`
				Type    string `json:"type"`
				Default any    `json:"default"`
			} `json:"outputs"`
			Outcomes []struct {
				Name string `json:"name"`
			} `json:"outcomes"`
			Actions []struct {
				Name  string           `json:"name"`
				Args  []interfaceField `json:"args"`
				Reply []interfaceField `json:"reply"`
			} `json:"actions"`
		} `json:"interface"`
	} `json:"locations"`
	Perks []struct {
		Slug string `json:"slug"`
	} `json:"perks"`
}

// Fetch reads what the type files are made from: the project's schema and
// its version, and with withFlags its feature flags too, which only the
// TypeScript declarations type and which cost a request per text flag.
func Fetch(ctx context.Context, app *cli.App, projectID string, withFlags bool) (codegen.Schema, string, error) {
	schema, version, err := fetchSchema(ctx, app, projectID)
	if err != nil || !withFlags {
		return schema, version, err
	}
	flags, err := fetchFlags(ctx, app, projectID)
	if err != nil {
		return schema, version, err
	}
	return schema.WithFlags(flags), version, nil
}

func fetchSchema(ctx context.Context, app *cli.App, projectID string) (codegen.Schema, string, error) {
	fetched, err := cli.Fetch[projectSchema](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.SchemaGet(ctx, projectID, nil)
	})
	if err != nil {
		return codegen.Schema{}, "", err
	}
	var products, locations, perks []string
	productTypes := map[string]string{}
	for _, product := range fetched.Value.Products {
		products = append(products, product.Slug)
		productTypes[product.Slug] = product.Type
	}
	var flows []codegen.Flow
	for _, location := range fetched.Value.Locations {
		locations = append(locations, location.Slug)
		declared := location.Interface
		flow := codegen.Flow{Slug: location.Slug, Revision: declared.Revision}
		for _, input := range declared.Inputs {
			flow.Inputs = append(flow.Inputs, codegen.FlowField{Name: input.Name, Type: input.Type, Default: input.Default})
		}
		for _, output := range declared.Outputs {
			flow.Outputs = append(flow.Outputs, codegen.FlowField{Name: output.Name, Type: output.Type, Default: output.Default})
		}
		for _, outcome := range declared.Outcomes {
			flow.Outcomes = append(flow.Outcomes, outcome.Name)
		}
		for _, action := range declared.Actions {
			flow.Actions = append(flow.Actions, codegen.FlowAction{Name: action.Name, Args: fields(action.Args), Reply: fields(action.Reply)})
		}
		flows = append(flows, flow)
	}
	for _, perk := range fetched.Value.Perks {
		perks = append(perks, perk.Slug)
	}
	schema := codegen.NewSchema(products, locations, perks).WithFlows(flows).WithProductTypes(productTypes)
	return schema, fetched.Value.Version, nil
}

// fetchFlags reads the project's flags apps receive (archived ones left
// out), each with the text values its variants hold. Only string and json
// flags can hold text, so only their variants are read.
func fetchFlags(ctx context.Context, app *cli.App, projectID string) ([]codegen.Flag, error) {
	notArchived := api.FeatureFlagsListParamsIsArchivedFalse
	listed, err := cli.ListAll[api.FeatureFlagJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.FeatureFlagsList(ctx, projectID, &api.FeatureFlagsListParams{Cursor: page.Cursor, Limit: page.Limit, IsArchived: &notArchived})
	})
	if err != nil {
		return nil, err
	}
	flags := make([]codegen.Flag, 0, len(listed.Items))
	for _, flag := range listed.Items {
		found := codegen.Flag{Key: flag.Key}
		if flag.Type == api.FeatureFlagTypeString || flag.Type == api.FeatureFlagTypeJson {
			variants, err := cli.ListAll[api.FeatureFlagVariantJsonEncoding](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
				return c.FeatureFlagsListVariants(ctx, projectID, flag.Id, &api.FeatureFlagsListVariantsParams{Cursor: page.Cursor, Limit: page.Limit})
			})
			if err != nil {
				return nil, err
			}
			for _, variant := range variants.Items {
				if text, ok := variant.Value.(string); ok {
					found.Values = append(found.Values, text)
				}
			}
		}
		flags = append(flags, found)
	}
	return flags, nil
}

// flagsPollInterval is how often --watch reads the flags at most. The
// project's version does not cover them, and reading them costs a request
// per text flag, so they are read less often than the version.
const flagsPollInterval = 30 * time.Second

// typesFlags reports whether any of the files is a TypeScript one, the
// only kind that types flags.
func typesFlags(targets []target) bool {
	for _, file := range targets {
		if file.Language == codegen.TypeScript {
			return true
		}
	}
	return false
}

// sdkPackages are the Voidhash SDKs the app in this directory depends on,
// read from its package.json.
func sdkPackages(app *cli.App) []string {
	manifest, err := os.ReadFile(filepath.Join(app.Dir, "package.json"))
	if err != nil {
		return codegen.SDKPackages(nil)
	}
	return codegen.SDKPackages(manifest)
}

// flagsFingerprint is what a file says about the flags, to notice a change.
func flagsFingerprint(schema codegen.Schema) string {
	encoded, _ := json.Marshal(schema.Flags)
	return string(encoded)
}

// interfaceField is an argument or a reply field of an app action.
type interfaceField struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func fields(declared []interfaceField) []codegen.FlowField {
	converted := make([]codegen.FlowField, len(declared))
	for index, field := range declared {
		converted[index] = codegen.FlowField{Name: field.Name, Type: field.Type}
	}
	return converted
}

func fetchVersion(ctx context.Context, app *cli.App, projectID string) (string, error) {
	fetched, err := cli.Fetch[api.SchemaVersionJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.SchemaGetVersion(ctx, projectID, nil)
	})
	return fetched.Value.Version, err
}

// short is a version cut to what tells two apart at a glance.
func short(version string) string {
	const length = len("sha256:") + 12
	if len(version) <= length {
		return version
	}
	return version[:length] + "…"
}

// generate reads the schema, and the flags when a file types them, and
// writes every target, returning what they were made from.
func generate(ctx context.Context, app *cli.App, projectID string, targets []target) (codegen.Schema, string, error) {
	schema, version, err := Fetch(ctx, app, projectID, typesFlags(targets))
	if err != nil {
		return schema, "", err
	}
	return schema, version, write(app, schema, version, targets)
}

// write writes every target from schema.
func write(app *cli.App, schema codegen.Schema, version string, targets []target) error {
	packages := sdkPackages(app)
	for _, file := range targets {
		emitter, ok := codegen.For(file.Language)
		if !ok {
			return cli.Failf("This version of the CLI writes no %s types.", file.Language)
		}
		options := codegen.Options{
			Version:   version,
			FetchedAt: app.Now(),
			// As configured, not where this checkout happens to be: a Kotlin
			// file's package follows from it.
			Output:   file.Output,
			Package:  file.Package,
			Packages: packages,
		}
		content := emitter.Emit(schema, options)
		if err := os.MkdirAll(filepath.Dir(file.path), 0o755); err != nil {
			return cli.Failf("Could not create the directory of %s: %s.", file.Output, pathProblem(err))
		}
		if err := os.WriteFile(file.path, []byte(content), 0o644); err != nil {
			return cli.Failf("Could not write %s: %s.", file.Output, pathProblem(err))
		}
		app.Printf("Wrote %s (%s, version %s)\n", file.Output, file.Language, short(version))
		// What the type file's format cannot hold goes in a file beside it.
		if emitter, ok := emitter.(codegen.WithCompanion); ok {
			companion, needed := emitter.Companion(schema, options)
			if !needed {
				continue
			}
			beside := filepath.Join(filepath.Dir(file.path), filepath.Base(companion.Output))
			if err := os.WriteFile(beside, []byte(companion.Content), 0o644); err != nil {
				return cli.Failf("Could not write %s: %s.", companion.Output, pathProblem(err))
			}
			app.Printf("Wrote %s (%s, version %s)\n", companion.Output, file.Language, short(version))
		}
	}
	return nil
}

// pathProblem is a file error without the path the message already names.
func pathProblem(err error) string {
	var pathErr *os.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err.Error()
	}
	return err.Error()
}

// newGenerate creates `voidhash types generate [--watch]`.
func newGenerate(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "generate",
		Short: "Write the type files from the project as it is now.",
		Long: `Write the type files of this directory's project from its products, paywall locations and perks as they are now.

` + configured + `

With --watch the command keeps running: it asks the server for the project's version every --poll-interval-ms and writes the files again when it changed. The version does not cover feature flags, so it reads them every 30 seconds at most and writes the files again when they changed. The React Native Metro plugin runs it this way next to the dev server.`,
		Example: `voidhash types generate
voidhash types generate --watch
voidhash types generate --language swift --output App/VoidhashTypes.swift`,
	}
	watch := cmd.Flags().Bool("watch", false, "Keep running, and write the files again when the project changes")
	pollIntervalMs := cmd.Flags().Int("poll-interval-ms", 5000, "How often --watch asks the server, in `milliseconds` (default: 5000)")
	chosen := addSelection(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		if *pollIntervalMs <= 0 {
			return cli.Usagef("--poll-interval-ms must be more than 0, got %d.", *pollIntervalMs)
		}
		config, project, err := projectHere(ctx, app)
		if err != nil {
			return err
		}
		targets, err := chosen.targets(app, config)
		if err != nil {
			return err
		}
		schema, version, err := generate(ctx, app, project.Id, targets)
		if err != nil || !*watch {
			return err
		}
		withFlags := typesFlags(targets)
		flags := flagsFingerprint(schema)
		// The version does not cover the flags, so every few polls read them too.
		pollsPerFlagsRead := max(1, int((flagsPollInterval+time.Duration(*pollIntervalMs)*time.Millisecond-1)/(time.Duration(*pollIntervalMs)*time.Millisecond)))
		polls := 0

		interval := time.Duration(*pollIntervalMs) * time.Millisecond
		app.Notef("Watching %s/%s for changes every %s. Press Ctrl+C to stop.", config.Team, config.Project, interval)
		// A server that stays unreachable says so once, not on every poll.
		lastWarning := ""
		warn := func(what string, err error) {
			message := what + ": " + problem(err)
			if message != lastWarning {
				app.Warnf("%s", message)
				lastWarning = message
			}
		}
		for {
			if err := app.Sleep(ctx, interval); err != nil {
				return err
			}
			latest, err := fetchVersion(ctx, app, project.Id)
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if err != nil {
				warn("Could not ask for the project's version; trying again", err)
				continue
			}
			polls++
			if latest == version && (!withFlags || polls%pollsPerFlagsRead != 0) {
				lastWarning = ""
				continue
			}
			var written codegen.Schema
			if latest == version {
				// Only the flags may have changed: read them, and write the
				// files when they did.
				read, writtenVersion, err := Fetch(ctx, app, project.Id, true)
				if ctx.Err() != nil {
					return ctx.Err()
				}
				if err != nil {
					warn("Could not read the project's flags; trying again", err)
					continue
				}
				if flagsFingerprint(read) == flags {
					lastWarning = ""
					continue
				}
				app.Notef("The project's feature flags changed; writing the types again.")
				if err := write(app, read, writtenVersion, targets); err != nil {
					warn("Could not write the types; trying again", err)
					continue
				}
				written, latest = read, writtenVersion
			} else {
				app.Notef("The project changed; writing the types again.")
				read, writtenVersion, err := generate(ctx, app, project.Id, targets)
				if ctx.Err() != nil {
					return ctx.Err()
				}
				if err != nil {
					warn("Could not write the types; trying again", err)
					continue
				}
				written, latest = read, writtenVersion
			}
			version, flags, lastWarning = latest, flagsFingerprint(written), ""
		}
	}
	return cmd
}

// problem is an error as one line of a warning.
func problem(err error) string {
	var described *cli.UserError
	if errors.As(cli.APIError(err, nil), &described) {
		return strings.TrimSuffix(strings.SplitN(described.Message, "\n", 2)[0], ".")
	}
	return "the API did not answer"
}

// newCheck creates `voidhash types check`.
func newCheck(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "check",
		Short: "Fail when a type file is behind the project.",
		Long: `Check that every type file of this directory was generated from the project as it is now, by the version each file carries in its header. Exits with 1 when a file is stale, missing or carries no version, so a build can stop before shipping slugs that no longer exist.

` + configured,
		Example: `voidhash types check
voidhash types check --language kotlin`,
	}
	chosen := addSelection(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		config, project, err := projectHere(ctx, app)
		if err != nil {
			return err
		}
		targets, err := chosen.targets(app, config)
		if err != nil {
			return err
		}
		current, err := fetchVersion(ctx, app, project.Id)
		if err != nil {
			return err
		}

		style := app.Style()
		behind := 0
		for _, file := range targets {
			verdict := ""
			content, err := os.ReadFile(file.path)
			if err != nil {
				verdict = "is missing"
				if !os.IsNotExist(err) {
					verdict = "could not be read: " + pathProblem(err)
				}
			} else if local, ok := codegen.ReadVersion(string(content)); !ok {
				verdict = "has no @voidhash:version line, so it was not generated or was edited"
			} else if local != current {
				verdict = fmt.Sprintf("is stale: generated from %s, the project is at %s", local, current)
			}
			if verdict == "" {
				app.Printf("%s %s is up to date (version %s)\n", style.Green("✓"), file.Output, short(current))
				continue
			}
			behind++
			app.Printf("%s %s %s\n", style.Red("✗"), file.Output, verdict)
		}
		if behind == 0 {
			return nil
		}
		message := "The type file is not up to date with the project."
		if len(targets) > 1 {
			message = fmt.Sprintf("%d of %d type files are not up to date with the project.", behind, len(targets))
		}
		return cli.Failf("%s", message).WithHint("Run 'voidhash types generate', then commit the files it wrote.")
	}
	return cmd
}
