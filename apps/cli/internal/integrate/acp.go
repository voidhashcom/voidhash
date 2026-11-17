package integrate

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// acpAgent drives an agent that speaks the Agent Client Protocol
// (agentclientprotocol.com): JSON-RPC over the agent's standard input and
// output. The agent asks before it changes a file or runs a command, and
// the answer is the CLI's, so every such agent works under the same rules.
type acpAgent struct {
	id, name, program string
	args              []string
	// env adds variables to the agent's process.
	env func(Job) []string
	// mode is the session mode in which the agent asks before it acts,
	// for agents that do not start in it.
	mode string
	// signIn is the command that signs the person in.
	signIn string
	// modelFlag is the argument its program takes a model with, before
	// the others. An agent that takes it another way, or not at all, has
	// none.
	modelFlag string
	// modelHint says how a model is named for it; empty when a run cannot
	// choose its model.
	modelHint string
	// editsUnasked is true for an agent that asks before it runs a command
	// but not before it changes a file, whatever it is started with: where
	// it writes is then only what its task tells it.
	editsUnasked bool
	// asksToRead is true when the agent also asks before it reads a file,
	// so .env files are refused, not only forbidden by the task.
	asksToRead bool
}

// acpAgents are the agents driven over the protocol. Each line is how the
// agent is started so that it asks; the rest is the same for all.
var acpAgents = []acpAgent{
	{
		id: "opencode", name: "OpenCode", program: "opencode", args: []string{"acp"}, signIn: "opencode auth login",
		env: openCodeEnv, asksToRead: true,
		// OpenCode takes its model in its configuration: see openCodeEnv.
		modelHint: "provider/model, as 'opencode models' lists them",
	},
	// The mode is an argument so that a saved "always approve" does not apply.
	{id: "grok", name: "Grok Build", program: "grok", args: []string{"--permission-mode", "default", "--disable-web-search", "agent", "stdio"}, signIn: "grok login",
		modelFlag: "--model", modelHint: "a model id, as 'grok models' lists them"},
	{id: "cursor", name: "Cursor", program: "cursor-agent", args: []string{"acp"}, signIn: "cursor-agent login", editsUnasked: true,
		modelFlag: "--model", modelHint: "a model name, as 'cursor-agent --list-models' lists them"},
	{id: "fx", name: "fx", program: "fx", args: []string{"acp"}, mode: "ask", signIn: "fx login"},
}

// openCodeEnv is OpenCode's configuration for a run. It allows everything
// unless told otherwise, and what it asks about a read or a command does
// not say which, so those rules are its own: a refusal of its own is also
// one it works on after, where a refused question ends its turn.
func openCodeEnv(job Job) []string {
	commands := map[string]string{"*": "deny"}
	for _, command := range append(slices.Clone(job.Commands), readOnlyGit...) {
		joined := strings.Join(command, " ")
		commands[joined], commands[joined+" *"] = "allow", "allow"
	}
	settings := map[string]any{"permission": map[string]any{
		"edit": "ask", "bash": commands,
		"read":     map[string]string{"*": "allow", "*.env": "deny", "*.env.*": "deny"},
		"webfetch": "deny", "websearch": "deny", "external_directory": "deny",
	}}
	if job.Model != "" {
		settings["model"] = job.Model
	}
	config, _ := json.Marshal(settings)
	return []string{"OPENCODE_CONFIG_CONTENT=" + string(config)}
}

func (a acpAgent) ID() string        { return a.id }
func (a acpAgent) Name() string      { return a.name }
func (a acpAgent) Program() string   { return a.program }
func (a acpAgent) ModelHint() string { return a.modelHint }

