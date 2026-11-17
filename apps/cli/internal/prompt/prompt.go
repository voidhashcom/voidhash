// Package prompt asks a person questions on a terminal: yes or no, a line of
// text, a secret that is not shown, one or several of a numbered list. Questions go to the prompter's output
// (standard error in the CLI, so they never mix with results) and answers
// are read a line at a time, which works in every terminal and through
// screen readers.
package prompt

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"

	"golang.org/x/term"
)

// ErrInterrupted is returned when the input ends or the run is cancelled
// before the person answers, as when they press Ctrl+C or Ctrl+D.
var ErrInterrupted = errors.New("interrupted")

// Prompter asks questions on Out and reads the answers from In.
type Prompter struct {
	in  *bufio.Reader
	out io.Writer
	// source is the input itself, which [Prompter.Secret] turns the echo
	// off on when it is a terminal.
	source io.Reader
}

// New creates a prompter.
func New(in io.Reader, out io.Writer) *Prompter {
	return &Prompter{in: bufio.NewReader(in), out: out, source: in}
}

// readLine reads one answer, without its line break and surrounding spaces.
func (p *Prompter) readLine(ctx context.Context) (string, error) {
	type answer struct {
		line string
		err  error
	}
	read := make(chan answer, 1)
	go func() {
		line, err := p.in.ReadString('\n')
		read <- answer{line, err}
	}()
	select {
	case <-ctx.Done():
		fmt.Fprintln(p.out)
		return "", ErrInterrupted
	case got := <-read:
		if got.err != nil && got.line == "" {
			fmt.Fprintln(p.out)
			return "", ErrInterrupted
		}
		return strings.TrimSpace(got.line), nil
	}
}

// Confirm asks a yes-or-no question. An empty answer is def.
func (p *Prompter) Confirm(ctx context.Context, message string, def bool) (bool, error) {
	choices := "[y/N]"
	if def {
		choices = "[Y/n]"
	}
	for {
		fmt.Fprintf(p.out, "%s %s ", message, choices)
		line, err := p.readLine(ctx)
		if err != nil {
			return false, err
		}
		switch strings.ToLower(line) {
		case "":
			return def, nil
		case "y", "yes":
			return true, nil
		case "n", "no":
			return false, nil
		}
		fmt.Fprintln(p.out, "Answer y or n.")
	}
}

// TextOptions shapes a [Prompter.Text] question.
type TextOptions struct {
	// Default is used when the person presses Enter without typing.
	Default string
	// Validate accepts an answer, returning the value to use, or rejects it
	// with what to type instead; the question is then asked again. Without
	// it, any answer that is not empty is accepted.
	Validate func(answer string) (string, error)
}

// Text asks for a line of text.
func (p *Prompter) Text(ctx context.Context, message string, options TextOptions) (string, error) {
	validate := options.Validate
	if validate == nil {
		validate = func(answer string) (string, error) {
			if answer == "" {
				return "", errors.New("Type a value.")
			}
			return answer, nil
		}
	}
	for {
		if options.Default != "" {
			fmt.Fprintf(p.out, "%s [%s]: ", message, options.Default)
		} else {
			fmt.Fprintf(p.out, "%s: ", message)
		}
		line, err := p.readLine(ctx)
		if err != nil {
			return "", err
		}
		if line == "" {
			line = options.Default
		}
		value, err := validate(line)
		if err == nil {
			return value, nil
		}
		fmt.Fprintln(p.out, err.Error())
	}
}

// Select asks which of labels to use and returns its index. The person
// types its number, or the start of its label when no other label starts
// the same way (ignoring case).
func (p *Prompter) Select(ctx context.Context, message string, labels []string) (int, error) {
	if len(labels) == 0 {
		return 0, errors.New("nothing to choose from")
	}
	fmt.Fprintln(p.out, message)
	width := len(strconv.Itoa(len(labels)))
	for index, label := range labels {
		fmt.Fprintf(p.out, "  %*d. %s\n", width, index+1, label)
	}
	for {
		fmt.Fprintf(p.out, "Choose 1-%d, or type the start of a name: ", len(labels))
		line, err := p.readLine(ctx)
		if err != nil {
			return 0, err
		}
		index, problem := match(labels, line)
		if problem == "" {
			return index, nil
		}
		fmt.Fprintln(p.out, problem)
	}
}

// match finds the label an answer names, or says why it names none.
func match(labels []string, answer string) (int, string) {
	if answer == "" {
		return 0, "Type a number or the start of a name."
	}
	if number, err := strconv.Atoi(answer); err == nil {
		if number >= 1 && number <= len(labels) {
			return number - 1, ""
		}
		return 0, fmt.Sprintf("There is no %d; choose 1-%d.", number, len(labels))
	}
	lower := strings.ToLower(answer)
	var matches []int
	for index, label := range labels {
		if strings.ToLower(label) == lower {
			return index, ""
		}
		if strings.HasPrefix(strings.ToLower(label), lower) {
			matches = append(matches, index)
		}
	}
	switch len(matches) {
	case 1:
		return matches[0], ""
	case 0:
		return 0, fmt.Sprintf("Nothing starts with %q.", answer)
	default:
		return 0, fmt.Sprintf("%q matches %d of them; type more of the name, or its number.", answer, len(matches))
	}
}

