package integrate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// StateDir is where a run keeps its record and the agent's task, inside
// the project. It ignores itself, so it never shows up in git.
const StateDir = ".voidhash/integrate"

// Stages of the agent's part of a run.
const (
	// AgentRunning is set before the agent starts, so an interrupted run is
	// told apart from one that never reached the agent.
	AgentRunning = "running"
	// AgentFinished means the agent ended by itself, whatever it reported.
	AgentFinished = "finished"
	// AgentHandedOff means the task was written for the person or an agent
	// of their own, and the next run only checks the result.
	AgentHandedOff = "handed_off"
)

// State is the record of a run, which makes the next one continue it
// instead of starting over. What can be read from the project itself
// (packages, files, the project's catalog) is not recorded: each step
// checks for it.
type State struct {
	// Platform and Project are what the run set up, and for whom.
	Platform string `json:"platform"`
	Project  string `json:"project"`
	// StartedAt is when the first run started.
	StartedAt time.Time `json:"startedAt"`
	// Agent is the id of the agent used, and Session its conversation, to
	// resume.
	Agent string `json:"agent,omitempty"`
	// Model is the model the agent was asked to use; empty for its own.
	Model   string `json:"model,omitempty"`
	Session string `json:"session,omitempty"`
	// AgentStage is how far the agent's part got.
	AgentStage string `json:"agentStage,omitempty"`
	// Report is the agent's last account.
	Report *Report `json:"report,omitempty"`
	// Wrote are the files the CLI itself wrote.
	Wrote []string `json:"wrote,omitempty"`
	// BaselineFailed are the checks that failed before anything changed.
	BaselineFailed []string `json:"baselineFailed,omitempty"`
	// BaselineRun is true once the checks were run on the untouched project.
	BaselineRun bool `json:"baselineRun,omitempty"`
}

func statePath(dir string) string {
	return filepath.Join(dir, filepath.FromSlash(StateDir), "state.json")
}

// TaskPath is where the agent's task is written, relative to the project.
const TaskPath = StateDir + "/task.md"

// LoadState reads the record of an earlier run in dir. found is false when
// there is none; a record that cannot be read counts as none.
func LoadState(dir string) (state State, found bool) {
	data, err := os.ReadFile(statePath(dir))
	if err != nil {
		return State{}, false
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return State{}, false
	}
	return state, true
}

// SaveState writes the record, creating its directory with a .gitignore
// that keeps the whole directory out of git.
func SaveState(dir string, state State) error {
	if err := WriteStateFile(dir, ".gitignore", "*\n"); err != nil {
		return err
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return WriteStateFile(dir, "state.json", string(data)+"\n")
}

// WriteStateFile writes a file of the run's own into [StateDir].
func WriteStateFile(dir, name, content string) error {
	target := filepath.Join(dir, filepath.FromSlash(StateDir), name)
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	return os.WriteFile(target, []byte(content), 0o644)
}

// ClearState removes the record, so the next run starts over.
func ClearState(dir string) error {
	return os.RemoveAll(filepath.Join(dir, filepath.FromSlash(StateDir)))
}