func (a acpAgent) Limits(job Job) []string {
	reads := "it is told not to read .env files, which nothing here prevents"
	if a.asksToRead {
		reads = "it is refused .env files, to read as well as to change"
	}
	runs := "may run only " + commandList(job.Commands) + ", and git status, diff and log; anything else is refused"
	if a.editsUnasked {
		return []string{
			"asks the CLI before it runs a command; nothing is asked of you",
			runs,
			"changes files without asking: it is told to stay in this directory and off .env files, which nothing here prevents",
		}
	}
	return []string{
		"asks the CLI before it changes a file or runs a command; nothing is asked of you",
		"may change files in this directory only, and no .env file; " + reads,
		runs,
	}
}

// How long an agent gets to answer outside its turn, and to stop by itself
// once the conversation is over.
const (
	acpAnswerTimeout = 2 * time.Minute
	acpExitGrace     = 3 * time.Second
)

func (a acpAgent) Run(ctx context.Context, run cli.ProcessRunner, job Job) (Outcome, error) {
	inner, stop := context.WithCancel(ctx)
	defer stop()
	toAgent, agentReads := io.Pipe()
	agentWrites, fromAgent := io.Pipe()

	var env []string
	if a.env != nil {
		env = a.env(job)
	}
	args := a.args
	if job.Model != "" && a.modelFlag != "" {
		args = append([]string{a.modelFlag, job.Model}, a.args...)
	}
	var exitCode int
	var runErr error
	exited := make(chan struct{})
	go func() {
		defer close(exited)
		exitCode, runErr = run(inner, cli.Process{
			Name: a.program, Args: args, Dir: job.Dir, Env: env,
			Stdin: toAgent, Stdout: fromAgent, Stderr: job.Log,
			Unset: withoutCredentials,
		})
		_ = fromAgent.Close()
		_ = toAgent.Close()
	}()

	session := &acpSession{job: job, conn: newACPConn(agentReads, job.Log)}
	go session.conn.serve(agentWrites, session.request, session.notification)

	outcome := a.converse(inner, session)
	_ = agentReads.Close()
	select {
	case <-exited:
	case <-time.After(acpExitGrace):
		// Still running with nothing left to read: it is stopped.
		stop()
		<-exited
		exitCode, runErr = 0, nil
	}
	_ = agentWrites.Close()
	outcome.ExitCode = exitCode
	if ctx.Err() != nil {
		return outcome, ctx.Err()
	}
	if runErr != nil && !errors.Is(runErr, context.Canceled) {
		return outcome, runErr
	}
	return outcome, nil
}