// Secret asks for a line that is not shown as it is typed, such as a token
// or a key, and returns it without surrounding spaces; an empty answer is
// returned as it is. Input that is not a terminal has no echo to turn off
// (a pipe, a test), so the line is read as [Prompter.Text] reads one.
func (p *Prompter) Secret(ctx context.Context, message string) (string, error) {
	file, isFile := p.source.(*os.File)
	if !isFile || !term.IsTerminal(int(file.Fd())) {
		fmt.Fprintf(p.out, "%s: ", message)
		return p.readLine(ctx)
	}
	descriptor := int(file.Fd())
	// Kept so that an interrupted read turns the echo back on: the read
	// itself only restores the terminal when it returns.
	state, err := term.GetState(descriptor)
	if err != nil {
		return "", fmt.Errorf("could not read from the terminal: %w", err)
	}
	fmt.Fprintf(p.out, "%s (hidden): ", message)
	type answer struct {
		line []byte
		err  error
	}
	read := make(chan answer, 1)
	go func() {
		line, err := term.ReadPassword(descriptor)
		read <- answer{line, err}
	}()
	select {
	case <-ctx.Done():
		_ = term.Restore(descriptor, state)
		fmt.Fprintln(p.out)
		return "", ErrInterrupted
	case got := <-read:
		fmt.Fprintln(p.out)
		if got.err != nil {
			if errors.Is(got.err, io.EOF) {
				return "", ErrInterrupted
			}
			return "", fmt.Errorf("could not read from the terminal: %w", got.err)
		}
		return strings.TrimSpace(string(got.line)), nil
	}
}

// MultiSelectOptions shapes a [Prompter.MultiSelect] question.
type MultiSelectOptions struct {
	// Selected are the indexes marked in the list, which Enter alone keeps.
	Selected []int
	// AllowAll accepts "all" for every label.
	AllowAll bool
	// AllowNone accepts "none", or an answer Named resolves to nothing, for
	// no label at all, whatever Min is.
	AllowNone bool
	// Min is how many must be chosen, by typing or by keeping the marked ones.
	Min int
	// Prompt replaces "Numbers or names, separated by commas", for a
	// command whose items go by something else, such as slugs.
	Prompt string
	// Named finds what an answer that is not a number names: a name, a
	// slug, a group such as "purchase.*". It is asked before "all" and
	// "none", so it can give those words its own meaning. Without it, an
	// answer names the label it equals, ignoring case.
	Named func(answer string) (indexes []int, ok bool)
}

// MultiSelect asks which of labels to use and returns their indexes, each
// once, in the order the person named them. The person types numbers or
// names separated by commas (or spaces, where no name has one); Enter alone
// keeps the ones marked as selected.
func (p *Prompter) MultiSelect(ctx context.Context, message string, labels []string, options MultiSelectOptions) ([]int, error) {
	if len(labels) == 0 {
		return nil, errors.New("nothing to choose from")
	}
	fmt.Fprintln(p.out, message)
	width := len(strconv.Itoa(len(labels)))
	for index, label := range labels {
		mark := " "
		if slices.Contains(options.Selected, index) {
			mark = "x"
		}
		fmt.Fprintf(p.out, "  %*d. [%s] %s\n", width, index+1, mark, label)
	}
	question := options.Prompt
	if question == "" {
		question = "Numbers or names, separated by commas"
	}
	var hints []string
	if len(options.Selected) > 0 {
		hints = append(hints, "Enter keeps the marked ones")
	}
	if options.AllowAll {
		hints = append(hints, "'all' takes every one")
	}
	if options.AllowNone {
		hints = append(hints, "'none' takes none")
	}
	if len(hints) > 0 {
		question += " (" + strings.Join(hints, ", ") + ")"
	}
	atLeast := "Choose at least one."
	if options.Min > 1 {
		atLeast = fmt.Sprintf("Choose at least %d.", options.Min)
	}

	named := options.Named
	if named == nil {
		named = func(answer string) ([]int, bool) {
			index := slices.IndexFunc(labels, func(label string) bool { return strings.EqualFold(label, answer) })
			return []int{index}, index >= 0
		}
	}
	// one is what a single answer names, or why it names nothing.
	one := func(answer string) ([]int, string) {
		if number, err := strconv.Atoi(answer); err == nil {
			if number < 1 || number > len(labels) {
				return nil, fmt.Sprintf("There is no %d; choose 1-%d.", number, len(labels))
			}
			return []int{number - 1}, ""
		}
		if indexes, ok := named(answer); ok {
			return indexes, ""
		}
		if options.AllowAll && strings.EqualFold(answer, "all") {
			every := make([]int, len(labels))
			for index := range every {
				every[index] = index
			}
			return every, ""
		}
		if options.AllowNone && strings.EqualFold(answer, "none") {
			return nil, ""
		}
		return nil, fmt.Sprintf("There is no %q; type its number.", answer)
	}
	for {
		fmt.Fprintf(p.out, "%s: ", question)
		line, err := p.readLine(ctx)
		if err != nil {
			return nil, err
		}
		if line == "" {
			if len(options.Selected) >= options.Min {
				return slices.Clone(options.Selected), nil
			}
			fmt.Fprintln(p.out, atLeast)
			continue
		}
		var chosen []int
		problem, answered := "", false
		for _, part := range strings.Split(line, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			indexes, why := one(part)
			if why != "" && len(strings.Fields(part)) > 1 {
				// Not one name with spaces in it: several answers.
				indexes, why = nil, ""
				for _, word := range strings.Fields(part) {
					found, whyNot := one(word)
					if whyNot != "" {
						why = whyNot
						break
					}
					indexes = append(indexes, found...)
				}
			}
			if why != "" {
				problem = why
				break
			}
			answered = true
			for _, index := range indexes {
				if !slices.Contains(chosen, index) {
					chosen = append(chosen, index)
				}
			}
		}
		switch {
		case problem != "":
			fmt.Fprintln(p.out, problem)
		case len(chosen) == 0 && answered && options.AllowNone:
			return nil, nil
		case len(chosen) < max(options.Min, 1):
			fmt.Fprintln(p.out, atLeast)
		default:
			return chosen, nil
		}
	}
}
