package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

// `voidhash push config`: the push services a project sends through. Their
// credentials are read from files and sent to the API; nothing here prints
// them, and the API never returns them.

func newConfig(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "The push services the project sends through (APNs, FCM): list, set up, turn on or off, delete.",
	}
	set := &cobra.Command{
		Use:   "set",
		Short: "Set up a push service with its credentials, and turn it on.",
	}
	set.AddCommand(newSetApns(app), newSetFcm(app))
	cmd.AddCommand(newConfigList(app), set, newToggle(app, true), newToggle(app, false), newConfigDelete(app))
	return cmd
}

func newConfigList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the push services the project sends through.",
		Example: "voidhash push config list",
	}
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		configurations, err := listConfigurations(ctx, app, target.Project.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(configurations)
		case cli.Quiet:
			app.PrintIDs(configurations)
			return nil
		}
		cli.PrintTable(app, []cli.Column[configuration]{
			{Header: "SERVICE", Cell: func(c configuration) string { return serviceLabel(c.Type) }},
			// What a configuration says about its credentials, without showing them.
			{Header: "STATUS", Cell: func(c configuration) string {
				status := "off"
				if c.IsEnabled {
					status = "on"
				}
				if c.Key == nil {
					return status + ", not set up yet"
				}
				return status + ", for " + *c.Key
			}},
			{Header: "ID", Cell: func(c configuration) string { return c.Id }},
		}, configurations.Items, "No push service is set up. "+setHint)
		return nil
	}
	return cmd
}

// saveConfiguration saves settings for the project's configuration of a
// service, creating it when missing, and turns it on; the API checks the
// credentials when it does.
func saveConfiguration(ctx context.Context, app *cli.App, projectID string, service api.PushNotificationProviderType, settings map[string]any) (cli.Object[configuration], error) {
	var none cli.Object[configuration]
	configurations, err := listConfigurations(ctx, app, projectID)
	if err != nil {
		return none, err
	}
	id := ""
	for _, one := range configurations.Items {
		if one.Type == service {
			id = one.Id
			break
		}
	}
	if id == "" {
		created, err := cli.Fetch[configuration](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PushNotificationConfigurationsCreate(ctx, projectID, api.CreatePushNotificationConfigurationBodyJsonEncoding{Type: service})
		})
		if err != nil {
			return none, err
		}
		id = created.Value.Id
	}
	body, err := json.Marshal(map[string]any{"isEnabled": true, "configuration": settings})
	if err != nil {
		return none, err
	}
	saved, err := cli.Fetch[configuration](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PushNotificationConfigurationsUpdateWithBody(ctx, projectID, id, "application/json", bytes.NewReader(body))
	})
	return saved, cli.APIError(err, map[string]string{
		"invalid_push_notification_configuration":   "Check the values and files you passed; nothing was turned on.",
		"push_notification_configuration_key_taken": "Another push configuration of this project uses these credentials.",
	})
}

