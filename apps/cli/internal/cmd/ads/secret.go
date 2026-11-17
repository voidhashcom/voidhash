package ads

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// secretPrompt describes a secret a command needs. A secret is piped in or
// typed at a prompt that does not show it; as a flag's value it would stay
// in the shell's history and show in the process list.
type secretPrompt struct {
	// What names the secret: "access token".
	What string
	// Message is the question asked on a terminal.
	Message string
	// PipeUsage shows how to pipe it in: "voidhash ads connect <account> --token-stdin < token.txt".
	PipeUsage string
}

// readSecret returns the secret: all of standard input when fromStdin, else
// what the person types on a terminal, else a usage failure that says how
// to pipe it in.
func readSecret(ctx context.Context, app *cli.App, fromStdin bool, ask secretPrompt) (string, error) {
	if fromStdin {
		piped, err := io.ReadAll(app.Stdin)
		if err != nil {
			return "", cli.Failf("Could not read the %s from standard input: %v", ask.What, err)
		}
		secret := strings.TrimSpace(string(piped))
		if secret == "" {
			return "", cli.Usagef("Nothing was piped in as the %s.", ask.What).WithHint("Run it as: " + ask.PipeUsage)
		}
		return secret, nil
	}
	if !app.IsInteractive() {
		return "", cli.Usagef("Missing the %s.", ask.What).WithHint("There is no terminal to ask in; pipe it in: " + ask.PipeUsage)
	}
	for {
		secret, err := app.AskSecret(ctx, ask.Message)
		if err != nil {
			return "", err
		}
		if secret != "" {
			return secret, nil
		}
		fmt.Fprintln(app.Stderr, "Paste it, then press Enter.")
	}
}
