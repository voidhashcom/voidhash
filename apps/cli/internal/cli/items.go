package cli

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

// What commands ask of people: the things they name (by id, slug or name,
// resolved here, with the candidates listed when that is ambiguous), the
// values a command needs (prompted for on a terminal, a usage error off
// one), and confirmation before a change that cannot be undone.
//
// Nothing here prompts unless both standard input and output are a terminal.

// ItemKind describes a kind of thing people name on the command line: what
// it answers to, and how messages and prompts call it.
//
//	var productKind = cli.ItemKind[api.ProductJsonEncoding]{
//		Noun:          "product",
//		ID:            func(p api.ProductJsonEncoding) string { return p.Id },
//		Label:         func(p api.ProductJsonEncoding) string { return p.Name + " (" + p.Slug + ")" },
//		ListCommand:   "voidhash product list",
//		CreateCommand: "voidhash product create",
//		Keys:          func(p api.ProductJsonEncoding) []string { return []string{p.Slug} },
//		Names:         func(p api.ProductJsonEncoding) []string { return []string{p.Name} },
//	}
type ItemKind[T any] struct {
	// Noun is singular and lowercase: "product".
	Noun string
	// Plural, when it is not the noun with an "s".
	Plural string
	// ID is the item's id, which it always answers to.
	ID func(item T) string
	// Label is how an item reads in a list or a prompt: "Pro Monthly (pro-monthly)".
	Label func(item T) string
	// ListCommand lists every item: "voidhash product list".
	ListCommand string
	// CreateCommand creates one, offered when there is none yet. Optional.
	CreateCommand string
	// Keys are what an item answers to exactly besides its id: its slug, key
	// or email. Optional.
	Keys func(item T) []string
	// Names are what it also answers to, ignoring case: its name. Optional.
	Names func(item T) []string
}

func (k ItemKind[T]) plural() string {
	if k.Plural != "" {
		return k.Plural
	}
	return k.Noun + "s"
}

func (k ItemKind[T]) keys(item T) []string {
	if k.Keys == nil {
		return nil
	}
	return k.Keys(item)
}

func (k ItemKind[T]) keysAndNames(item T) []string {
	all := k.keys(item)
	if k.Names != nil {
		all = append(append([]string{}, all...), k.Names(item)...)
	}
	return all
}

// ItemsNamedBy returns the items input names: those whose id or one of
// whose keys is exactly input; when there are none, those with a key or
// name that is input ignoring case. Several items can share a name, so this
// may return more than one.
func ItemsNamedBy[T any](kind ItemKind[T], items []T, input string) []T {
	wanted := strings.TrimSpace(input)
	var exact []T
	for _, item := range items {
		if kind.ID(item) == wanted || contains(kind.keys(item), wanted, false) {
			exact = append(exact, item)
		}
	}
	if len(exact) > 0 {
		return exact
	}
	var named []T
	for _, item := range items {
		if contains(kind.keysAndNames(item), wanted, true) {
			named = append(named, item)
		}
	}
	return named
}

func contains(values []string, wanted string, foldCase bool) bool {
	for _, value := range values {
		if value == wanted || (foldCase && strings.EqualFold(value, wanted)) {
			return true
		}
	}
	return false
}

// FindItem returns the one item of items that input names (see
// [ItemsNamedBy]). It fails with what to type instead: the closest items
// when none matches (exit 4), every candidate with its id when several do
// (exit 2).
func FindItem[T any](kind ItemKind[T], items []T, input string) (T, error) {
	var none T
	named := ItemsNamedBy(kind, items, input)
	if len(named) == 1 {
		return named[0], nil
	}
	if len(named) > 1 {
		lines := []string{fmt.Sprintf("%q matches %d %s:", input, len(named), kind.plural())}
		for _, item := range named {
			lines = append(lines, "  "+kind.Label(item)+"  "+kind.ID(item))
		}
		return none, &UserError{
			Message:  strings.Join(lines, "\n"),
			Hint:     "Name it by its slug or id.",
			ExitCode: ExitUsage,
		}
	}

	// Items with a key or name that contains input, as "did you mean".
	lower := strings.ToLower(strings.TrimSpace(input))
	var suggestions []string
	for _, item := range items {
		if len(suggestions) == 5 {
			break
		}
		for _, value := range kind.keysAndNames(item) {
			if strings.Contains(strings.ToLower(value), lower) {
				suggestions = append(suggestions, kind.Label(item))
				break
			}
		}
	}
	message := fmt.Sprintf("No %s matches %q.", kind.Noun, input)
	if len(suggestions) > 0 {
		message += "\nDid you mean " + strings.Join(suggestions, ", ") + "?"
	}
	hint := fmt.Sprintf("'%s' lists them.", kind.ListCommand)
	if len(items) == 0 && kind.CreateCommand != "" {
		hint = fmt.Sprintf("There are no %s yet. Create one with '%s'.", kind.plural(), kind.CreateCommand)
	}
	return none, &UserError{Message: message, Hint: hint, ExitCode: ExitNotFound}
}

