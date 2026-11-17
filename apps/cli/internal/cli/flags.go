package cli

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

// AddProjectFlag adds --project to a project-scoped command. Pass its value
// to [App.ResolveProject], which also decides without it.
func AddProjectFlag(cmd *cobra.Command) *string {
	return cmd.Flags().String("project", "", "Project to act on: its id, slug, organization/slug or name (default: this directory's project, then your default project)")
}

// OutputFlags are --json and -q/--quiet of a command that prints API objects.
type OutputFlags struct {
	JSON  bool
	Quiet bool
}

// AddOutputFlags adds --json and -q/--quiet to a command that prints API
// objects. Call Mode first thing in the command, before any request.
func AddOutputFlags(cmd *cobra.Command) *OutputFlags {
	flags := &OutputFlags{}
	cmd.Flags().BoolVar(&flags.JSON, "json", false, "Print the API objects as JSON, for scripts")
	cmd.Flags().BoolVarP(&flags.Quiet, "quiet", "q", false, "Print only ids, one per line")
	return flags
}

// Mode is the [OutputMode] the flags ask for; both at once is a usage error.
func (f *OutputFlags) Mode() (OutputMode, error) {
	switch {
	case f.JSON && f.Quiet:
		return Human, Usagef("--json and --quiet cannot be combined.").
			WithHint("Pass --json for the objects, or --quiet for their ids.")
	case f.JSON:
		return JSON, nil
	case f.Quiet:
		return Quiet, nil
	default:
		return Human, nil
	}
}

// AddJSONFlag adds --json alone, for a command whose result has no ids to
// print.
func AddJSONFlag(cmd *cobra.Command) *bool {
	return cmd.Flags().Bool("json", false, "Print the API objects as JSON, for scripts")
}

// AddYesFlag adds -y/--yes to a command that confirms before a change that
// cannot be undone. Pass its value to [App.ConfirmChange] or
// [App.ConfirmByTypingName].
func AddYesFlag(cmd *cobra.Command) *bool {
	return cmd.Flags().BoolP("yes", "y", false, "Make the change without asking for confirmation")
}

// AddDryRunFlag adds --dry-run to a command whose changes can be shown
// before they are made.
func AddDryRunFlag(cmd *cobra.Command) *bool {
	return cmd.Flags().Bool("dry-run", false, "Show what would change, and change nothing")
}

// choiceValue is a flag that takes one of a fixed set of values.
type choiceValue struct {
	choices []string
	value   *string
}

func (c *choiceValue) String() string { return *c.value }
func (c *choiceValue) Type() string   { return "<" + strings.Join(c.choices, "|") + ">" }
func (c *choiceValue) Set(value string) error {
	for _, choice := range c.choices {
		if choice == value {
			*c.value = value
			return nil
		}
	}
	return fmt.Errorf("must be one of: %s", strings.Join(c.choices, ", "))
}

// AddChoiceFlag adds a flag that takes one of choices. Any other value is a
// usage error that lists them; help shows them as <a|b> and shell
// completion offers them. The value is empty until the flag is passed,
// unless def names a default. short may be empty.
//
//	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "test"}, "", "Only the keys of production, or of test")
func AddChoiceFlag(cmd *cobra.Command, name, short string, choices []string, def, usage string) *string {
	value := def
	cmd.Flags().VarP(&choiceValue{choices: choices, value: &value}, name, short, usage)
	_ = cmd.RegisterFlagCompletionFunc(name, func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
		return choices, cobra.ShellCompDirectiveNoFileComp
	})
	return &value
}

// AddStringsFlag adds a flag that can be passed several times; each use
// adds one value, taken as it is (commas do not split it).
func AddStringsFlag(cmd *cobra.Command, name, short, usage string) *[]string {
	return cmd.Flags().StringArrayP(name, short, nil, usage)
}

// AddHiddenAlias makes --alias another spelling of the flag --name, hidden
// from help: for a flag that was renamed, so scripts written for the old
// name keep working.
func AddHiddenAlias(cmd *cobra.Command, alias, name string) {
	flag := cmd.Flags().Lookup(name)
	if flag == nil {
		panic(fmt.Sprintf("cli.AddHiddenAlias: %s has no flag --%s", cmd.Name(), name))
	}
	cmd.Flags().Var(flag.Value, alias, flag.Usage)
	hidden := cmd.Flags().Lookup(alias)
	hidden.Hidden = true
	hidden.NoOptDefVal = flag.NoOptDefVal
}

