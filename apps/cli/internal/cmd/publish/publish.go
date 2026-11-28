// Package publish holds the `voidhash publish` command.
package publish

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/workingcopy"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

const (
	buildPollInterval = 2 * time.Second
	buildWaitTimeout  = 10 * time.Minute
)

// New creates `voidhash publish [--all] [--component <slug>]... [--yes]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "publish",
		Short: "Publish the new and modified components of .voidhash/ as new catalog versions.",
		Long: `Publish the working copy's new and modified components as new catalog versions, which the server builds from their src/**.rs and Cargo.toml.

Newer catalog versions are merged into the working copy first, as 'voidhash dev' does; a component with conflicts cannot be published until they are resolved. The command waits for every build and fails when one did not build.

On a terminal it asks which components to publish; anywhere else, pass --all or --component. With --json it prints the published versions, with -q their ids.`,
		Example: `voidhash publish
voidhash publish --all --yes
voidhash publish --component sale-badge --component wheel-picker`,
	}
	all := cmd.Flags().Bool("all", false, "Publish every new and modified component")
	named := cli.AddStringsFlag(cmd, "component", "", "Publish this component, by its `slug`")
	yes := cli.AddYesFlag(cmd)
	cmd.Flags().Lookup("yes").Usage = "Publish without asking for confirmation"
	output := cli.AddOutputFlags(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := componentapi.Open(ctx, app)
		if err != nil {
			return err
		}
		workingCopy := target.WorkingCopy
		catalog := componentapi.Catalog{App: app, ProjectID: target.Project.Id}

		events, _, err := workingcopy.Sync(ctx, workingCopy, catalog, false)
		if err != nil {
			return componentapi.FileError(err, "Could not update the working copy")
		}
		for _, event := range events {
			if event.Kind != workingcopy.NotEditable {
				app.Notef("%s", cli.PrintableLines(event.Format()))
			}
		}

		state, err := workingCopy.ReadState()
		if err != nil {
			return componentapi.FileError(err, "Could not read the working copy")
		}
		slugs, err := workingCopy.ListComponents()
		if err != nil {
			return componentapi.FileError(err, "Could not read the working copy")
		}
		var candidates, listed []workingcopy.PublishCandidate
		for _, slug := range slugs {
			files, err := workingCopy.ReadComponentFiles(slug)
			if err != nil {
				return componentapi.FileError(err, "Could not read "+slug)
			}
			var entry *workingcopy.ComponentState
			if found, ok := state.Components[slug]; ok {
				entry = &found
			}
			candidate := workingcopy.Candidate(slug, files, entry)
			candidates = append(candidates, candidate)
			if candidate.Kind != workingcopy.KindUnchanged {
				listed = append(listed, candidate)
			}
		}
		if len(listed) == 0 {
			app.Notef("Nothing to publish: every component matches its catalog version.")
			return printPublished(app, mode, nil)
		}
		app.Notef("Changes in the working copy:\n%s\n", formatCandidates(listed))

		selection := workingcopy.SelectForPublish(candidates, *all, *named, app.IsInteractive())
		switch {
		case selection.Refusal != "" && !*all && len(*named) == 0:
			return cli.Usagef("%s", selection.Refusal).WithHint("Such as 'voidhash publish --all --yes'.")
		case selection.Refusal != "":
			return cli.Failf("%s", selection.Refusal)
		case selection.NeedsPrompt:
			if selection.Slugs, err = chooseComponents(ctx, app, listed); err != nil {
				return err
			}
		}
		if len(selection.Slugs) == 0 {
			app.Notef("Nothing selected.")
			return printPublished(app, mode, nil)
		}
		if *all {
			var skipped []string
			for _, candidate := range listed {
				if candidate.Kind == workingcopy.KindConflicted {
					skipped = append(skipped, candidate.Slug)
				}
			}
			if len(skipped) > 0 {
				app.Notef("Skipping %s: resolve the conflicts first.", strings.Join(skipped, ", "))
			}
		}
		// A run without a terminal named what to publish, which is its consent.
		if app.IsInteractive() && !*yes {
			question := fmt.Sprintf("Publish %s to %s as new catalog versions?", strings.Join(selection.Slugs, ", "), target.Label())
			confirmed, err := app.Prompter().Confirm(ctx, cli.Printable(question), true)
			if err != nil {
				return err
			}
			if !confirmed {
				app.Notef("Nothing published.")
				return nil
			}
		}

		var published []cli.Object[componentapi.Version]
		var failed []string
		for _, slug := range selection.Slugs {
			version, err := publishComponent(ctx, app, mode, target, slug)
			switch {
			case err == nil:
				published = append(published, version)
			case errors.Is(err, context.Canceled), errors.Is(err, prompt.ErrInterrupted):
				return err
			default:
				// One component's failure is reported, and the others still publish.
				failed = append(failed, slug)
				app.Notef("%s", app.ErrStyle().Red("✗")+" "+cli.PrintableLines(slug+": "+message(err)))
			}
		}
		if err := printPublished(app, mode, published); err != nil {
			return err
		}
		if len(failed) > 0 {
			return cli.Failf("%d of %d did not publish: %s.", len(failed), len(selection.Slugs), strings.Join(failed, ", "))
		}
		return nil
	}
	return cmd
}

// message is what an error says, with its next step.
func message(err error) string {
	var userError *cli.UserError
	if errors.As(componentapi.Error(err), &userError) {
		return userError.Line()
	}
	return err.Error()
}