// MissingInput is the failure of a command that needs what and cannot ask
// for it: usage shows how to pass it.
func MissingInput(what, usage string) *UserError {
	return &UserError{
		Message:  "Missing " + what + ".",
		Hint:     "There is no terminal to ask in; run it as: " + usage,
		ExitCode: ExitUsage,
	}
}

// ChooseItem asks which of items to use, on a terminal. It fails when there
// are none. An empty message asks "Which <noun>?". Call it only when
// [App.IsInteractive]; [RequireItem] does that for you.
func ChooseItem[T any](ctx context.Context, a *App, kind ItemKind[T], items []T, message string) (T, error) {
	var none T
	if len(items) == 0 {
		hint := ""
		if kind.CreateCommand != "" {
			hint = fmt.Sprintf("Create one with '%s'.", kind.CreateCommand)
		}
		return none, &UserError{
			Message:  fmt.Sprintf("There are no %s yet.", kind.plural()),
			Hint:     hint,
			ExitCode: ExitNotFound,
		}
	}
	if message == "" {
		message = "Which " + kind.Noun + "?"
	}
	labels := make([]string, len(items))
	for index, item := range items {
		labels[index] = Printable(kind.Label(item))
	}
	index, err := a.Prompter().Select(ctx, Printable(message), labels)
	if err != nil {
		return none, err
	}
	return items[index], nil
}

// RequireItem returns the item a command's argument names. When the
// argument is missing (input is empty), it asks on a terminal and fails
// with usage (how to pass it) off one.
//
//	product, err := cli.RequireItem(ctx, app, productKind, products.Items, cli.ArgAt(args, 0), "voidhash product view <product>")
func RequireItem[T any](ctx context.Context, a *App, kind ItemKind[T], items []T, input, usage string) (T, error) {
	if input != "" {
		return FindItem(kind, items, input)
	}
	if !a.IsInteractive() {
		var none T
		return none, MissingInput("the "+kind.Noun, usage)
	}
	return ChooseItem(ctx, a, kind, items, "")
}

// TextPrompt describes a text value a command needs.
type TextPrompt struct {
	// What names the value in the failure off a terminal: "the name", "--url".
	What string
	// Message is the question asked on a terminal: "Project name".
	Message string
	// Usage shows how to pass the value: "voidhash project create <name>".
	Usage string
	// Initial is offered as the answer to accept with Enter. Optional.
	Initial string
	// Validate accepts an answer, returning the value to use, or rejects it
	// with what to type instead. Optional: without it any text is accepted.
	Validate func(answer string) (string, error)
}

// RequireText returns a text value a command needs: value when it was
// passed (not empty), else what the person types on a terminal, else a
// usage failure.
func (a *App) RequireText(ctx context.Context, value string, ask TextPrompt) (string, error) {
	if value != "" {
		return value, nil
	}
	if !a.IsInteractive() {
		return "", MissingInput(ask.What, ask.Usage)
	}
	return a.Prompter().Text(ctx, Printable(ask.Message), prompt.TextOptions{
		Default: Printable(ask.Initial),
		Validate: func(answer string) (string, error) {
			answer = strings.TrimSpace(answer)
			if answer == "" {
				return "", errors.New("Type a value.")
			}
			if ask.Validate != nil {
				return ask.Validate(answer)
			}
			return answer, nil
		},
	})
}

// Choice is one option of a [RequireChoice] question.
type Choice[T any] struct {
	Title string
	Value T
}

// ChoicePrompt describes a choice a command needs.
type ChoicePrompt[T any] struct {
	// What names the value in the failure off a terminal: "--type".
	What string
	// Message is the question asked on a terminal.
	Message string
	// Usage shows how to pass the value.
	Usage   string
	Choices []Choice[T]
}

// RequireChoice returns a choice a command needs: *value when it was passed
// (value is not nil), else a pick on a terminal, else a usage failure.
func RequireChoice[T any](ctx context.Context, a *App, value *T, ask ChoicePrompt[T]) (T, error) {
	if value != nil {
		return *value, nil
	}
	var none T
	if !a.IsInteractive() {
		return none, MissingInput(ask.What, ask.Usage)
	}
	labels := make([]string, len(ask.Choices))
	for index, choice := range ask.Choices {
		labels[index] = Printable(choice.Title)
	}
	index, err := a.Prompter().Select(ctx, Printable(ask.Message), labels)
	if err != nil {
		return none, err
	}
	return ask.Choices[index].Value, nil
}

// cannotConfirm is the failure of a confirmation the CLI cannot ask for:
// the question, and how to answer it.
func cannotConfirm(question string) *UserError {
	return &UserError{
		Message:  question,
		Hint:     "There is no terminal to ask in; pass --yes to confirm.",
		ExitCode: ExitUsage,
	}
}

