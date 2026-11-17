package home

// What the screen reads and shows. The Go side fills these in; the screen,
// a separate program, receives them as JSON.

// Situation is where the CLI is when the screen opens.
type Situation struct {
	// Directory is the working directory's name.
	Directory string `json:"directory"`
	// App is the kind of app found in the directory, such as "Expo"; empty
	// when the directory holds no app the CLI can set up.
	App string `json:"app"`
	// Details are what else was found, such as the package manager.
	Details []string `json:"details"`
	// CleanGit is false when git shows uncommitted changes, or the directory
	// is not in a repository.
	CleanGit bool `json:"cleanGit"`

	// Server is the API server's origin.
	Server string `json:"server"`
	// SignedIn is false when nobody is, and Person is then empty.
	SignedIn bool   `json:"signedIn"`
	Person   string `json:"person"`
	// ReadOnly is true for a sign-in that may not change anything.
	ReadOnly bool `json:"readOnly"`

	Organizations []Organization `json:"organizations"`
	Projects      []Project      `json:"projects"`
	// Project is the directory's project, or nil when it has none.
	Project *Project `json:"project"`
	// Interrupted is true when an earlier setup here did not finish.
	Interrupted bool `json:"interrupted"`
	// Agents are the coding agents installed on this computer.
	Agents []Agent `json:"agents"`
}

// Organization owns projects.
type Organization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// Project is a Voidhash project the person can use.
type Project struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
	// Organization is the slug of the organization that owns it.
	Organization string `json:"organization"`
}

// Path is the project as people name it: acme/app.
func (p Project) Path() string {
	if p.Organization == "" {
		return p.Slug
	}
	return p.Organization + "/" + p.Slug
}

// Agent is a coding agent that can wire the SDK into the app's code.
type Agent struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// ModelHint says how a model is named for it; empty when a setup
	// cannot choose its model.
	ModelHint string `json:"modelHint"`
}

// SignIn is a sign-in waiting to be approved in the browser.
type SignIn struct {
	// Code is what the person checks against the page.
	Code string `json:"code"`
	// Address is the page that shows the code.
	Address string `json:"address"`
	// Opened is true when the browser was opened at it.
	Opened bool `json:"opened"`
	// Handle names the sign-in to the call that waits for it.
	Handle string `json:"handle"`
}

// IntegrateOptions are the choices of a setup.
type IntegrateOptions struct {
	ProjectID string `json:"projectId"`
	// Agent is the agent's id, or empty to write the task for the person.
	Agent string `json:"agent"`
	// Model is the model the agent works with; empty for the one it is
	// set up with.
	Model string `json:"model"`
	// MCP also adds the Voidhash MCP server to the person's agents.
	MCP bool `json:"mcp"`
	// AllowDirty runs although git shows uncommitted changes.
	AllowDirty bool `json:"allowDirty"`
}

// The states of a [Check].
const (
	StateOK        = "ok"
	StateAttention = "attention"
	StateProblem   = "problem"
	StateUnknown   = "unknown"
)

// Check is one part of a project's setup.
type Check struct {
	Name    string `json:"name"`
	State   string `json:"state"`
	Summary string `json:"summary"`
}

// Checks are a project's setup, with what to do first about it; Next is
// empty when everything is set up.
type Checks struct {
	Items []Check `json:"items"`
	Next  string  `json:"next"`
}

// Event is one event an app sent.
type Event struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Person     string `json:"person"`
	Source     string `json:"source"`
	ReceivedAt string `json:"receivedAt"`
}

// Key is an API key. Value is the whole key for a publishable one, and its
// two ends for a secret one.
type Key struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Environment string `json:"environment"`
	Value       string `json:"value"`
	// Copyable is true when Value is the whole key.
	Copyable bool `json:"copyable"`
}

// Perk is access the app checks for, with the products that grant it.
type Perk struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Slug      string   `json:"slug"`
	GrantedBy []string `json:"grantedBy"`
}

// Location is a place in the app that shows a paywall.
type Location struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
	// Shows is what it shows now; empty when it shows nothing.
	Shows string `json:"shows"`
}

// Webhook is a backend URL the project's events are sent to.
type Webhook struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	Environment string `json:"environment"`
	// Health is how it is doing, in a few words.
	Health string `json:"health"`
	// Failing is true when deliveries are failing or it is turned off.
	Failing bool `json:"failing"`
}

// Failure is an error with what to do about it, both shown to the person.
type Failure struct {
	Message string `json:"message"`
	Hint    string `json:"hint,omitempty"`
}

func (f *Failure) Error() string { return f.Message }

// Command is a command of the CLI, as the command search lists it.
type Command struct {
	// Args is how it is run: "paywall", "deploy".
	Args  []string `json:"args"`
	Short string   `json:"short"`
}