// converse opens or resumes the conversation, gives the task and waits for
// the turn to end.
func (a acpAgent) converse(ctx context.Context, session *acpSession) Outcome {
	var outcome Outcome
	conn, job := session.conn, session.job
	fail := func(what string, err error) Outcome {
		outcome.Failed = true
		outcome.Message = what + ": " + err.Error()
		var refused *acpError
		if errors.As(err, &refused) && refused.Code == acpAuthRequired {
			outcome.Message = a.name + " is not signed in. Run '" + a.signIn + "' first."
		}
		return outcome
	}

	setup, cancel := context.WithTimeout(ctx, acpAnswerTimeout)
	defer cancel()
	var hello struct {
		ProtocolVersion int `json:"protocolVersion"`
		AuthMethods     []struct {
			ID string `json:"id"`
		} `json:"authMethods"`
		Meta struct {
			DefaultAuthMethodID string `json:"defaultAuthMethodId"`
		} `json:"_meta"`
		AgentCapabilities struct {
			LoadSession         bool `json:"loadSession"`
			SessionCapabilities struct {
				Resume *struct{} `json:"resume"`
			} `json:"sessionCapabilities"`
		} `json:"agentCapabilities"`
	}
	err := conn.call(setup, "initialize", map[string]any{
		"protocolVersion": acpProtocolVersion,
		// The agent reads, writes and runs by itself, and asks first.
		"clientCapabilities": map[string]any{
			"fs":       map[string]any{"readTextFile": false, "writeTextFile": false},
			"terminal": false,
		},
		"clientInfo": map[string]any{"name": "voidhash", "title": "Voidhash CLI", "version": "1"},
	}, &hello)
	if err != nil {
		return fail(a.name+" did not start", err)
	}
	if hello.ProtocolVersion != acpProtocolVersion {
		outcome.Failed, outcome.Message = true, "This version of "+a.name+" speaks a protocol the CLI does not. Update it, or the CLI."
		return outcome
	}

	var opened struct {
		SessionID string `json:"sessionId"`
		Modes     struct {
			CurrentModeID  string `json:"currentModeId"`
			AvailableModes []struct {
				ID string `json:"id"`
			} `json:"availableModes"`
		} `json:"modes"`
	}
	place := map[string]any{"cwd": job.Dir, "mcpServers": []any{}}
	open := func() error {
		switch {
		case job.Session == "":
			return conn.call(setup, "session/new", place, &opened)
		case hello.AgentCapabilities.SessionCapabilities.Resume != nil:
			place["sessionId"] = job.Session
			return conn.call(setup, "session/resume", place, &opened)
		case hello.AgentCapabilities.LoadSession:
			place["sessionId"] = job.Session
			// Loading replays the conversation so far, which is not news.
			session.setReplaying(true)
			defer session.setReplaying(false)
			return conn.call(setup, "session/load", place, &opened)
		}
		return errors.New("it cannot continue an earlier conversation")
	}
	err = open()
	var refused *acpError
	if errors.As(err, &refused) && refused.Code == acpAuthRequired && len(hello.AuthMethods) > 0 {
		// Some agents take the sign-in the person already did only when
		// asked to: the method named is the one that asks nothing.
		method := hello.Meta.DefaultAuthMethodID
		if method == "" {
			method = hello.AuthMethods[0].ID
		}
		if err = conn.call(setup, "authenticate", map[string]any{"methodId": method}, nil); err == nil {
			err = open()
		} else {
			err = &acpError{Code: acpAuthRequired, Message: err.Error()}
		}
	}
	if err != nil {
		return fail(a.name+" could not open the conversation", err)
	}
	if opened.SessionID == "" {
		opened.SessionID = job.Session
	}
	outcome.Session = opened.SessionID

	// A mode the agent does not offer is left alone: it then starts as it
	// was started, and still has to ask before every change.
	offered := slices.ContainsFunc(opened.Modes.AvailableModes, func(mode struct {
		ID string `json:"id"`
	}) bool {
		return mode.ID == a.mode
	})
	if a.mode != "" && offered {
		if err := conn.call(setup, "session/set_mode", map[string]any{"sessionId": opened.SessionID, "modeId": a.mode}, nil); err != nil {
			return fail(a.name+" could not be set to ask before it acts", err)
		}
	}

	var turn struct {
		StopReason string `json:"stopReason"`
	}
	task := job.Task
	for attempt := 0; ; attempt++ {
		session.startTurn()
		turn.StopReason = ""
		err = conn.call(ctx, "session/prompt", map[string]any{
			"sessionId": opened.SessionID,
			"prompt":    []any{map[string]any{"type": "text", "text": task}},
		}, &turn)
		if ctx.Err() != nil {
			// Told to stop, so that it does not go on by itself.
			conn.notify("session/cancel", map[string]any{"sessionId": opened.SessionID})
			return outcome
		}
		if err != nil {
			return fail(a.name+" stopped", err)
		}
		outcome.Message = session.lastMessage()
		// Some agents end their turn at a refusal, to hear what to do
		// instead. They are told, a few times at most.
		refusals := session.refusals()
		stoppedAtRefusal := len(refusals) > 0 && (turn.StopReason == "cancelled" || outcome.Message == "")
		if !stoppedAtRefusal || attempt == acpRefusalTurns {
			break
		}
		task = "Refused, and it will be refused again: " + strings.Join(refusals, "; ") + ". " + acpAfterRefusal
	}
	switch turn.StopReason {
	case "end_turn":
	case "refusal":
		outcome.Failed, outcome.Message = true, "it refused the task. "+outcome.Message
	case "max_tokens", "max_turn_requests":
		outcome.Failed, outcome.Message = true, "it reached its limit for one turn before it finished. "+outcome.Message
	default:
		outcome.Failed, outcome.Message = true, "it ended early ("+turn.StopReason+"). "+outcome.Message
	}
	return outcome
}

