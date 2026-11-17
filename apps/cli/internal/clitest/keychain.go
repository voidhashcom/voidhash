package clitest

import (
	"context"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
)

// Keychain stands in for the macOS keychain's `security` tool: it keeps the
// tokens in Items, by API origin, and records every command in Ran.
type Keychain struct {
	// Items are the stored tokens, by API origin.
	Items map[string]string
	// Ran lists the arguments of every `security` command, in order.
	Ran [][]string
	// Answer, when set, decides the exit code and output of a command
	// instead of the in-memory keychain; ok false leaves it to the keychain.
	// Use it for a keychain that is locked (exit code 36) or cannot delete.
	Answer func(args []string, stdin string) (exitCode int, stdout string, ok bool)
	// Missing fails every command as when the tool cannot be run at all.
	Missing bool
}

// NewKeychain creates an empty keychain.
func NewKeychain() *Keychain {
	return &Keychain{Items: map[string]string{}}
}

var addCommand = regexp.MustCompile(`^add-generic-password -U -s voidhash -a "([^"]+)" -l "Voidhash CLI" -X ([0-9a-f]+)\n$`)

func (k *Keychain) run(_ context.Context, name string, args []string, stdin string) (int, string, error) {
	k.Ran = append(k.Ran, append([]string{}, args...))
	if k.Missing || name != "security" {
		return 0, "", errors.New("executable file not found: " + name)
	}
	if k.Answer != nil {
		if exitCode, stdout, ok := k.Answer(args, stdin); ok {
			return exitCode, stdout, nil
		}
	}
	account := ""
	for index, arg := range args {
		if arg == "-a" && index+1 < len(args) {
			account = args[index+1]
		}
	}
	switch {
	case len(args) > 0 && args[0] == "find-generic-password":
		token, ok := k.Items[account]
		if !ok {
			return 44, "", nil
		}
		return 0, token + "\n", nil
	case len(args) > 0 && args[0] == "delete-generic-password":
		if _, ok := k.Items[account]; !ok {
			return 44, "", nil
		}
		delete(k.Items, account)
		return 0, "", nil
	case strings.Join(args, " ") == "-i":
		found := addCommand.FindStringSubmatch(stdin)
		if found == nil {
			return 1, "", nil
		}
		token, err := hex.DecodeString(found[2])
		if err != nil {
			return 1, "", nil
		}
		k.Items[found[1]] = string(token)
		return 0, "", nil
	default:
		return 1, "", nil
	}
}
