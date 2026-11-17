// Package mcp holds `voidhash mcp`: connecting AI agents to Voidhash.
package mcp

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/prompt"
)

// New creates `voidhash mcp`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "mcp",
		Short: "Connect AI agents to Voidhash over MCP.",
		Long:  "Connect AI agents, such as Claude Code, Cursor and Codex, to Voidhash over the Model Context Protocol, so they can read and change your projects as you.",
	}
	cmd.AddCommand(newInstall(app))
	return cmd
}

// agent is an AI agent `mcp install` knows how to configure.
type agent struct {
	label string
	// detect reports whether it is installed on this computer.
	detect func(ctx context.Context) bool
	// install adds the server and returns what to tell the person.
	install func(ctx context.Context, url string) (string, error)
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// readIfExists is the file's content, or empty when there is no file.
func readIfExists(path string) (string, error) {
	content, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	return string(content), err
}

func write(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}

func agents(app *cli.App) []agent {
	cursorConfig := filepath.Join(app.Home, ".cursor", "mcp.json")
	codexConfig := filepath.Join(app.Home, ".codex", "config.toml")
	claudeDesktopDir := filepath.Join(app.Home, ".config", "Claude")
	switch app.GOOS {
	case "darwin":
		claudeDesktopDir = filepath.Join(app.Home, "Library", "Application Support", "Claude")
	case "windows":
		claudeDesktopDir = filepath.Join(app.Home, "AppData", "Roaming", "Claude")
	}
	// succeeded runs a command of the agent itself and reports whether it
	// could be run and exited with 0.
	succeeded := func(ctx context.Context, command string, args ...string) bool {
		exitCode, _, err := app.RunTool(ctx, command, args, "")
		return err == nil && exitCode == 0
	}
	isInstalled := func(ctx context.Context, command string) bool { return succeeded(ctx, command, "--version") }

	return []agent{
		{
			label:  "Claude Code",
			detect: func(ctx context.Context) bool { return isInstalled(ctx, "claude") },
			install: func(ctx context.Context, url string) (string, error) {
				if succeeded(ctx, "claude", "mcp", "add", "--transport", "http", "--scope", "user", serverName, url) {
					return "added for every project (user scope)", nil
				}
				return "not changed; it may already list a voidhash server ('claude mcp list' shows it)", nil
			},
		},
		{
			label:  "Cursor",
			detect: func(context.Context) bool { return exists(filepath.Join(app.Home, ".cursor")) },
			install: func(_ context.Context, url string) (string, error) {
				existing, err := readIfExists(cursorConfig)
				if err != nil {
					return "", err
				}
				content, err := withCursorServer(existing, url)
				if err != nil {
					return "", err
				}
				return "added to " + cursorConfig, write(cursorConfig, content)
			},
		},
		{
			label: "Codex",
			detect: func(ctx context.Context) bool {
				return exists(filepath.Join(app.Home, ".codex")) || isInstalled(ctx, "codex")
			},
			install: func(_ context.Context, url string) (string, error) {
				existing, err := readIfExists(codexConfig)
				if err != nil {
					return "", err
				}
				content, changed := withCodexServer(existing, url)
				if !changed {
					return "already in " + codexConfig, nil
				}
				return "added to " + codexConfig, write(codexConfig, content)
			},
		},
		{
			label:  "VS Code",
			detect: func(ctx context.Context) bool { return isInstalled(ctx, "code") },
			install: func(ctx context.Context, url string) (string, error) {
				if succeeded(ctx, "code", "--add-mcp", vscodeServer(url)) {
					return "added to your user settings", nil
				}
				return "could not be updated", nil
			},
		},
		{
			label:  "Claude Desktop",
			detect: func(context.Context) bool { return exists(claudeDesktopDir) },
			// Its configuration file lists only local servers; remote ones
			// are connectors.
			install: func(_ context.Context, url string) (string, error) {
				return "open Settings → Connectors → Add custom connector, and paste " + url, nil
			},
		},
	}
}

// choose asks which of the detected agents to configure: all of them when
// the person presses Enter, or the ones whose numbers they type.
func choose(ctx context.Context, app *cli.App, detected []agent) ([]agent, error) {
	labels := make([]string, len(detected))
	for index, candidate := range detected {
		labels[index] = candidate.label
	}
	if !app.IsInteractive() {
		return nil, &cli.UserError{
			Message:  fmt.Sprintf("Add Voidhash to %s?", strings.Join(labels, ", ")),
			Hint:     "There is no terminal to ask in; pass --yes to add it to every agent found.",
			ExitCode: cli.ExitUsage,
		}
	}
	every := make([]int, len(detected))
	for index := range every {
		every[index] = index
	}
	indexes, err := cli.ChooseSeveral(ctx, app, "These agents are on this computer. Add Voidhash to which?", labels, prompt.MultiSelectOptions{
		Selected: every, AllowAll: true, AllowNone: true,
		Prompt: "Numbers, separated by commas",
		// Agents go by their number; yes and no answer for all and none.
		Named: func(answer string) ([]int, bool) {
			switch strings.ToLower(answer) {
			case "a", "y", "yes":
				return every, true
			case "n", "no":
				return nil, true
			}
			return nil, false
		},
	})
	if err != nil {
		return nil, err
	}
	slices.Sort(indexes)
	chosen := make([]agent, len(indexes))
	for position, index := range indexes {
		chosen[position] = detected[index]
	}
	return chosen, nil
}

// newInstall creates `voidhash mcp install`.
func newInstall(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "install",
		Short: "Add the Voidhash MCP server to the AI agents on this computer.",
		Long: `Add the Voidhash MCP server to the AI agents found on this computer: Claude Code, Cursor, Codex, VS Code and Claude Desktop. It asks which, unless --yes.

No key is written anywhere. The first time an agent uses Voidhash, your browser opens to sign in, and the agent then acts as you.`,
		Example: `voidhash mcp install
voidhash mcp install --yes`,
	}
	yes := cmd.Flags().BoolP("yes", "y", false, "Add it to every agent found, without asking")

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		settings, err := app.Config()
		if err != nil {
			return err
		}
		url := serverURL(settings.APIURL)

		var detected []agent
		for _, candidate := range agents(app) {
			if candidate.detect(ctx) {
				detected = append(detected, candidate)
			}
		}
		if len(detected) == 0 {
			app.Println("No supported agent was found on this computer. Add this MCP server to your agent yourself:")
			app.Println("")
			app.Println("  " + url)
			app.Println("")
			app.Println("https://voidhash.com/docs/mcp has each agent's steps.")
			return nil
		}
		chosen := detected
		if !*yes {
			if chosen, err = choose(ctx, app, detected); err != nil {
				return err
			}
		}
		if len(chosen) == 0 {
			app.Println("Nothing changed.")
			return nil
		}
		// One at a time: the agents' own commands share this terminal.
		for _, candidate := range chosen {
			outcome, err := candidate.install(ctx, url)
			switch {
			case errors.Is(err, errNotAnObject):
				outcome = "failed: its configuration file is not valid JSON, so it was left as is"
			case err != nil:
				outcome = "failed: " + err.Error()
			}
			app.Printf("%s: %s\n", candidate.label, outcome)
		}
		app.Notef("The first time an agent uses Voidhash, your browser opens to sign in. It then acts as you; make it read-only under Settings → Devices and apps in the dashboard.")
		return nil
	}
	return cmd
}