// acpSession is the CLI's side of one conversation: it hears what the
// agent does and answers what the agent asks.
type acpSession struct {
	job  Job
	conn *acpConn

	mu        sync.Mutex
	replaying bool
	// message is what the agent said since it last used a tool.
	message strings.Builder
	// refused are the tool calls refused in this turn.
	refused []string
	// kinds and shown are, by tool call, its kind and whether the person
	// was told of it: an agent may name the file or command only later.
	kinds map[string]string
	shown map[string]bool
}

func (s *acpSession) startTurn() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.refused = nil
	s.message.Reset()
}

func (s *acpSession) refusals() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.refused)
}

// refuse records a refusal and shows it.
func (s *acpSession) refuse(detail string) {
	s.mu.Lock()
	s.refused = append(s.refused, detail)
	s.mu.Unlock()
	s.job.progress(StepDenied, detail)
}

func (s *acpSession) setReplaying(replaying bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.replaying = replaying
	s.message.Reset()
}

func (s *acpSession) lastMessage() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return strings.TrimSpace(s.message.String())
}

// acpToolCall is a use of one of the agent's tools, as it announces it
// and as it asks for it.
type acpToolCall struct {
	Title     string `json:"title"`
	Kind      string `json:"kind"`
	Locations []struct {
		Path string `json:"path"`
	} `json:"locations"`
	RawInput json.RawMessage `json:"rawInput"`
	// Meta holds the kind for an agent that announces a call without one.
	Meta struct {
		Tool struct {
			Kind string `json:"kind"`
		} `json:"x.ai/tool"`
	} `json:"_meta"`
}

