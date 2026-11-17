// Package testcmd holds the `voidhash test` command.
package testcmd

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/crate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/definition"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/workingcopy"
)

// defaultChecker is the conformance checker; VOIDHASH_CONFORMANCE overrides
// the executable.
const defaultChecker = "voidhash-guest-conformance"

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// New creates `voidhash test [component] [--panel file]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "test",
		Short: "Check a component module against the conformance suite and its editor panel against the panel checks.",
		Long: `Check a component the way publishing does on a server with a component build service: the module against the component conformance suite, and its editor panel module, when it has one, against the panel checks.

The argument is one of:
  a component's slug   a component of the working copy, .voidhash/components/<slug>
  a crate directory    built for release first, into target/voidhash/ in the crate
  a .wasm module       its panel is --panel, or a panel.wasm next to it

Building needs Rust with the wasm32-unknown-unknown target. The conformance suite is run by the voidhash-guest-conformance executable, found on your PATH or named by VOIDHASH_CONFORMANCE.`,
		Example: `voidhash test
voidhash test sale-badge
voidhash test ./crates/wheel-picker
voidhash test build/module.wasm --panel build/panel.wasm`,
	}
	cli.SetArgs(cmd, cli.Arg{
		Name:     "component",
		Help:     "A component of .voidhash/components, a component crate or a .wasm module (the current directory by default)",
		Optional: true,
	})
	panelFlag := cmd.Flags().String("panel", "", "The editor panel module of a .wasm module (default: panel.wasm next to it)")

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		run := crate.ExecRunner(app.Getenv)
		target := "."
		if len(args) > 0 {
			target = args[0]
		}

		modulePath, panelPath := "", ""
		if filepath.Ext(target) == ".wasm" {
			modulePath = componentapi.Path(app, target)
			if *panelFlag != "" {
				panelPath = componentapi.Path(app, *panelFlag)
			} else if sibling := filepath.Join(filepath.Dir(modulePath), "panel.wasm"); exists(sibling) {
				panelPath = sibling
			}
		} else {
			directory := componentapi.Path(app, target)
			workingCopyCrate := filepath.Join(app.Dir, workingcopy.Directory, "components", target)
			switch {
			case exists(filepath.Join(directory, "Cargo.toml")):
			case workingcopy.IsComponentSlug(target) && exists(filepath.Join(workingCopyCrate, "Cargo.toml")):
				directory = workingCopyCrate
			default:
				return cli.Failf("%s is neither a component of %s, a crate with Cargo.toml, nor a .wasm module.",
					target, filepath.Join(workingcopy.Directory, "components")).
					WithHint("Name a component, a crate directory or a module; 'voidhash new <name>' creates a component.")
			}
			shown := componentapi.Relative(app, directory)
			if shown == "." {
				shown = filepath.Base(directory)
			}
			app.Notef("Building %s...", shown)
			built, err := crate.BuildCrate(ctx, run, directory, crate.BuildOptions{
				Diagnostics: app.Stderr,
				Color:       app.StderrTTY && !app.NoColor && app.Getenv("NO_COLOR") == "",
			})
			var buildError *crate.BuildError
			switch {
			case errors.As(err, &buildError):
				message := buildError.Message
				if buildError.Log != "" {
					message = buildError.Log + "\n" + message
				}
				return cli.Failf("%s", message)
			case err != nil:
				return err
			}
			if modulePath, panelPath, err = crate.WriteBuild(filepath.Join(directory, crate.BuildOutputPath), built); err != nil {
				return &cli.UserError{Message: "Could not write the build: " + err.Error(), Cause: err}
			}
		}
		shownModule := componentapi.Relative(app, modulePath)

		// The panel checks run in process; they come first so they report
		// even without the conformance checker.
		module, err := os.ReadFile(modulePath)
		if err != nil {
			return &cli.UserError{Message: "Could not read " + shownModule + ": " + err.Error(), Cause: err}
		}
		described, err := definition.ReadModule(module)
		if err != nil {
			return cli.Failf("%s: %s", shownModule, err)
		}
		style := app.Style()
		switch {
		case panelPath != "":
			shownPanel := componentapi.Relative(app, panelPath)
			panel, err := os.ReadFile(panelPath)
			if err != nil {
				return &cli.UserError{Message: "Could not read " + shownPanel + ": " + err.Error(), Cause: err}
			}
			panels, problems := definition.ValidatePanelModule(panel, described)
			if len(problems) > 0 {
				return cli.Failf("%s", strings.Join(append([]string{shownPanel + " did not pass the panel checks:"}, problems...), "\n  - "))
			}
			ids := make([]string, len(panels))
			for index, panel := range panels {
				ids[index] = panel.ID
			}
			app.Println(style.Green("✓") + " " + cli.Printable(shownPanel+" passed the panel checks ("+strings.Join(ids, ", ")+")."))
		case described.Panel:
			return cli.Failf("%s declares an editor panel, but no panel module was found.", described.ID).
				WithHint("Test its crate instead, which builds both modules, or pass --panel.")
		}

		checker := app.Getenv("VOIDHASH_CONFORMANCE")
		if checker == "" {
			checker = defaultChecker
		}
		// The checker names the module as it is given: the way a person would type it here.
		exitCode, err := run(ctx, crate.Command{Name: checker, Args: []string{shownModule}, Dir: app.Dir, Stdout: app.Stdout, Stderr: app.Stderr})
		switch {
		case ctx.Err() != nil:
			return ctx.Err()
		case errors.Is(err, crate.ErrNotInstalled):
			return cli.Failf("The component conformance checker (%s) is not installed, so %s was not tested.", checker, shownModule).
				WithHint("Install it and make sure it is on your PATH, or set VOIDHASH_CONFORMANCE to its location. A server with a component build service runs the same checks when you publish.")
		case err != nil:
			return &cli.UserError{Message: "Could not run " + checker + ": " + err.Error(), Cause: err}
		case exitCode != 0:
			return cli.Failf("%s did not pass the conformance suite.", shownModule)
		}
		app.Println(style.Green("✓") + " " + cli.Printable(shownModule+" passed the conformance suite."))
		return nil
	}
	return cmd
}
