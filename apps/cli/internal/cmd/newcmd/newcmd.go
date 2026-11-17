// Package newcmd holds the `voidhash new` command.
package newcmd

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/componentapi"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/crate"
	"github.com/voidhashcom/voidhash/apps/cli/internal/components/workingcopy"
)

// A title the scaffold can use needs no escaping in Rust.
var titlePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9 ]*$`)

// titleFromName turns wheel-picker into "Wheel picker".
func titleFromName(name string) string {
	var words []string
	for _, word := range strings.Split(name, "-") {
		if word != "" {
			words = append(words, word)
		}
	}
	title := strings.Join(words, " ")
	if title == "" {
		return ""
	}
	return strings.ToUpper(title[:1]) + title[1:]
}

// New creates `voidhash new <name> [--title]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "new",
		Short: "Add a component with its editor panel to the working copy in .voidhash/components/.",
		Long: `Add a component to the working copy: .voidhash/components/<name>/, a Rust crate with a voidhash-ui component and its editor panel, under the id project/<name>.

It stays on this computer until 'voidhash publish' creates its first catalog version. Run it in your project's root, where voidhash.json is.`,
		Example: `voidhash new sale-badge
voidhash new wheel-picker --title "Wheel picker"`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "name", Help: "The component's slug: lowercase letters, digits and dashes"})
	givenTitle := cmd.Flags().String("title", "", "Its title in the paywall editor: letters, digits and spaces (default: from the name)")

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		name := args[0]
		if !workingcopy.IsComponentSlug(name) {
			return cli.Usagef("%q is not a component slug.", name).
				WithHint("Use lowercase letters, digits and dashes, such as sale-badge.")
		}
		title := *givenTitle
		if title == "" {
			title = titleFromName(name)
		}
		if !titlePattern.MatchString(title) {
			return cli.Usagef("%q is not a title the scaffold can use.", title).
				WithHint("Use letters, digits and spaces: --title \"Sale badge\".")
		}
		target, err := componentapi.Open(ctx, app)
		if err != nil {
			return err
		}
		directory := target.WorkingCopy.ComponentDirectory(name)
		shown := componentapi.Relative(app, directory)
		if _, err := os.Stat(directory); err == nil {
			return cli.Failf("%s already exists.", shown).WithHint("Pick another name, or edit the component that is there.")
		}
		onServer, _, err := cli.FetchPage[componentapi.Component](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.ComponentsList(ctx, target.Project.Id, &api.ComponentsListParams{Slug: &name})
		})
		if err != nil {
			return componentapi.Error(err)
		}
		if len(onServer.Items) > 0 {
			return cli.Failf("The project already has a component %s.", name).
				WithHint(fmt.Sprintf("Run 'voidhash dev' to pull it into %s%c, or pick another name.",
					componentapi.Relative(app, target.WorkingCopy.ComponentsDirectory), filepath.Separator))
		}
		if err := target.WorkingCopy.WriteComponentFiles(name, crate.Scaffold(name, title)); err != nil {
			return &cli.UserError{Message: "Could not write the component: " + err.Error(), Cause: err}
		}
		app.Println(fmt.Sprintf("✓ Created %s in %s%c.", crate.ComponentID(name), shown, filepath.Separator))
		app.Println("")
		app.Println(cli.FormatFields([]cli.Field{
			{Label: "voidhash dev", Value: "Build it on every change and see it in your paywall editor, under Local in the\ninsert palette. Edit " + filepath.Join(shown, "src") + string(filepath.Separator) + "."},
			{Label: "voidhash publish", Value: "Publish it as the component's first catalog version."},
		}))
		return nil
	}
	return cmd
}
