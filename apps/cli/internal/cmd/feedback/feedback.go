// Package feedback holds `voidhash feedback`: a message to the Voidhash team.
package feedback

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// topics are the feedback topics as --topic takes them; the API spells them
// with underscores.
var topics = []string{
	"analytics", "paywalls", "products", "persons", "feature-flags", "experiments",
	"payment-providers", "webhooks", "sdk", "billing", "dashboard", "other",
}

const usage = `voidhash feedback "<message>" --topic <topic>`

// contextProjectID is the project this directory names or is linked to, or
// the default one, without asking; empty when there is none or it cannot be
// told. Feedback is worth sending without it.
func contextProjectID(ctx context.Context, app *cli.App) string {
	session, err := app.Session(ctx)
	if err != nil {
		return ""
	}
	directoryConfig, found, err := app.DirectoryConfig()
	if err != nil {
		return ""
	}
	if found {
		_, project, err := cli.ProjectNamedBy(directoryConfig, session)
		if err != nil {
			return ""
		}
		return project.Id
	}
	settings, err := app.Config()
	if err != nil {
		return ""
	}
	if _, linked, ok := cli.LinkFor(settings.Links, app.Dir); ok {
		return linked
	}
	return settings.DefaultProject
}

// New creates `voidhash feedback [message] [--topic] [--sentiment]`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "feedback",
		Short: "Send feedback to the Voidhash team.",
		Long:  "Send feedback to the Voidhash team, about the project you are in when there is one. Asks for the topic and the message on a terminal.",
		Example: `voidhash feedback
voidhash feedback "Refund events arrive late" --topic webhooks
voidhash feedback "Love the new charts" --topic analytics --sentiment 4`,
	}
	cli.SetArgs(cmd, cli.Arg{Name: "message", Help: "What you want the Voidhash team to know", Optional: true})
	topic := cli.AddChoiceFlag(cmd, "topic", "", topics, "", "What it is about")
	sentiment := cmd.Flags().Int("sentiment", 0, "How you feel, from 1 (unhappy) to 4 (delighted)")
	asJSON := cli.AddJSONFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		hasSentiment := cli.Changed(cmd, "sentiment")
		if hasSentiment && (*sentiment < 1 || *sentiment > 4) {
			return cli.Usagef("--sentiment is from 1 (unhappy) to 4 (delighted).")
		}
		var passed *string
		if *topic != "" {
			passed = topic
		}
		choices := make([]cli.Choice[string], len(topics))
		for index, name := range topics {
			choices[index] = cli.Choice[string]{Title: name, Value: name}
		}
		chosen, err := cli.RequireChoice(ctx, app, passed, cli.ChoicePrompt[string]{
			What: "--topic", Message: "What is it about?", Usage: usage, Choices: choices,
		})
		if err != nil {
			return err
		}
		message, err := app.RequireText(ctx, cli.ArgAt(args, 0), cli.TextPrompt{
			What: "the message", Message: "Your feedback", Usage: usage,
		})
		if err != nil {
			return err
		}
		// Only what was given is sent: the API takes an absent field, not a null one.
		body := map[string]any{"topic": strings.ReplaceAll(chosen, "-", "_"), "message": message}
		if hasSentiment {
			body["sentiment"] = *sentiment
		}
		if projectID := contextProjectID(ctx, app); projectID != "" {
			body["projectId"] = projectID
		}
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		sent, err := cli.Fetch[api.FeedbackJsonEncoding](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.FeedbackCreateWithBody(ctx, "application/json", bytes.NewReader(encoded))
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(sent)
		}
		app.Println("Thanks! The Voidhash team reads every message.")
		return nil
	}
	return cmd
}