func (s *acpSession) notification(method string, params json.RawMessage) {
	if method != "session/update" {
		return
	}
	var notice struct {
		Update struct {
			acpToolCall
			ToolCallID    string `json:"toolCallId"`
			SessionUpdate string `json:"sessionUpdate"`
			// Content is one block of a message, or a list of a tool
			// call's results.
			Content json.RawMessage `json:"content"`
		} `json:"update"`
	}
	_ = json.Unmarshal(params, &notice)
	update := notice.Update
	var said struct {
		Text string `json:"text"`
	}
	var results []struct {
		Type string `json:"type"`
		Path string `json:"path"`
	}
	if json.Unmarshal(update.Content, &said) != nil {
		_ = json.Unmarshal(update.Content, &results)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.replaying {
		return
	}
	switch update.SessionUpdate {
	case "agent_message_chunk":
		s.message.WriteString(said.Text)
	case "tool_call", "tool_call_update":
		if update.SessionUpdate == "tool_call" {
			s.message.Reset()
		}
		if s.kinds == nil {
			s.kinds, s.shown = map[string]string{}, map[string]bool{}
		}
		if update.Kind == "" {
			update.Kind = update.Meta.Tool.Kind
		}
		if update.Kind != "" {
			s.kinds[update.ToolCallID] = update.Kind
		}
		if s.shown[update.ToolCallID] {
			return
		}
		kind, details := "", update.paths()
		switch s.kinds[update.ToolCallID] {
		case "read":
			kind = StepRead
		case "edit", "delete", "move":
			kind = StepEdit
			// Some agents say which file only with the change they made.
			for _, result := range results {
				if result.Type == "diff" && result.Path != "" && !slices.Contains(details, result.Path) {
					details = append(details, result.Path)
				}
			}
		case "execute":
			kind, details = StepRun, nil
			if command := update.inputCommand(); command != "" {
				details = []string{command}
			}
		}
		for _, detail := range details {
			s.shown[update.ToolCallID] = true
			if kind == StepEdit && !s.job.mayTouch(detail) {
				// Made without asking, by an agent that does not ask.
				kind = StepStrayed
			}
			s.job.progress(kind, relative(s.job.Dir, detail))
		}
	}
}

// request answers what the agent asks of the CLI: only whether it may use
// a tool. The files and the terminal are the agent's own.
func (s *acpSession) request(method string, params json.RawMessage) (any, *acpError) {
	if method != "session/request_permission" {
		return nil, &acpError{Code: acpMethodNotFound, Message: "The Voidhash CLI does not provide " + method + "."}
	}
	var asked struct {
		ToolCall acpToolCall `json:"toolCall"`
		Options  []struct {
			OptionID string `json:"optionId"`
			Kind     string `json:"kind"`
		} `json:"options"`
	}
	if err := json.Unmarshal(params, &asked); err != nil {
		return nil, &acpError{Code: acpInvalidParams, Message: err.Error()}
	}
	// Once, never always: an answer that outlives the run is the person's
	// to give, in the agent's own settings.
	wanted := "reject_once"
	if s.job.permits(asked.ToolCall) {
		wanted = "allow_once"
	} else {
		s.refuse(asked.ToolCall.describe(s.job.Dir))
	}
	for _, option := range asked.Options {
		if option.Kind == wanted {
			return map[string]any{"outcome": map[string]any{"outcome": "selected", "optionId": option.OptionID}}, nil
		}
	}
	// No such answer on offer: the question is called off, which refuses it.
	if wanted == "allow_once" {
		s.refuse(asked.ToolCall.describe(s.job.Dir))
	}
	return map[string]any{"outcome": map[string]any{"outcome": "cancelled"}}, nil
}

// command is the command an execute call runs. Agents put it in their
// tool's input under one of a few names, and in the title otherwise.
func (c acpToolCall) command() string {
	if command := c.inputCommand(); command != "" {
		return command
	}
	return strings.Trim(strings.TrimSpace(c.Title), "`")
}

func (c acpToolCall) inputCommand() string {
	var input struct {
		Command json.RawMessage `json:"command"`
		Cmd     json.RawMessage `json:"cmd"`
	}
	_ = json.Unmarshal(c.RawInput, &input)
	for _, raw := range []json.RawMessage{input.Command, input.Cmd} {
		var text string
		var words []string
		switch {
		case json.Unmarshal(raw, &text) == nil && text != "":
			return unwrapShell(text)
		case json.Unmarshal(raw, &words) == nil && len(words) > 0:
			return unwrapShell(strings.Join(words, " "))
		}
	}
	return ""
}

// paths are the files a call names: where the protocol has them, and
// where agents that leave that empty put them in their tool's input.
func (c acpToolCall) paths() []string {
	var paths []string
	for _, location := range c.Locations {
		paths = append(paths, location.Path)
	}
	var input map[string]json.RawMessage
	_ = json.Unmarshal(c.RawInput, &input)
	for _, name := range []string{"file_path", "filePath", "path", "target_file", "old_path", "new_path", "source", "destination"} {
		var path string
		if json.Unmarshal(input[name], &path) == nil && path != "" && !slices.Contains(paths, path) {
			paths = append(paths, path)
		}
	}
	return paths
}

// describe is the call for a person: the command, or the files in dir.
func (c acpToolCall) describe(dir string) string {
	if c.Kind == "execute" {
		return "running '" + c.command() + "'"
	}
	paths := c.paths()
	if len(paths) == 0 {
		return strings.TrimSpace(c.Title)
	}
	for index, path := range paths {
		paths[index] = relative(dir, path)
	}
	what := map[string]string{"read": "reading ", "edit": "changing ", "delete": "deleting ", "move": "moving "}[c.Kind]
	return what + strings.Join(paths, ", ")
}

// permits reports whether the agent may make this tool call.
func (j Job) permits(call acpToolCall) bool {
	switch call.Kind {
	case "read", "search", "think":
		// Reading names a file when it reads one; a search names none.
		for _, path := range call.paths() {
			if !j.mayTouch(path) {
				return false
			}
		}
		return true
	case "edit", "delete", "move":
		paths := call.paths()
		for _, path := range paths {
			if !j.mayTouch(path) {
				return false
			}
		}
		// A change that does not say where is not allowed anywhere.
		return len(paths) > 0
	case "execute":
		return j.mayRun(call.command())
	}
	// Fetching from the web, and tools the protocol has no name for.
	return false
}

// mayTouch reports whether path is a file of the project that holds no
// secrets. Links are followed first, so one that points out of the project
// is not a way out of it.
func (j Job) mayTouch(path string) bool {
	if !filepath.IsAbs(path) {
		path = filepath.Join(j.Dir, path)
	}
	root, rootOK := canonical(j.Dir)
	target, targetOK := canonical(path)
	if !rootOK || !targetOK {
		return false
	}
	inside, err := filepath.Rel(root, target)
	if err != nil || inside == ".." || strings.HasPrefix(inside, ".."+string(filepath.Separator)) || filepath.IsAbs(inside) {
		return false
	}
	for _, name := range []string{filepath.Base(path), filepath.Base(target)} {
		if strings.HasPrefix(name, ".env") {
			return false
		}
	}
	return true
}

// canonical is path with its links followed. A file that does not exist
// yet has the links of the nearest directory that does.
func canonical(path string) (string, bool) {
	path = filepath.Clean(path)
	var missing []string
	for {
		resolved, err := filepath.EvalSymlinks(path)
		if err == nil {
			return filepath.Join(append([]string{resolved}, missing...)...), true
		}
		if !errors.Is(err, os.ErrNotExist) {
			return "", false
		}
		// A link that leads nowhere is there, but cannot be followed.
		if _, err := os.Lstat(path); err == nil {
			return "", false
		}
		parent := filepath.Dir(path)
		if parent == path {
			return "", false
		}
		missing = append([]string{filepath.Base(path)}, missing...)
		path = parent
	}
}

// readOnlyGit are the git commands that only show the project.
var readOnlyGit = [][]string{{"git", "status"}, {"git", "diff"}, {"git", "log"}}

// mayRun reports whether command is one of the project's checks or shows
// what changed, and nothing besides: a shell would run whatever follows a
// separator, so a command with one is refused whole.
func (j Job) mayRun(command string) bool {
	command = strings.TrimSpace(command)
	if command == "" || strings.ContainsAny(command, ";&|<>`$(){}\n\r\\") {
		return false
	}
	words := strings.Fields(command)
	for _, check := range j.Commands {
		if len(check) > 0 && len(words) >= len(check) && slices.Equal(words[:len(check)], check) {
			return true
		}
	}
	for _, git := range readOnlyGit {
		if len(words) < len(git) || !slices.Equal(words[:len(git)], git) {
			continue
		}
		// --output writes what it shows to a file.
		return !slices.ContainsFunc(words, func(word string) bool { return strings.HasPrefix(word, "--output") })
	}
	return false
}

const acpProtocolVersion = 1

// acpRefusalTurns is how often an agent that stopped at a refusal is told
// to go on.
const acpRefusalTurns = 4

const acpAfterRefusal = "In this run you may change files in the project directory only, and no .env file, and run only the commands your task names. Do not try another way to do what was refused: go on with the rest of your task, and say in your final report what you left out."

// Error codes of JSON-RPC, and the protocol's for a missing sign-in.
const (
	acpMethodNotFound = -32601
	acpInvalidParams  = -32602
	acpAuthRequired   = -32000
)

// acpError is an error one side answers a request with.
type acpError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *acpError) Error() string {
	message := strings.TrimSpace(e.Message)
	var detail string
	var details struct {
		Details string `json:"details"`
		Message string `json:"message"`
	}
	if json.Unmarshal(e.Data, &detail) != nil && json.Unmarshal(e.Data, &details) == nil {
		detail = details.Details + details.Message
	}
	if detail = strings.TrimSpace(detail); detail != "" && !strings.Contains(message, detail) {
		message = strings.TrimSuffix(message, ".") + ": " + detail
	}
	return message
}

