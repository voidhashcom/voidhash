package cli

import (
	"strings"
	"unicode/utf8"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// maxHelpWidth keeps help readable on a wide terminal.
const maxHelpWidth = 100

func (a *App) helpWidth() int {
	return min(max(a.Width, 40), maxHelpWidth)
}

// wrap breaks text into lines of at most width columns. Paragraphs are
// separated by empty lines; a line that starts with a space is laid out by
// hand already (a table, a command) and is kept as it is.
func wrap(text string, width int) []string {
	var lines []string
	for _, line := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
		if line == "" || line[0] == ' ' || line[0] == '\t' {
			lines = append(lines, line)
			continue
		}
		current := ""
		for _, word := range strings.Fields(line) {
			switch {
			case current == "":
				current = word
			case utf8.RuneCountInString(current)+1+utf8.RuneCountInString(word) > width:
				lines = append(lines, current)
				current = word
			default:
				current += " " + word
			}
		}
		lines = append(lines, current)
	}
	return lines
}

// helpRow is one line of a help table: what is typed, and what it does.
type helpRow struct {
	label string
	text  string
}

// writeRows lays rows out in two columns, wrapping the second.
func writeRows(out *strings.Builder, rows []helpRow, width int) {
	const gap, maxLabel = 2, 34
	labelWidth := 0
	for _, row := range rows {
		if length := utf8.RuneCountInString(row.label); length <= maxLabel {
			labelWidth = max(labelWidth, length)
		}
	}
	indent := 2 + labelWidth + gap
	for _, row := range rows {
		text := wrap(row.text, max(width-indent, 20))
		length := utf8.RuneCountInString(row.label)
		out.WriteString("  " + row.label)
		if length > labelWidth {
			// A label too long for its column gets a line of its own.
			out.WriteString("\n")
			if len(text) > 0 && text[0] != "" {
				out.WriteString(strings.Repeat(" ", indent))
			}
		} else if len(text) > 0 && text[0] != "" {
			out.WriteString(strings.Repeat(" ", labelWidth-length+gap))
		}
		for index, line := range text {
			if index > 0 {
				out.WriteString(strings.Repeat(" ", indent))
			}
			out.WriteString(line + "\n")
		}
		if len(text) == 0 {
			out.WriteString("\n")
		}
	}
}

// flagRows describes the visible flags of a set.
func flagRows(flags *pflag.FlagSet) []helpRow {
	var rows []helpRow
	flags.VisitAll(func(flag *pflag.Flag) {
		if flag.Hidden {
			return
		}
		label := "    --" + flag.Name
		if flag.Shorthand != "" {
			label = "-" + flag.Shorthand + ", --" + flag.Name
		}
		placeholder, usage := pflag.UnquoteUsage(flag)
		switch {
		case flag.Value.Type() == "bool":
		case strings.HasPrefix(flag.Value.Type(), "<"):
			label += " " + flag.Value.Type()
		case strings.Contains(flag.Usage, "`"):
			label += " <" + placeholder + ">"
		default:
			label += " <" + flag.Name + ">"
		}
		if flag.Value.Type() == "stringArray" {
			usage += " (can be repeated)"
		}
		rows = append(rows, helpRow{label: label, text: capitalize(usage)})
	})
	return rows
}

func commandRow(cmd *cobra.Command) helpRow {
	label := cmd.Name()
	if len(cmd.Aliases) > 0 {
		label += ", " + strings.Join(cmd.Aliases, ", ")
	}
	return helpRow{label: label, text: cmd.Short}
}

// usageLines are the ways to run a command.
func usageLines(cmd *cobra.Command) []string {
	path := cmd.CommandPath()
	own := path + strings.TrimPrefix(cmd.Use, cmd.Name())
	if cmd.HasAvailableLocalFlags() || cmd.HasAvailableInheritedFlags() {
		own += " [flags]"
	}
	if !cmd.HasAvailableSubCommands() {
		return []string{own}
	}
	sub := path + " <command> [flags]"
	if cmd.Annotations[groupAnnotation] == "true" {
		return []string{sub}
	}
	return []string{own, sub}
}

// Help renders the help of a command: what it does, how to run it, its
// arguments, commands and flags, and examples.
func (a *App) Help(cmd *cobra.Command) string {
	width := a.helpWidth()
	title := a.Style().Bold
	var out strings.Builder
	section := func(name string) {
		out.WriteString("\n" + title(name+":") + "\n")
	}

	description := cmd.Long
	if description == "" {
		description = cmd.Short
	}
	for _, line := range wrap(description, width) {
		out.WriteString(line + "\n")
	}

	section("Usage")
	for _, line := range usageLines(cmd) {
		out.WriteString("  " + line + "\n")
	}

	if len(cmd.Aliases) > 0 {
		section("Aliases")
		out.WriteString("  " + strings.Join(append([]string{cmd.Name()}, cmd.Aliases...), ", ") + "\n")
	}

	if args := ArgsOf(cmd); len(args) > 0 {
		rows := make([]helpRow, len(args))
		for index, arg := range args {
			rows[index] = helpRow{label: arg.Name, text: arg.Help}
		}
		section("Arguments")
		writeRows(&out, rows, width)
	}

	if cmd.HasAvailableSubCommands() {
		grouped := map[string][]helpRow{}
		for _, sub := range cmd.Commands() {
			if sub.IsAvailableCommand() || sub.Name() == "help" {
				grouped[sub.GroupID] = append(grouped[sub.GroupID], commandRow(sub))
			}
		}
		// One table across the groups, so every description starts in the
		// same column.
		var rows []helpRow
		for _, group := range cmd.Groups() {
			if len(grouped[group.ID]) == 0 {
				continue
			}
			rows = append(rows, helpRow{label: "\x00" + group.Title})
			rows = append(rows, grouped[group.ID]...)
		}
		if len(grouped[""]) > 0 {
			name := "Commands"
			if len(rows) > 0 {
				name = "Other commands"
			}
			rows = append(rows, helpRow{label: "\x00" + name})
			rows = append(rows, grouped[""]...)
		}
		var table strings.Builder
		writeRows(&table, rows, width)
		for _, line := range strings.SplitAfter(table.String(), "\n") {
			if heading, ok := strings.CutPrefix(line, "  \x00"); ok {
				out.WriteString("\n" + title(strings.TrimRight(heading, "\n")+":") + "\n")
			} else {
				out.WriteString(line)
			}
		}
	}

	if rows := flagRows(cmd.LocalFlags()); len(rows) > 0 {
		section("Flags")
		writeRows(&out, rows, width)
	}
	if rows := flagRows(cmd.InheritedFlags()); len(rows) > 0 {
		section("Global flags")
		writeRows(&out, rows, width)
	}

	if cmd.Example != "" {
		section("Examples")
		for _, line := range strings.Split(strings.Trim(cmd.Example, "\n"), "\n") {
			out.WriteString("  " + strings.TrimSpace(line) + "\n")
		}
	}

	if cmd.HasAvailableSubCommands() {
		out.WriteString("\n")
		for _, line := range wrap("Run '"+cmd.CommandPath()+" <command> --help' for more about a command.", width) {
			out.WriteString(line + "\n")
		}
	}
	return out.String()
}
