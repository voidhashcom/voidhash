package cli

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func init() {
	// Help lists commands in the order the root adds them, by task, not by
	// name.
	cobra.EnableCommandSorting = false
}

// Prepare turns a tree of commands into the CLI: it adds the global flags,
// installs the help layout, and makes every command reject what it does not
// take with a short usage error. The root package calls it once, after
// adding every command.
func (a *App) Prepare(root *cobra.Command) {
	root.Version = a.Version
	root.SilenceErrors = true
	root.SilenceUsage = true
	root.CompletionOptions.HiddenDefaultCmd = false
	root.SetIn(a.Stdin)
	root.SetOut(a.Stdout)
	root.SetErr(a.Stderr)

	persistent := root.PersistentFlags()
	persistent.StringVar(&a.Profile, "profile", "", "Use a named config `profile`: its settings override the base config (default: VOIDHASH_PROFILE)")
	persistent.BoolVarP(&a.Debug, "debug", "d", false, "Print each request and full error detail to standard error")
	persistent.BoolVar(&a.NoColor, "no-color", false, "Print without colors (also when NO_COLOR is set)")
	// Accepted and ignored, for scripts written for earlier versions.
	persistent.String("log-level", "", "")
	_ = persistent.MarkHidden("log-level")

	// The earlier spelling of `voidhash completion <shell>`.
	completions := root.Flags().String("completions", "", "")
	_ = root.Flags().MarkHidden("completions")
	root.Annotations = map[string]string{groupAnnotation: "true"}
	root.RunE = func(cmd *cobra.Command, _ []string) error {
		if *completions != "" {
			return a.printCompletions(cmd, *completions)
		}
		return cmd.Help()
	}

	root.InitDefaultHelpCmd()
	root.InitDefaultCompletionCmd()
	root.InitDefaultVersionFlag()
	root.InitDefaultHelpFlag()
	root.Flags().Lookup("help").Usage = "Show help for a command"
	root.Flags().Lookup("version").Usage = "Show the CLI's version"

	root.SetHelpFunc(func(cmd *cobra.Command, _ []string) {
		fmt.Fprint(a.Stdout, a.Help(cmd))
	})
	root.SetFlagErrorFunc(func(cmd *cobra.Command, err error) error {
		return usageError(cmd, err)
	})
	a.prepareCommand(root)
}

func (a *App) prepareCommand(cmd *cobra.Command) {
	for _, sub := range cmd.Commands() {
		a.prepareCommand(sub)
	}
	if cmd.Flags().Lookup("help") == nil {
		cmd.InitDefaultHelpFlag()
		if help := cmd.Flags().Lookup("help"); help != nil {
			help.Usage = "Show help for this command"
		}
	}
	cmd.SuggestionsMinimumDistance = 2
	// A stub takes anything, and cobra's help command takes a command path.
	if IsStub(cmd) || (cmd.Name() == "help" && cmd.Parent() == cmd.Root()) {
		return
	}
	if cmd.Run == nil && cmd.RunE == nil {
		// A group: without a command it shows its help.
		if cmd.Annotations == nil {
			cmd.Annotations = map[string]string{}
		}
		cmd.Annotations[groupAnnotation] = "true"
		cmd.RunE = func(cmd *cobra.Command, _ []string) error { return cmd.Help() }
	}
	if cmd.Args == nil {
		cmd.Args = validateArgs(nil)
	}
	if run := cmd.RunE; run != nil {
		cmd.RunE = func(cmd *cobra.Command, args []string) error {
			a.started = true
			return run(cmd, args)
		}
	}
}

// usageError is a command line the parser rejected: the problem in a line,
// and where the command's help is.
func usageError(cmd *cobra.Command, err error) *UserError {
	return &UserError{
		Message:  capitalize(strings.TrimSuffix(err.Error(), ".")) + ".",
		Hint:     fmt.Sprintf("Run '%s --help' for usage.", cmd.CommandPath()),
		ExitCode: ExitUsage,
	}
}

func (a *App) printCompletions(root *cobra.Command, shell string) error {
	switch shell {
	case "bash", "sh":
		return root.GenBashCompletionV2(a.Stdout, true)
	case "zsh":
		return root.GenZshCompletion(a.Stdout)
	case "fish":
		return root.GenFishCompletion(a.Stdout, true)
	case "powershell", "pwsh":
		return root.GenPowerShellCompletionWithDesc(a.Stdout)
	default:
		return Usagef("There are no completions for %q.", shell).
			WithHint("Shells: bash, zsh, fish, powershell. 'voidhash completion --help' says how to install them.")
	}
}

// Execute runs the prepared root command with args (without the program
// name) and returns the exit code: 0 when it worked, else the code of the
// failure, which is printed to standard error as "error: …" and "hint: …".
// A run stopped by ctx ending, as with Ctrl+C, exits with 130.
func (a *App) Execute(ctx context.Context, root *cobra.Command, args []string) int {
	root.SetArgs(args)
	cmd, err := root.ExecuteContextC(ctx)
	if err == nil {
		return ExitOK
	}
	if ctx.Err() != nil {
		return ExitInterrupted
	}
	var userErr *UserError
	if !a.started && !errors.As(err, &userErr) {
		// Cobra rejected the command line before any command ran.
		err = usageError(cmd, err)
	}
	return a.report(err)
}