// formatCandidates writes one line per listed component: its kind and its
// per-file summary.
func formatCandidates(listed []workingcopy.PublishCandidate) string {
	width := 0
	for _, candidate := range listed {
		width = max(width, len(candidate.Slug))
	}
	lines := make([]string, len(listed))
	for index, candidate := range listed {
		summary := candidate.FormatChanges()
		if candidate.Kind == workingcopy.KindConflicted {
			summary = "resolve the conflict markers first"
		}
		lines[index] = fmt.Sprintf("  %-*s  %-10s  %s", width, candidate.Slug, candidate.Kind, summary)
	}
	return cli.PrintableLines(strings.Join(lines, "\n"))
}

// chooseComponents asks which of the listed components to publish. Enter
// takes every one that can be published.
func chooseComponents(ctx context.Context, app *cli.App, listed []workingcopy.PublishCandidate) ([]string, error) {
	var selectable []string
	for _, candidate := range listed {
		if candidate.IsSelectable() {
			selectable = append(selectable, candidate.Slug)
		}
	}
	if len(selectable) == 0 {
		return nil, nil
	}
	if len(selectable) == 1 {
		return selectable, nil
	}
	every := make([]int, len(selectable))
	for index := range every {
		every[index] = index
	}
	indexes, err := cli.ChooseSeveral(ctx, app, "Components to publish:", selectable, prompt.MultiSelectOptions{Selected: every, Min: 1, AllowAll: true})
	if err != nil {
		return nil, err
	}
	chosen := make([]string, len(indexes))
	for position, index := range indexes {
		chosen[position] = selectable[index]
	}
	return chosen, nil
}

// publishComponent publishes the component's files as a new catalog version
// and waits for its build.
func publishComponent(ctx context.Context, app *cli.App, mode cli.OutputMode, target *componentapi.Target, slug string) (cli.Object[componentapi.Version], error) {
	none := cli.Object[componentapi.Version]{}
	workingCopy := target.WorkingCopy
	projectID := target.Project.Id
	files, err := workingCopy.ReadComponentFiles(slug)
	if err != nil {
		return none, err
	}
	state, err := workingCopy.ReadState()
	if err != nil {
		return none, err
	}
	body := map[string]any{"slug": slug, "files": files}
	// A first publish creates the catalog entry, named as #[component] names it.
	if _, known := state.Components[slug]; !known {
		if title, ok := workingcopy.TitleFromSource(files["src/lib.rs"]); ok {
			body["title"] = title
		}
	}
	app.Notef("\nPublishing %s...", slug)
	queued, err := cli.Fetch[componentapi.Version](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.ComponentsCreateVersionFromSourceWithBody(ctx, projectID, "application/json", componentapi.JSONBody(body))
	})
	if err != nil {
		return none, err
	}
	version := queued.Value.Version
	// The new version is the base now, whatever its build does.
	if _, err := workingCopy.UpdateState(func(current *workingcopy.State) {
		var previous *workingcopy.ComponentState
		if entry, ok := current.Components[slug]; ok {
			previous = &entry
		}
		current.Components[slug] = workingcopy.PublishedState(previous, version, files)
	}); err != nil {
		return none, err
	}

	app.Notef("Building %s v%d...", slug, version)
	deadline := app.Now().Add(buildWaitTimeout)
	var built cli.Object[componentapi.Version]
	for {
		built, err = cli.Fetch[componentapi.Version](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentsGetVersion(ctx, projectID, queued.Value.ComponentID, queued.Value.ID)
		})
		if err != nil {
			return none, err
		}
		if built.Value.Status == "ready" || built.Value.Status == "failed" {
			break
		}
		if !app.Now().Before(deadline) {
			return none, cli.Failf("%s v%d is still building after 10 minutes.", slug, version).
				WithHint("'voidhash dev' and 'voidhash registry list' show it once it is done.")
		}
		if err := app.Sleep(ctx, buildPollInterval); err != nil {
			return none, err
		}
	}
	if built.Value.Status == "failed" {
		log := "(empty)"
		if built.Value.BuildLog != nil && strings.TrimSpace(*built.Value.BuildLog) != "" {
			log = strings.TrimSpace(*built.Value.BuildLog)
		}
		app.Notef("%s\n\nBuild log:\n%s", componentapi.FormatVersion(app, slug, built.Value), cli.PrintableLines(log))
		return none, cli.Failf("The build of v%d failed.", version)
	}
	if _, err := workingCopy.UpdateState(func(current *workingcopy.State) {
		if entry, ok := current.Components[slug]; ok {
			entry.PublishedVersion = &version
			current.Components[slug] = entry
		}
	}); err != nil {
		return none, err
	}
	if mode == cli.Human {
		app.Println(fmt.Sprintf("%s Published %s v%d.", app.Style().Green("✓"), slug, version))
		app.Println(componentapi.FormatVersion(app, slug, built.Value))
	}
	return built, nil
}

// printPublished prints what scripts read: the published versions, or
// their ids.
func printPublished(app *cli.App, mode cli.OutputMode, published []cli.Object[componentapi.Version]) error {
	list := cli.List[componentapi.Version]{Items: []componentapi.Version{}}
	for _, version := range published {
		list.Items = append(list.Items, version.Value)
		list.Raw = append(list.Raw, version.Raw)
	}
	switch mode {
	case cli.JSON:
		return app.PrintJSON(list)
	case cli.Quiet:
		app.PrintIDs(list)
	}
	return nil
}
