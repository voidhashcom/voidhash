// Package api holds `voidhash api`: every operation of the Voidhash API,
// found, described and called by its id.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
)

// New creates `voidhash api`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "api",
		Short: "Find, describe and call any operation of the Voidhash API.",
		Long: `Find, describe and call any operation of the Voidhash API: everything the dashboard can do except paywall design. Use it in scripts, and for what has no command of its own yet.

The operations are read from the server the CLI talks to, so they are always the ones that server has.`,
		Example: `voidhash api list webhooks
voidhash api describe webhooks.create
voidhash api call webhooks.list --query limit=5`,
	}
	cmd.AddCommand(newList(app), newDescribe(app), newCall(app))
	return cmd
}

var operationArg = cli.Arg{Name: "operation", Help: "The operation's id from 'voidhash api list', such as webhooks.list"}

// loadCatalog reads the API's operations from the OpenAPI document of the
// server the CLI talks to.
func loadCatalog(ctx context.Context, app *cli.App) (*catalog, config.Settings, error) {
	settings, err := app.Config()
	if err != nil {
		return nil, settings, err
	}
	address, err := resolve(settings.APIURL, "/api/openapi.json")
	if err != nil {
		return nil, settings, cli.Failf("The api_url %s is not a valid URL.", settings.APIURL).WithHint("Set it with 'voidhash config set api_url <url>'.")
	}
	unreadable := func(why string, cause error) error {
		return &cli.UserError{
			Message: fmt.Sprintf("Could not read the API's description from %s: %s.", address, why),
			Hint:    "Check your connection, or the api_url 'voidhash config' shows.",
			Cause:   cause,
		}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return nil, settings, unreadable("the address is not valid", err)
	}
	response, err := app.HTTPClient().Do(request)
	if err != nil {
		if ctx.Err() != nil {
			return nil, settings, ctx.Err()
		}
		return nil, settings, unreadable("the server could not be reached", err)
	}
	defer response.Body.Close()
	document, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, settings, unreadable("the answer broke off", err)
	}
	if response.StatusCode != http.StatusOK {
		return nil, settings, unreadable(fmt.Sprintf("the server answered HTTP %d", response.StatusCode), nil)
	}
	read, err := readCatalog(document)
	if err != nil {
		return nil, settings, unreadable(err.Error(), err)
	}
	return read, settings, nil
}

// resolve is the address of path on the server of apiURL.
func resolve(apiURL, path string) (string, error) {
	base, err := url.Parse(apiURL)
	if err != nil || base.Host == "" {
		return "", fmt.Errorf("not a URL: %s", apiURL)
	}
	relative, err := url.Parse(path)
	if err != nil {
		return "", err
	}
	return base.ResolveReference(relative).String(), nil
}

func findOperation(read *catalog, id string) (operation, error) {
	found, ok := read.find(id)
	if !ok {
		return found, &cli.UserError{
			Message:  fmt.Sprintf("There is no operation %q.", id),
			Hint:     "'voidhash api list' shows them; 'voidhash api list <words>' searches.",
			ExitCode: cli.ExitNotFound,
		}
	}
	return found, nil
}

// newList creates `voidhash api list [search...]`.
func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List the operations of the Voidhash API.",
		Long:  "List the operations of the Voidhash API, or those whose id, path or description holds every word you pass.",
		Example: `voidhash api list
voidhash api list webhooks
voidhash api list person erase --json`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "search", Help: "Words that must all appear in the operation's id, path or description", Optional: true, Variadic: true})
	asJSON := cli.AddJSONFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		read, _, err := loadCatalog(cmd.Context(), app)
		if err != nil {
			return err
		}
		matches := read.search(args)
		if *asJSON {
			type row struct {
				Operation string `json:"operation"`
				Method    string `json:"method"`
				Path      string `json:"path"`
				Summary   string `json:"summary"`
			}
			rows := make([]row, len(matches))
			for index, match := range matches {
				rows[index] = row{Operation: match.id, Method: match.method, Path: match.path, Summary: match.line()}
			}
			return app.PrintJSON(rows)
		}
		if len(matches) == 0 {
			app.Println("No operation matches.")
			app.Notef("'voidhash api list' shows them all.")
			return nil
		}
		width := 0
		for _, match := range matches {
			width = max(width, len(match.id))
		}
		for _, match := range matches {
			app.Println(cli.Printable(fmt.Sprintf("%-*s  %-6s  %s", width, match.id, match.method, match.path)))
			if summary := match.line(); summary != "" {
				app.Println(strings.Repeat(" ", width+2) + cli.Printable(summary))
			}
		}
		return nil
	}
	return cmd
}

// newDescribe creates `voidhash api describe <operation>`.
func newDescribe(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "describe",
		Short:   "Show an operation's parameters, body and response schemas, and errors.",
		Long:    "Show what an operation takes and answers, as JSON: its path and query parameters, the schemas of its body and response, the errors it can answer, and every schema those refer to.",
		Example: `voidhash api describe webhooks.create`,
	}
	cli.SetArgs(cmd, operationArg)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		read, _, err := loadCatalog(cmd.Context(), app)
		if err != nil {
			return err
		}
		described, err := findOperation(read, args[0])
		if err != nil {
			return err
		}
		return app.PrintJSON(read.describe(described))
	}
	return cmd
}

