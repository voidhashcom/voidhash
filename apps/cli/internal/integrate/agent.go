package integrate

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// Agent is a coding agent installed on the person's computer that can be
// run without its own interface: given a task, it edits the project and
// ends with a message. Supporting another agent is implementing this.
type Agent interface {
	// ID is what --agent takes.
	ID() string
	// Name is what people call it.
	Name() string
	// Program is the command that starts it, looked up on PATH.
	Program() string
	// ModelHint says how a model is named for this agent, for the person
	// choosing one. It is empty for an agent a run cannot choose the model
	// of, which then uses the one it is set up with.
	ModelHint() string
	// Limits says, for the person, what the agent may and may not do in a
	// run, one line each.
	Limits(job Job) []string
	// Run gives the agent the job and waits for it to end. The outcome
	// carries the session as soon as it is known, also when err is set, so
	// an interrupted run can be resumed.
	Run(ctx context.Context, run cli.ProcessRunner, job Job) (Outcome, error)
}

// Job is one run of an agent.
type Job struct {
	// Dir is the project: the only directory the agent may change.
	Dir string
	// Task is what it is asked to do.
	Task string
	// Session resumes an earlier conversation instead of starting one.
	Session string
	// Model is the model the agent uses; empty for the one it is set up
	// with. Check it with [ValidModel] first: it becomes an argument.
	Model string
	// Commands are the only commands it may run: the project's checks.
	Commands [][]string
	// Progress receives what the agent does, as it does it.
	Progress func(Step)
	// Log receives the agent's raw output, for the run's log file.
	Log io.Writer
}

// Kinds of step.
const (
	StepRead   = "read"
	StepEdit   = "edit"
	StepRun    = "run"
	StepDenied = "denied"
	// StepStrayed is a change the agent made where it was told not to,
	// which the person has to look at.
	StepStrayed = "strayed"
)

// Step is one thing the agent did.
type Step struct {
	Kind string
	// Detail is the file, relative to the project, or the command.
	Detail string
}

// Outcome is how a run ended.
type Outcome struct {
	// Session identifies the conversation, to resume it.
	Session string
	// Message is the agent's final message.
	Message string
	// Failed is true when the agent ended with an error of its own, such
	// as a refused sign-in or a usage limit; Message then says which.
	Failed bool
	// ExitCode is the agent process's.
	ExitCode int
}