// readCredentials reads a credentials file a flag names. A relative file is
// read from the directory the command runs in.
func readCredentials(app *cli.App, file, flag string) (string, error) {
	path := file
	if !filepath.IsAbs(path) {
		path = filepath.Join(app.Dir, path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", cli.Usagef("Could not read %s (%s).", file, flag)
	}
	return string(data), nil
}

const testHint = "Send a test with 'voidhash push send --to <your distinct id> --title Test --body Hello'."

func newSetApns(app *cli.App) *cobra.Command {
	const usage = "voidhash push config set apns --team-id <id> --key-id <id> --key-file <AuthKey.p8> --bundle-id <bundle id>"
	cmd := &cobra.Command{
		Use:     "apns",
		Short:   "Send to iOS devices through APNs with your authentication key.",
		Long:    "Send to iOS devices through APNs with your authentication key, and turn the service on. The key is read from the .p8 file and stored by Voidhash; it is never printed. Asks for what is missing on a terminal.",
		Example: "voidhash push config set apns --team-id ABCDE12345 --key-id XYZ987 --key-file AuthKey_XYZ987.p8 --bundle-id com.example.app",
	}
	teamID := cmd.Flags().String("team-id", "", "Your Apple Developer team `id`, 10 characters")
	keyID := cmd.Flags().String("key-id", "", "The `id` of your APNs authentication key")
	keyFile := cmd.Flags().String("key-file", "", "The .p8 key `file` Apple gave you")
	bundleID := cmd.Flags().String("bundle-id", "", "Your app's bundle `id`, such as com.example.app")
	environment := cli.AddChoiceFlag(cmd, "environment", "", []string{"production", "sandbox"}, "production",
		"The APNs servers to use: production for App Store and TestFlight builds, sandbox for Xcode builds")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		ask := func(value, what, message string) (string, error) {
			return app.RequireText(ctx, value, cli.TextPrompt{What: what, Message: message, Usage: usage})
		}
		team, err := ask(*teamID, "--team-id", "Team id")
		if err != nil {
			return err
		}
		key, err := ask(*keyID, "--key-id", "Key id")
		if err != nil {
			return err
		}
		file, err := ask(*keyFile, "--key-file", ".p8 key file")
		if err != nil {
			return err
		}
		bundle, err := ask(*bundleID, "--bundle-id", "Bundle id")
		if err != nil {
			return err
		}
		privateKey, err := readCredentials(app, file, "--key-file")
		if err != nil {
			return err
		}
		saved, err := saveConfiguration(ctx, app, target.Project.Id, api.PushNotificationProviderTypeApns, map[string]any{
			"teamId": team, "keyId": key, "privateKeyContent": privateKey, "bundleId": bundle, "environment": *environment,
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, saved, fmt.Sprintf("Push through APNs is on for %s (%s). %s", bundle, *environment, testHint))
	}
	return cmd
}

func newSetFcm(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "fcm",
		Short:   "Send to Android (and iOS) devices through Firebase Cloud Messaging.",
		Long:    "Send to Android (and iOS) devices through Firebase Cloud Messaging, and turn the service on. The service account key is read from the JSON file and stored by Voidhash; it is never printed.",
		Example: "voidhash push config set fcm --service-account-file service-account.json",
	}
	serviceAccountFile := cmd.Flags().String("service-account-file", "", "The Firebase service account key, a JSON `file`")
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		file, err := app.RequireText(ctx, *serviceAccountFile, cli.TextPrompt{
			What: "--service-account-file", Message: "Service account JSON file",
			Usage: "voidhash push config set fcm --service-account-file <file.json>",
		})
		if err != nil {
			return err
		}
		serviceAccountJSON, err := readCredentials(app, file, "--service-account-file")
		if err != nil {
			return err
		}
		var account struct {
			ProjectID *string `json:"project_id"`
		}
		if err := json.Unmarshal([]byte(serviceAccountJSON), &account); err != nil || account.ProjectID == nil {
			return cli.Usagef("%s is not a Firebase service account key.", file).
				WithHint("Download one under Project settings → Service accounts in the Firebase console.")
		}
		saved, err := saveConfiguration(ctx, app, target.Project.Id, api.PushNotificationProviderTypeFcm, map[string]any{
			"projectId": *account.ProjectID, "serviceAccountJson": serviceAccountJSON,
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, saved, fmt.Sprintf("Push through Firebase Cloud Messaging is on for %s. %s", *account.ProjectID, testHint))
	}
	return cmd
}

var serviceArg = cli.Arg{Name: "service", Help: "apns or fcm", Optional: true}

func completeServices(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
	return []string{"apns", "fcm"}, cobra.ShellCompDirectiveNoFileComp
}