// ConfirmChange asks before a change that cannot be undone. message is the
// question and names what changes and where: "Delete product Pro (pro) from
// acme/app?". It returns nil when yes (--yes) or the person agrees, and
// fails otherwise: with "Nothing changed." when they decline, and without
// asking when there is no terminal.
func (a *App) ConfirmChange(ctx context.Context, yes bool, message string) error {
	if yes {
		return nil
	}
	if !a.IsInteractive() {
		return cannotConfirm(message)
	}
	agreed, err := a.Prompter().Confirm(ctx, Printable(message), false)
	if err != nil {
		return err
	}
	if !agreed {
		return &UserError{Message: "Nothing changed."}
	}
	return nil
}

// typeable is text as a person can type it: without the characters nothing
// shows, without surrounding spaces, and with a letter and its accent as
// one character however the keyboard or the server wrote them.
func typeable(text string) string {
	return composeAccents(strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.Is(unicode.Cf, r) {
			return -1
		}
		return r
	}, Printable(text))))
}

// accented lists, for a combining mark, the letters it goes on and those
// letters with it. It covers the accents of Latin names, not all of
// Unicode's canonical composition, which would need a table the size of
// golang.org/x/text; a name with another mark is typed as it is stored.
var accented = map[rune][2]string{
	0x0300: {"AEIOUaeiou", "ÀÈÌÒÙàèìòù"},
	0x0301: {"AEIOUYaeiouyCcNnSsZzLlRr", "ÁÉÍÓÚÝáéíóúýĆćŃńŚśŹźĹĺŔŕ"},
	0x0302: {"AEIOUaeiou", "ÂÊÎÔÛâêîôû"},
	0x0303: {"ANOano", "ÃÑÕãñõ"},
	0x0308: {"AEIOUaeiouy", "ÄËÏÖÜäëïöüÿ"},
	0x030A: {"AaUu", "ÅåŮů"},
	0x0327: {"CcSsTt", "ÇçŞşŢţ"},
	0x030C: {"CcDdEeNnRrSsTtZz", "ČčĎďĚěŇňŘřŠšŤťŽž"},
}

// composeAccents joins a letter followed by a combining accent into the
// one character that is the same letter, as Unicode's NFC does for these.
func composeAccents(text string) string {
	composed := make([]rune, 0, len(text))
	for _, r := range text {
		if letters, ok := accented[r]; ok && len(composed) > 0 {
			if index := strings.IndexRune(letters[0], composed[len(composed)-1]); index >= 0 {
				// The plain letters are ASCII, so the byte index counts letters.
				composed[len(composed)-1] = []rune(letters[1])[index]
				continue
			}
		}
		composed = append(composed, r)
	}
	return string(composed)
}

// ConfirmByTypingName asks the person to type name before a change with a
// wide reach, such as deleting a project or an organization. yes (--yes)
// skips it. A wrong answer asks again; Ctrl+C stops.
func (a *App) ConfirmByTypingName(ctx context.Context, yes bool, message, name string) error {
	if yes {
		return nil
	}
	if !a.IsInteractive() {
		return cannotConfirm(message)
	}
	// An end user can choose the name, so it must not reach the terminal
	// raw, even in the failure message. What's compared is what the person
	// can see: characters nothing shows can't be typed.
	shown := strings.TrimSpace(Printable(name))
	// Nothing to type, and pressing Enter must not confirm.
	if typeable(name) == "" {
		return &UserError{
			Message:  Printable(message),
			Hint:     "Its name has nothing to type; pass --yes to confirm.",
			ExitCode: ExitUsage,
		}
	}
	_, err := a.Prompter().Text(ctx, fmt.Sprintf("%s Type %s to confirm", Printable(message), shown), prompt.TextOptions{
		Validate: func(typed string) (string, error) {
			if typeable(typed) == typeable(name) {
				return typed, nil
			}
			return "", fmt.Errorf("Type %s exactly, or press Ctrl+C to stop.", shown)
		},
	})
	return err
}

// ChooseSeveral asks which of labels to use, on a terminal, and returns
// their indexes in the order the person named them: numbers or names
// separated by commas, Enter for the ones options marks as selected.
// options also says whether "all" and "none" are answers, how many must be
// chosen, and what names beside the labels mean. Call it only when
// [App.IsInteractive]; off a terminal the command names its flag instead.
func ChooseSeveral(ctx context.Context, a *App, message string, labels []string, options prompt.MultiSelectOptions) ([]int, error) {
	printable := make([]string, len(labels))
	for index, label := range labels {
		printable[index] = Printable(label)
	}
	return a.Prompter().MultiSelect(ctx, Printable(message), printable, options)
}

// AskSecret asks for a secret, such as a token or a store key, without
// showing what is typed, and returns it trimmed; empty when the person only
// pressed Enter. A secret is typed here or piped in, never a flag's value,
// which would stay in the shell's history. Call it only when
// [App.IsInteractive].
func (a *App) AskSecret(ctx context.Context, message string) (string, error) {
	secret, err := a.Prompter().Secret(ctx, Printable(message))
	if err != nil && !errors.Is(err, prompt.ErrInterrupted) {
		return "", &UserError{Message: capitalize(err.Error()) + ".", Cause: err}
	}
	return secret, err
}