// errACPClosed is a request the agent never answered, because it ended.
var errACPClosed = errors.New("it ended without an answer")

// acpConn is a JSON-RPC connection over the agent's input and output, one
// message a line.
type acpConn struct {
	log io.Writer

	writing sync.Mutex
	out     io.Writer

	mu      sync.Mutex
	next    int
	waiting map[int]chan acpAnswer
	closed  bool
}

type acpAnswer struct {
	result json.RawMessage
	err    error
}

type acpMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  any             `json:"params,omitempty"`
	Result  any             `json:"result,omitempty"`
	Error   *acpError       `json:"error,omitempty"`
}

func newACPConn(out io.Writer, log io.Writer) *acpConn {
	return &acpConn{out: out, log: log, waiting: map[int]chan acpAnswer{}}
}

func (c *acpConn) send(message acpMessage) error {
	message.JSONRPC = "2.0"
	line, err := json.Marshal(message)
	if err != nil {
		return err
	}
	c.writing.Lock()
	defer c.writing.Unlock()
	_, err = c.out.Write(append(line, '\n'))
	return err
}

// call sends a request and waits for its answer, which is decoded into
// result unless that is nil.
func (c *acpConn) call(ctx context.Context, method string, params, result any) error {
	answer := make(chan acpAnswer, 1)
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return errACPClosed
	}
	c.next++
	id := c.next
	c.waiting[id] = answer
	c.mu.Unlock()

	rawID, _ := json.Marshal(id)
	if err := c.send(acpMessage{ID: rawID, Method: method, Params: params}); err != nil {
		c.mu.Lock()
		delete(c.waiting, id)
		c.mu.Unlock()
		return errACPClosed
	}
	select {
	case got := <-answer:
		if got.err != nil || result == nil {
			return got.err
		}
		return json.Unmarshal(got.result, result)
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.waiting, id)
		c.mu.Unlock()
		return ctx.Err()
	}
}