// readBody is a JSON body given inline, or as @path to a file.
func readBody(app *cli.App, body string) ([]byte, error) {
	content := []byte(body)
	if file, ok := strings.CutPrefix(body, "@"); ok {
		path := file
		if !filepath.IsAbs(path) {
			path = filepath.Join(app.Dir, path)
		}
		read, err := os.ReadFile(path)
		if err != nil {
			return nil, cli.Usagef("Could not read the body file %s.", file)
		}
		content = read
	}
	if !json.Valid(content) {
		return nil, cli.Usagef("--body is not valid JSON.").WithHint(`Pass it in single quotes, such as --body '{"name": "Orders"}', or as --body @file.json.`)
	}
	return content, nil
}

// newCall creates `voidhash api call <operation>`.
func newCall(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "call",
		Short: "Call an operation of the Voidhash API as yourself and print its JSON response.",
		Long: `Call an operation of the Voidhash API as yourself and print its JSON response.

An operation of a project is called on the project commands act on here ('voidhash status' shows which), on --project, or on the one --path projectId=<id> names. An answer of 400 or above ends the command with the exit code of its status: 2 for 400, 3 for 401, 4 for 404, else 1.`,
		Example: `voidhash api call webhooks.list --query limit=5
voidhash api call webhooks.get --path webhookId=wh_123
voidhash api call webhooks.create --body '{"name": "Orders", "url": "https://example.com/hook"}'
voidhash api call products.create --body @product.json --project acme/app`,
	}
	cli.SetArgs(cmd, operationArg)
	pathFlags := cli.AddStringsFlag(cmd, "path", "", "A path parameter as `name=value`")
	queryFlags := cli.AddStringsFlag(cmd, "query", "", "A query parameter as `name=value`; a repeated name is a list")
	body := cmd.Flags().String("body", "", "The request body as `json`, inline or as @file.json")
	project := cli.AddProjectFlag(cmd)
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "test", "all"}, "",
		"Purchases the call sees: production (the default; production purchases, and store sandbox ones when they unlock production), test (store sandbox and test purchases, as a test key reads) or all")

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		pathParameters, err := parseAssignments("path", *pathFlags)
		if err != nil {
			return cli.Usagef("%s.", err)
		}
		query, err := parseAssignments("query", *queryFlags)
		if err != nil {
			return cli.Usagef("%s.", err)
		}
		var payload []byte
		if cli.Changed(cmd, "body") {
			if payload, err = readBody(app, *body); err != nil {
				return err
			}
		}
		read, settings, err := loadCatalog(ctx, app)
		if err != nil {
			return err
		}
		called, err := findOperation(read, args[0])
		if err != nil {
			return err
		}
		credential, err := app.Credentials(ctx).Resolve(ctx, settings.APIURL)
		if err != nil {
			return &cli.UserError{Message: err.Error() + "."}
		}
		if credential == nil {
			return &cli.UserError{
				Message:  fmt.Sprintf("You are not signed in on %s.", app.APIOrigin(settings)),
				Hint:     "Run 'voidhash login' first.",
				ExitCode: cli.ExitUnauthenticated,
			}
		}
		projectID := ""
		namesProject := false
		for _, parameter := range pathParameters {
			namesProject = namesProject || parameter.name == "projectId"
		}
		if called.isProjectScoped() && !namesProject {
			target, err := app.ResolveProject(ctx, *project)
			if err != nil {
				return err
			}
			projectID = target.Project.Id
		}
		relative, err := requestURL(called, pathParameters, query, projectID)
		if err != nil {
			return cli.Usagef("%s.", err).WithHint(fmt.Sprintf("Pass each as --path name=value; 'voidhash api describe %s' shows them.", called.id))
		}
		address, err := resolve(settings.APIURL, relative)
		if err != nil {
			return cli.Failf("The api_url %s is not a valid URL.", settings.APIURL)
		}

		var content io.Reader
		if payload != nil {
			content = bytes.NewReader(payload)
		}
		request, err := http.NewRequestWithContext(ctx, called.method, address, content)
		if err != nil {
			return cli.Failf("Could not build the request to %s.", address)
		}
		request.Header.Set("Authorization", "Bearer "+credential.Token)
		request.Header.Set("User-Agent", "voidhash-cli/"+app.Version)
		if payload != nil {
			request.Header.Set("Content-Type", "application/json")
		}
		if *environment != "" {
			request.Header.Set("x-environment", *environment)
		}
		response, err := app.HTTPClient().Do(request)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return &cli.UserError{
				Message: fmt.Sprintf("Could not reach %s.", app.APIOrigin(settings)),
				Hint:    "Check your connection, or the api_url 'voidhash config' shows.",
				Cause:   err,
			}
		}
		defer response.Body.Close()
		answer, err := io.ReadAll(response.Body)
		if err != nil {
			return &cli.UserError{Message: "Could not read the API's response.", Cause: err}
		}
		// JSON prints indented; anything else, such as a proxy's error
		// page, as it came.
		output := strings.TrimRight(string(answer), "\n")
		var indented bytes.Buffer
		if json.Indent(&indented, answer, "", "  ") == nil {
			output = indented.String()
		}
		if response.StatusCode >= 400 {
			return &cli.UserError{
				Message:  strings.TrimSpace(fmt.Sprintf("HTTP %d\n%s", response.StatusCode, output)),
				ExitCode: cli.ExitCodeForStatus(response.StatusCode),
			}
		}
		if output != "" {
			app.Println(output)
		}
		return nil
	}
	return cmd
}
