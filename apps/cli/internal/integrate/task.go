package integrate

import (
	"encoding/json"
	"path"
	"strings"
	"text/template"
)

// DefaultAPIURL is the API the SDKs reach without a base URL option.
const DefaultAPIURL = "https://api.voidhash.com"

// Facts are what a run knows about the project and the app, which the
// platform descriptions' templates and the agent's task are written from.
type Facts struct {
	Platform Platform
	// ProjectName, Team and Project name the Voidhash project.
	ProjectName, Team, Project string
	// TestKey and ProductionKey are the publishable keys; empty for a
	// platform that starts with a secret key.
	TestKey, ProductionKey string
	// APIURL is the API server; CustomAPI is true when it is not the default.
	APIURL    string
	CustomAPI bool
	// Perks, Products and Locations are the project's slugs.
	Perks, Products, Locations []string
	// Perk, Product and Location are the ones the app is wired to; empty
	// when the project has none to wire.
	Perk, Product, Location string
	// SourceDir is "src/" or "", and ScriptExt "ts" or "js".
	SourceDir, ScriptExt string
	TypeScript           bool
	PackageManager       string
	// ClientFile is the SDK client module the CLI wrote, when the platform
	// has one.
	ClientFile string
	// TypesFiles are the generated type files.
	TypesFiles []string
	// EnvFile is the environment file, and EnvNames the variables the
	// platform declares, in the description's order.
	EnvFile  string
	EnvNames []string
	// Done lists, as sentences, what the CLI did before the agent starts.
	Done []string
	// Checks are the commands the agent runs to check its work, and
	// BaselineFailed those that failed before anything changed.
	Checks, BaselineFailed []string
	// ToldSeparately is what the summary tells the person anyway, which the
	// agent's report need not repeat.
	ToldSeparately []string
	// Guide is the platform's rendered steps, set by [Task].
	Guide string
}

// Capabilities words what the SDK gives the app on this platform.
func (f Facts) Capabilities() string {
	words := map[string]string{
		"identify":  "user identity",
		"perks":     "access checks",
		"purchases": "in-app purchases",
		"paywalls":  "paywalls",
		"events":    "analytics events",
		"flags":     "feature flags",
		"webhooks":  "webhooks",
	}
	var parts []string
	for _, capability := range f.Platform.Capabilities {
		if word, ok := words[capability]; ok {
			parts = append(parts, word)
		}
	}
	if len(parts) < 2 {
		return strings.Join(parts, "")
	}
	return strings.Join(parts[:len(parts)-1], ", ") + " and " + parts[len(parts)-1]
}

var templateFuncs = template.FuncMap{
	// list writes slugs as code, or says there are none.
	"list": func(items []string) string {
		if len(items) == 0 {
			return "none yet"
		}
		return codeList(items)
	},
	"codeList": codeList,
}

func codeList(items []string) string {
	quoted := make([]string, len(items))
	for index, item := range items {
		quoted[index] = "`" + item + "`"
	}
	return strings.Join(quoted, ", ")
}

// Render fills a template of a platform description. The delimiters are
// [[ and ]], which leaves the braces of the code in a template alone.
func Render(name, text string, facts Facts) (string, error) {
	parsed, err := template.New(name).Delims("[[", "]]").Funcs(templateFuncs).Option("missingkey=error").Parse(text)
	if err != nil {
		return "", err
	}
	var out strings.Builder
	if err := parsed.Execute(&out, facts); err != nil {
		return "", err
	}
	return out.String(), nil
}

// Task is the whole brief a coding agent, or a person, gets: the project,
// what is done, the platform's steps, the rules and how to report.
func Task(facts Facts) (string, error) {
	read := func(name string) (string, error) {
		data, err := platformFiles.ReadFile(path.Join("platforms", name))
		return string(data), err
	}
	guide, err := read(facts.Platform.Guide)
	if err != nil {
		return "", err
	}
	if facts.Guide, err = Render(facts.Platform.Guide, guide, facts); err != nil {
		return "", err
	}
	facts.Guide = strings.TrimSpace(facts.Guide)
	frame, err := read("task.md")
	if err != nil {
		return "", err
	}
	return Render("task.md", frame, facts)
}

// FixTask asks the agent that did the work to repair what a check found.
func FixTask(command, output string) string {
	return "The project's check `" + command + "` fails after your changes. Fix what your changes broke, changing nothing else, " +
		"and run the check again until it passes. The same rules apply. End with a new `voidhash-report` block that covers all of your work, not only this fix.\n\n" +
		"Output of the check:\n\n```\n" + tail(output, 6000) + "\n```\n"
}

// ContinueTask asks the agent to pick up a run that was cut short.
const ContinueTask = "Your previous run on this task was interrupted. Look at what is already changed (`git status`, `git diff`), " +
	"finish the remaining steps under the same rules, and end with the `voidhash-report` block covering all of the work."

// tail is the end of text, at most limit bytes, cut at a line.
func tail(text string, limit int) string {
	text = strings.TrimSpace(text)
	if len(text) <= limit {
		return text
	}
	text = text[len(text)-limit:]
	if _, rest, found := strings.Cut(text, "\n"); found {
		return "...\n" + rest
	}
	return text
}

// Report statuses.
const (
	StatusDone    = "done"
	StatusPartial = "partial"
	StatusBlocked = "blocked"
)

// Report is what the agent says it did, in the block its task asks for. It
// is the agent's account; the files that changed are read from git.
type Report struct {
	Status     string   `json:"status"`
	Summary    string   `json:"summary"`
	Changes    []Change `json:"changes"`
	LeftForYou []string `json:"left_for_you"`
	Notes      []string `json:"notes"`
}

// Change is one file the agent says it changed.
type Change struct {
	File string `json:"file"`
	What string `json:"what"`
}

const reportFence = "```voidhash-report"

// ParseReport reads the last report block of the agent's final message.
// ok is false when there is none, or it is not the JSON asked for.
func ParseReport(message string) (report Report, ok bool) {
	start := strings.LastIndex(message, reportFence)
	if start < 0 {
		return report, false
	}
	body := message[start+len(reportFence):]
	end := strings.Index(body, "```")
	if end < 0 {
		return report, false
	}
	if err := json.Unmarshal([]byte(body[:end]), &report); err != nil {
		return Report{}, false
	}
	switch report.Status {
	case StatusDone, StatusPartial, StatusBlocked:
		return report, true
	}
	return Report{}, false
}