// requireConfiguration returns the project's configuration of the service
// an argument names, asked for on a terminal.
func requireConfiguration(ctx context.Context, app *cli.App, projectID, input, usage string) (cli.Object[configuration], error) {
	var none cli.Object[configuration]
	var passed *api.PushNotificationProviderType
	switch service := api.PushNotificationProviderType(input); service {
	case "":
	case api.PushNotificationProviderTypeApns, api.PushNotificationProviderTypeFcm:
		passed = &service
	default:
		return none, cli.Usagef("%q is not a push service; it is apns or fcm.", input).WithHint("Run it as: " + usage)
	}
	service, err := cli.RequireChoice(ctx, app, passed, cli.ChoicePrompt[api.PushNotificationProviderType]{
		What: "the service", Message: "Which push service?", Usage: usage,
		Choices: []cli.Choice[api.PushNotificationProviderType]{
			{Title: "apns", Value: api.PushNotificationProviderTypeApns},
			{Title: "fcm", Value: api.PushNotificationProviderTypeFcm},
		},
	})
	if err != nil {
		return none, err
	}
	configurations, err := listConfigurations(ctx, app, projectID)
	if err != nil {
		return none, err
	}
	for index, one := range configurations.Items {
		if one.Type == service {
			return configurations.Object(index), nil
		}
	}
	return none, &cli.UserError{
		Message:  serviceLabel(service) + " is not set up in this project.",
		Hint:     fmt.Sprintf("Set it up with 'voidhash push config set %s ...'.", service),
		ExitCode: cli.ExitNotFound,
	}
}

func newToggle(app *cli.App, enabling bool) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "disable",
		Short:   "Stop sending through a push service, keeping its credentials.",
		Example: "voidhash push config disable fcm",
	}
	if enabling {
		cmd.Use, cmd.Short, cmd.Example = "enable", "Turn a push service back on with its saved credentials.", "voidhash push config enable apns"
	}
	usage := "voidhash push config " + cmd.Use + " <apns|fcm>"
	cli.SetArgs(cmd, serviceArg)
	cmd.ValidArgsFunction = completeServices
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		found, err := requireConfiguration(ctx, app, target.Project.Id, cli.ArgAt(args, 0), usage)
		if err != nil {
			return err
		}
		body, err := json.Marshal(map[string]any{"isEnabled": enabling})
		if err != nil {
			return err
		}
		updated, err := cli.Fetch[configuration](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PushNotificationConfigurationsUpdateWithBody(ctx, target.Project.Id, found.Value.Id, "application/json", bytes.NewReader(body))
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"invalid_push_notification_configuration": fmt.Sprintf("Its settings are incomplete; save them with 'voidhash push config set %s ...'.", found.Value.Type),
			})
		}
		human := serviceLabel(found.Value.Type) + " is off; push notifications skip its devices. Its credentials are kept."
		if enabling {
			human = serviceLabel(found.Value.Type) + " is on; push notifications reach its devices."
		}
		return app.PrintItem(mode, updated, human)
	}
	return cmd
}

func newConfigDelete(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "delete",
		Short:   "Delete a push service's credentials.",
		Long:    "Delete a push service's credentials. Push notifications skip its devices until it is set up again. Asks first; --yes skips that.",
		Example: "voidhash push config delete fcm\nvoidhash push config delete fcm --yes",
	}
	cli.SetArgs(cmd, serviceArg)
	cmd.ValidArgsFunction = completeServices
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		found, err := requireConfiguration(ctx, app, target.Project.Id, cli.ArgAt(args, 0), "voidhash push config delete <apns|fcm> --yes")
		if err != nil {
			return err
		}
		label := serviceLabel(found.Value.Type)
		if err := app.ConfirmChange(ctx, *yes, fmt.Sprintf("Delete the %s credentials of %s? Push notifications skip its devices until it is set up again.", label, target.Label())); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PushNotificationConfigurationsDelete(ctx, target.Project.Id, found.Value.Id)
		}); err != nil {
			return err
		}
		return app.PrintItem(mode, found, fmt.Sprintf("Deleted the %s configuration.", label))
	}
	return cmd
}