// modelPattern is what a model's name may look like: it is passed to the
// agent's program as an argument, so it must not read as a flag.
var modelPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/@\[\]-]{0,127}$`)

// ValidModel reports whether name can be passed to an agent as its model.
func ValidModel(name string) bool { return modelPattern.MatchString(name) }

// Agents lists the agents that can be driven, in the order they are tried.
func Agents() []Agent {
	agents := []Agent{claudeCode{}, codex{}}
	for _, agent := range acpAgents {
		agents = append(agents, agent)
	}
	return agents
}

// FindAgent is the agent with id.
func FindAgent(id string) (Agent, bool) {
	for _, agent := range Agents() {
		if agent.ID() == id {
			return agent, true
		}
	}
	return nil, false
}

// AgentIDs lists what --agent takes besides "none".
func AgentIDs() []string {
	var ids []string
	for _, agent := range Agents() {
		ids = append(ids, agent.ID())
	}
	return ids
}

// withoutCredentials are the variables an agent's process does not get: the
// CLI's own credential is for the CLI.
var withoutCredentials = []string{"VOIDHASH_API_KEY"}

// relative is path as the person knows it: inside the project.
func relative(dir, path string) string {
	if rel, err := filepath.Rel(dir, path); err == nil && !strings.HasPrefix(rel, "..") {
		return filepath.ToSlash(rel)
	}
	return path
}

func (j Job) progress(kind, detail string) {
	if j.Progress != nil && detail != "" {
		j.Progress(Step{Kind: kind, Detail: detail})
	}
}

// lines calls each for every line written to the returned writer, and done
// when the writer is closed. The agent's output is also copied to the log.
func lines(log io.Writer, each func(line []byte)) (io.WriteCloser, <-chan struct{}) {
	reader, writer := io.Pipe()
	done := make(chan struct{})
	go func() {
		defer close(done)
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
		for scanner.Scan() {
			if log != nil {
				_, _ = log.Write(append(scanner.Bytes(), '\n'))
			}
			each(scanner.Bytes())
		}
		// A line too long to hold ends the scan; keep draining so the
		// process is never blocked on a full pipe.
		_, _ = io.Copy(io.Discard, reader)
	}()
	return writer, done
}

// claudeCode drives Claude Code in print mode.
type claudeCode struct{}

func (claudeCode) ID() string      { return "claude" }
func (claudeCode) Name() string    { return "Claude Code" }
func (claudeCode) Program() string { return "claude" }
func (claudeCode) ModelHint() string {
	return "an alias such as sonnet, opus or haiku, or a full model name"
}

func (claudeCode) Limits(job Job) []string {
	limits := []string{
		"reads and edits files in this directory only, and is refused .env files",
		"runs only " + commandList(job.Commands) + ", git status, diff and log, and commands that only read files here",
		"no web access and no MCP servers; anything else is refused, not asked",
	}
	return limits
}

// claudeDenied is what Claude Code is refused whatever else is allowed.
// Its file tools, and shell commands that name a file, follow the Read
// rules; the shell's recursive searches name no file, so they are refused
// outright, and the agent searches with its own tools, which follow them.
var claudeDenied = []string{
	"Read(./.env*)", "Read(./**/.env*)", "Edit(./.env*)", "Edit(./**/.env*)", "Write(./.env*)", "Write(./**/.env*)",
	"Bash(grep:*)", "Bash(egrep:*)", "Bash(fgrep:*)", "Bash(rg:*)", "Bash(git grep:*)", "Bash(find:*)",
	"WebFetch", "WebSearch",
}

// claudeArgs are the arguments of a run. Print mode never asks: a tool
// that is not allowed here is refused, and the agent is told.
func claudeArgs(job Job) []string {
	allowed := []string{"Read", "Glob", "Grep", "Edit", "Write", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)"}
	for _, command := range job.Commands {
		joined := strings.Join(command, " ")
		allowed = append(allowed, "Bash("+joined+")", "Bash("+joined+" *)")
	}
	args := []string{
		"--print", "--output-format", "stream-json", "--verbose",
	}
	if job.Model != "" {
		args = append(args, "--model", job.Model)
	}
	args = append(args,
		// Edits inside the working directory are accepted; everything else
		// needs a rule below.
		"--permission-mode", "acceptEdits",
		// The person's own MCP servers are not part of this task.
		"--strict-mcp-config",
		"--disallowedTools",
	)
	args = append(args, claudeDenied...)
	args = append(args, "--allowedTools")
	args = append(args, allowed...)
	if job.Session != "" {
		args = append(args, "--resume", job.Session)
	}
	return args
}

func (claudeCode) Run(ctx context.Context, run cli.ProcessRunner, job Job) (Outcome, error) {
	var outcome Outcome
	stdout, done := lines(job.Log, func(line []byte) {
		var event struct {
			Type      string `json:"type"`
			Subtype   string `json:"subtype"`
			SessionID string `json:"session_id"`
			ToolName  string `json:"tool_name"`
			Result    string `json:"result"`
			IsError   bool   `json:"is_error"`
			// Message is an object on the agent's turns and a text on others.
			Message json.RawMessage `json:"message"`
		}
		if json.Unmarshal(line, &event) != nil {
			return
		}
		var message struct {
			Content []struct {
				Type  string `json:"type"`
				Name  string `json:"name"`
				Input struct {
					FilePath string `json:"file_path"`
					Command  string `json:"command"`
				} `json:"input"`
			} `json:"content"`
		}
		if event.Type == "assistant" {
			_ = json.Unmarshal(event.Message, &message)
		}
		if event.SessionID != "" {
			outcome.Session = event.SessionID
		}
		switch {
		case event.Type == "assistant":
			for _, block := range message.Content {
				if block.Type != "tool_use" {
					continue
				}
				switch block.Name {
				case "Read":
					job.progress(StepRead, relative(job.Dir, block.Input.FilePath))
				case "Edit", "Write", "MultiEdit":
					job.progress(StepEdit, relative(job.Dir, block.Input.FilePath))
				case "Bash":
					job.progress(StepRun, block.Input.Command)
				}
			}
		case event.Type == "system" && event.Subtype == "permission_denied":
			job.progress(StepDenied, "a "+event.ToolName+" call")
		case event.Type == "result":
			outcome.Message, outcome.Failed = event.Result, event.IsError
		}
	})
	exitCode, err := run(ctx, cli.Process{
		Name: "claude", Args: claudeArgs(job), Dir: job.Dir,
		Stdin: strings.NewReader(job.Task), Stdout: stdout, Stderr: job.Log,
		Unset: withoutCredentials,
	})
	_ = stdout.Close()
	<-done
	outcome.ExitCode = exitCode
	if exitCode != 0 {
		outcome.Failed = true
	}
	return outcome, err
}

// codex drives Codex in exec mode.
type codex struct{}

func (codex) ID() string        { return "codex" }
func (codex) Name() string      { return "Codex" }
func (codex) Program() string   { return "codex" }
func (codex) ModelHint() string { return "a model name, as 'codex --model' takes it" }

func (codex) Limits(Job) []string {
	return []string{
		"runs in Codex's workspace-write sandbox: it can write in this directory only",
		"commands it runs have no network access, and nothing is asked: what the sandbox forbids fails",
		"it is told not to read .env files, which the sandbox itself does not prevent",
	}
}

// codexArgs are the arguments of a run. The sandbox is set as a config
// value, which a resumed session takes too.
func codexArgs(job Job) []string {
	args := []string{"exec"}
	if job.Model != "" {
		args = append(args, "--model", job.Model)
	}
	if job.Session != "" {
		args = append(args, "resume", job.Session)
	}
	return append(args, "--json", "--skip-git-repo-check", "-c", `sandbox_mode="workspace-write"`, "-")
}

func (codex) Run(ctx context.Context, run cli.ProcessRunner, job Job) (Outcome, error) {
	var outcome Outcome
	stdout, done := lines(job.Log, func(line []byte) {
		var event struct {
			Type     string `json:"type"`
			ThreadID string `json:"thread_id"`
			Message  string `json:"message"`
			Error    struct {
				Message string `json:"message"`
			} `json:"error"`
			Item struct {
				Type    string `json:"type"`
				Text    string `json:"text"`
				Command string `json:"command"`
				Changes []struct {
					Path string `json:"path"`
				} `json:"changes"`
			} `json:"item"`
		}
		if json.Unmarshal(line, &event) != nil {
			return
		}
		switch event.Type {
		case "thread.started":
			outcome.Session = event.ThreadID
		case "item.started":
			if event.Item.Type == "command_execution" {
				job.progress(StepRun, unwrapShell(event.Item.Command))
			}
		case "item.completed":
			switch event.Item.Type {
			case "agent_message":
				outcome.Message = event.Item.Text
			case "file_change":
				for _, change := range event.Item.Changes {
					job.progress(StepEdit, relative(job.Dir, change.Path))
				}
			}
		case "turn.failed":
			outcome.Failed, outcome.Message = true, event.Error.Message
		case "error":
			outcome.Failed, outcome.Message = true, event.Message
		}
	})
	exitCode, err := run(ctx, cli.Process{
		Name: "codex", Args: codexArgs(job), Dir: job.Dir,
		Stdin: strings.NewReader(job.Task), Stdout: stdout, Stderr: job.Log,
		Unset: withoutCredentials,
	})
	_ = stdout.Close()
	<-done
	outcome.ExitCode = exitCode
	if exitCode != 0 {
		outcome.Failed = true
	}
	return outcome, err
}

// shellWrapper is the shell Codex runs a command through.
var shellWrapper = regexp.MustCompile(`^\S*(?:sh|zsh|bash) -l?c (.*)$`)

// unwrapShell is the command Codex ran, without the shell it ran it in.
func unwrapShell(command string) string {
	inner := shellWrapper.FindStringSubmatch(command)
	if inner == nil {
		return command
	}
	return strings.Trim(inner[1], `"'`)
}

func commandList(commands [][]string) string {
	if len(commands) == 0 {
		return "no project commands"
	}
	joined := make([]string, len(commands))
	for index, command := range commands {
		joined[index] = "'" + strings.Join(command, " ") + "'"
	}
	return strings.Join(joined, ", ")
}