// notify sends a message that takes no answer.
func (c *acpConn) notify(method string, params any) {
	_ = c.send(acpMessage{Method: method, Params: params})
}

// serve reads the agent's messages until its output ends: answers go to
// the calls that wait for them, requests and notifications to the handlers.
func (c *acpConn) serve(in io.Reader, request func(string, json.RawMessage) (any, *acpError), notification func(string, json.RawMessage)) {
	writer, done := lines(c.log, func(line []byte) {
		var message struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
			Result json.RawMessage `json:"result"`
			Error  *acpError       `json:"error"`
		}
		// Anything that is not a message is the agent talking to nobody.
		if json.Unmarshal(line, &message) != nil {
			return
		}
		hasID := len(message.ID) > 0 && string(message.ID) != "null"
		switch {
		case message.Method != "" && hasID:
			result, refused := request(message.Method, message.Params)
			if refused == nil && result == nil {
				result = map[string]any{}
			}
			_ = c.send(acpMessage{ID: message.ID, Result: result, Error: refused})
		case message.Method != "":
			notification(message.Method, message.Params)
		case hasID:
			var id int
			if json.Unmarshal(message.ID, &id) != nil {
				return
			}
			c.mu.Lock()
			answer, ok := c.waiting[id]
			delete(c.waiting, id)
			c.mu.Unlock()
			if !ok {
				return
			}
			if message.Error != nil {
				answer <- acpAnswer{err: message.Error}
			} else {
				answer <- acpAnswer{result: message.Result}
			}
		}
	})
	_, _ = io.Copy(writer, in)
	_ = writer.Close()
	<-done
	c.mu.Lock()
	c.closed = true
	for id, answer := range c.waiting {
		answer <- acpAnswer{err: errACPClosed}
		delete(c.waiting, id)
	}
	c.mu.Unlock()
}