// Changed reports whether the flag was passed on the command line, for a
// flag whose zero value is also a meaningful value.
func Changed(cmd *cobra.Command, name string) bool {
	return cmd.Flags().Changed(name)
}

// Arg describes one positional argument of a command.
type Arg struct {
	// Name is how usage shows it: "project".
	Name string
	// Help describes it in the command's help.
	Help string
	// Optional arguments may be left out; the command then asks for the
	// value on a terminal or decides without it. An optional argument cannot
	// be followed by a required one.
	Optional bool
	// Variadic takes every remaining argument. Only the last may be variadic.
	Variadic bool
}

const argsAnnotation = "voidhash/args"

// SetArgs declares the positional arguments of a command: it adds them to
// the usage line and the help, and rejects a command line with too few or
// too many as a usage error. A command without arguments needs no call:
// extra arguments are rejected for every command.
//
//	cli.SetArgs(cmd, cli.Arg{Name: "project", Help: "The project's slug, organization/slug, name or id", Optional: true})
func SetArgs(cmd *cobra.Command, args ...Arg) {
	encoded, err := json.Marshal(args)
	if err != nil {
		panic(err)
	}
	if cmd.Annotations == nil {
		cmd.Annotations = map[string]string{}
	}
	cmd.Annotations[argsAnnotation] = string(encoded)
	for _, arg := range args {
		name := arg.Name
		if arg.Variadic {
			name += "..."
		}
		if arg.Optional {
			cmd.Use += " [" + name + "]"
		} else {
			cmd.Use += " <" + name + ">"
		}
	}
	cmd.Args = validateArgs(args)
}

// ArgsOf returns the arguments [SetArgs] declared for a command.
func ArgsOf(cmd *cobra.Command) []Arg {
	var args []Arg
	_ = json.Unmarshal([]byte(cmd.Annotations[argsAnnotation]), &args)
	return args
}

func validateArgs(declared []Arg) cobra.PositionalArgs {
	return func(cmd *cobra.Command, args []string) error {
		required, variadic := 0, false
		for _, arg := range declared {
			if !arg.Optional {
				required++
			}
			variadic = variadic || arg.Variadic
		}
		help := fmt.Sprintf("Run it as: %s", strings.TrimSuffix(cmd.UseLine(), " [flags]"))
		if len(args) < required {
			return Usagef("Missing %s.", "<"+declared[len(args)].Name+">").WithHint(help)
		}
		if len(args) > len(declared) && !variadic {
			if cmd.HasAvailableSubCommands() {
				return unknownCommand(cmd, args[0])
			}
			return Usagef("Unexpected argument %q.", args[len(declared)]).WithHint(help)
		}
		return nil
	}
}

func unknownCommand(cmd *cobra.Command, name string) *UserError {
	hint := fmt.Sprintf("Run '%s --help' to see its commands.", cmd.CommandPath())
	if suggestions := cmd.SuggestionsFor(name); len(suggestions) > 0 {
		hint = fmt.Sprintf("Did you mean '%s %s'? %s", cmd.CommandPath(), suggestions[0], hint)
	}
	return Usagef("Unknown command %q for '%s'.", name, cmd.CommandPath()).WithHint(hint)
}

// ArgAt is the positional argument at index, or empty when it was not
// passed.
func ArgAt(args []string, index int) string {
	if index < len(args) {
		return args[index]
	}
	return ""
}

const (
	stubAnnotation  = "voidhash/stub"
	groupAnnotation = "voidhash/group"
)

// Stub is a command that is not ported yet: it has the right name, aliases
// and description, accepts any arguments and flags, and fails saying so.
// Replace the call with the real command.
func Stub(use string, aliases []string, short string) *cobra.Command {
	return &cobra.Command{
		Use:                use,
		Aliases:            aliases,
		Short:              short,
		Annotations:        map[string]string{stubAnnotation: "true"},
		DisableFlagParsing: true,
		Args:               cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			for _, arg := range args {
				if arg == "--help" || arg == "-h" {
					return cmd.Help()
				}
			}
			return Failf("'%s' is not available in this version of the CLI yet.", cmd.CommandPath())
		},
	}
}

// IsStub reports whether a command was made by [Stub].
func IsStub(cmd *cobra.Command) bool {
	return cmd.Annotations[stubAnnotation] == "true"
}
