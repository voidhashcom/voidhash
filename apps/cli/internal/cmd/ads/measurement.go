package ads

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	reports "github.com/voidhashcom/voidhash/apps/cli/internal/analytics"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// measurement is how purchases reach Meta's Conversions API. Secrets are
// never read back; only whether they are set.
type measurement struct {
	IsConversionsEnabled     bool    `json:"isConversionsEnabled"`
	ConversionsDatasetID     *string `json:"conversionsDatasetId"`
	HasConversionsToken      bool    `json:"hasConversionsToken"`
	ConversionsTestEventCode *string `json:"conversionsTestEventCode"`
	ConversionsLastSentAt    *string `json:"conversionsLastSentAt"`
	ConversionsLastRunAt     *string `json:"conversionsLastRunAt"`
	ConversionsLastError     *string `json:"conversionsLastError"`
	ConversionsLastErrorKind *string `json:"conversionsLastErrorKind"`
	ConversionsRefusedInARow int     `json:"conversionsRefusedInARow"`
	ConversionsSkippedTotal  int     `json:"conversionsSkippedTotal"`
	ConversionsWithheld      struct {
		NoAdDataSharing int `json:"noAdDataSharing"`
		NoMatchKey      int `json:"noMatchKey"`
		PersonGone      int `json:"personGone"`
		Reversed        int `json:"reversed"`
	} `json:"conversionsWithheld"`
	HasInstallReferrerKey      bool    `json:"hasInstallReferrerKey"`
	InstallReferrerLastError   *string `json:"installReferrerLastError"`
	InstallReferrerLastErrorAt *string `json:"installReferrerLastErrorAt"`
}

// lastErrorNotes say what the last error means for what happens next, by
// its kind.
var lastErrorNotes = map[string]string{
	"event_refused": "the rest went on",
	"internal":      "not about Meta; purchases wait where they are",
	"permanent":     "needs a fix; retrying until then",
	"retryable":     "retrying",
	"unpriced":      "check that your store's server notifications reach Voidhash",
}

func (m measurement) fields(app *cli.App) string {
	onOff := func(on bool, yes, no string) string {
		if on {
			return yes
		}
		return no
	}
	ago := func(at *string) string {
		if at == nil || *at == "" {
			return "never"
		}
		return app.FormatTimeAgo(*at)
	}
	lastError := "none"
	if m.ConversionsLastError != nil {
		kind := ""
		if m.ConversionsLastErrorKind != nil {
			kind = *m.ConversionsLastErrorKind
		}
		note, known := lastErrorNotes[kind]
		switch {
		case kind == "event_refused" && m.ConversionsRefusedInARow > 0:
			note = fmt.Sprintf("%d refused in a row, none taken since", m.ConversionsRefusedInARow)
		case !known:
			note = "see the dashboard"
		}
		lastError = fmt.Sprintf("%s (%s)", *m.ConversionsLastError, note)
	}
	// Why purchases read since Meta last took one were not sent.
	var withheld []string
	for _, reason := range []struct {
		count int
		why   string
	}{
		{m.ConversionsWithheld.NoAdDataSharing, "without $ad_data_sharing"},
		{m.ConversionsWithheld.NoMatchKey, "with nothing to match them by"},
		{m.ConversionsWithheld.PersonGone, "erased"},
		{m.ConversionsWithheld.Reversed, "refunded"},
	} {
		if reason.count != 0 {
			withheld = append(withheld, strconv.Itoa(reason.count)+" "+reason.why)
		}
	}
	notEligible := "none"
	if len(withheld) > 0 {
		notEligible = strings.Join(withheld, ", ")
	}
	referrerError := "none"
	if m.InstallReferrerLastError != nil && *m.InstallReferrerLastError != "" {
		referrerError = fmt.Sprintf("%s (%s); installs from Meta ads are losing their ad", *m.InstallReferrerLastError, ago(m.InstallReferrerLastErrorAt))
	}
	return cli.FormatFields([]cli.Field{
		{Label: "Conversions API", Value: onOff(m.IsConversionsEnabled, "on", "off")},
		{Label: "Dataset", Value: orDash(m.ConversionsDatasetID)},
		{Label: "Access token", Value: onOff(m.HasConversionsToken, "set", "not set")},
		{Label: "Test event code", Value: orDash(m.ConversionsTestEventCode)},
		{Label: "Last sent", Value: ago(m.ConversionsLastSentAt)},
		{Label: "Last run", Value: ago(m.ConversionsLastRunAt)},
		{Label: "Last error", Value: lastError},
		{Label: "Skipped", Value: strconv.Itoa(m.ConversionsSkippedTotal)},
		{Label: "Not eligible", Value: notEligible},
		{Label: "Install referrer key", Value: onOff(m.HasInstallReferrerKey, "set", "not set")},
		{Label: "Referrer key error", Value: referrerError},
	})
}

// newMeasurement creates `voidhash ads measurement`.
func newMeasurement(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "measurement",
		Short: "What Voidhash tells Meta: the Conversions API and the install referrer key.",
		Long:  "Meta's Conversions API and install referrer key: what Voidhash tells Meta, separate from what it reads. Purchases go to Meta only for people whose $ad_data_sharing trait is true.",
	}
	cmd.AddCommand(newMeasurementView(app), newMeasurementEdit(app))
	return cmd
}

func newMeasurementView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "view",
		Short:   "Show how purchases reach Meta's Conversions API, and what keeps them from going.",
		Long:    "Show how purchases reach Meta's Conversions API, what keeps them from going, and whether the install referrer key works. Secrets are never shown, only whether they are set.",
		Example: `voidhash ads measurement view`,
	}
	project := cli.AddProjectFlag(cmd)
	asJSON := cmd.Flags().Bool("json", false, "Print the API object as JSON, for scripts")
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		settings, err := cli.Fetch[measurement](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.MetaMeasurementGetSettings(ctx, target.Project.Id)
		})
		if err != nil {
			return err
		}
		if *asJSON {
			return app.PrintJSON(settings)
		}
		app.Println(settings.Value.fields(app))
		app.Notef("Purchases go to Meta only for people whose $ad_data_sharing trait is true. Change these with 'voidhash ads measurement edit'.")
		return nil
	}
	return cmd
}

const measurementPipeUsage = "voidhash ads measurement edit --%s < file"

func newMeasurementEdit(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "edit",
		Short: "Set how purchases reach Meta's Conversions API, and the install referrer key.",
		Long: `Set how purchases reach Meta's Conversions API, and the install referrer key. Only what you pass changes.

Secrets are asked for without showing them (--token, --install-referrer-key) or piped in (--token-stdin, --install-referrer-key-stdin); they are never passed as a flag's value. Turning conversions on needs a dataset and a token, and asks first; --yes skips that.`,
		Example: `voidhash ads measurement edit --dataset 1234567890 --token
voidhash ads measurement edit --enable
voidhash ads measurement edit --token-stdin < token.txt
voidhash ads measurement edit --test-event-code TEST12345
voidhash ads measurement edit --disable`,
	}
	flags := cmd.Flags()
	enable := flags.Bool("enable", false, "Send purchases from now on (needs a dataset and a token); asks first")
	disable := flags.Bool("disable", false, "Stop sending; purchases made meanwhile are never sent")
	dataset := flags.String("dataset", "", "The dataset `id` from Meta's Events Manager")
	token := flags.Bool("token", false, "Ask, hidden, for the dataset's Conversions API access token")
	tokenStdin := flags.Bool("token-stdin", false, "Read the access token from standard input")
	clearToken := flags.Bool("clear-token", false, "Remove the access token")
	testEventCode := flags.String("test-event-code", "", "The `code` from Meta's Test Events tab; events then only show up there")
	clearTestEventCode := flags.Bool("clear-test-event-code", false, "Stop marking events as tests")
	referrerKey := flags.Bool("install-referrer-key", false, "Ask, hidden, for Meta's install referrer decryption key")
	referrerKeyStdin := flags.Bool("install-referrer-key-stdin", false, "Read the install referrer key from standard input")
	clearReferrerKey := flags.Bool("clear-install-referrer-key", false, "Remove the install referrer key")
	project := cli.AddProjectFlag(cmd)
	asJSON := flags.Bool("json", false, "Print the API object as JSON, for scripts")
	yes := cli.AddYesFlag(cmd)

	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		wantsToken, wantsKey := *token || *tokenStdin, *referrerKey || *referrerKeyStdin
		switch {
		case *enable && *disable:
			return cli.Usagef("--enable and --disable contradict each other.").WithHint("Pass one of them.")
		case *tokenStdin && *referrerKeyStdin:
			return cli.Usagef("Standard input can carry one secret.").WithHint("Run the command once for each, or leave one out to be asked for it.")
		case wantsToken && *clearToken:
			return cli.Usagef("--clear-token cannot be combined with a new token.").WithHint("Pass one of them.")
		case wantsKey && *clearReferrerKey:
			return cli.Usagef("--clear-install-referrer-key cannot be combined with a new key.").WithHint("Pass one of them.")
		case *testEventCode != "" && *clearTestEventCode:
			return cli.Usagef("--clear-test-event-code cannot be combined with --test-event-code.").WithHint("Pass one of them.")
		case !(*enable || *disable || *dataset != "" || *testEventCode != "" || wantsToken || wantsKey || *clearToken || *clearTestEventCode || *clearReferrerKey):
			return cli.Usagef("Nothing to change.").WithHint("See 'voidhash ads measurement edit --help' for what it can set.")
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		// A missing field is left as it is; null removes it.
		body := reports.Body{}
		body.Text("conversionsDatasetId", *dataset).Text("conversionsTestEventCode", *testEventCode)
		if *clearTestEventCode {
			body["conversionsTestEventCode"] = nil
		}
		if wantsToken {
			secret, err := readSecret(ctx, app, *tokenStdin, secretPrompt{
				What:      "Conversions API access token",
				Message:   "The Conversions API access token",
				PipeUsage: fmt.Sprintf(measurementPipeUsage, "token-stdin"),
			})
			if err != nil {
				return err
			}
			body["conversionsToken"] = secret
		} else if *clearToken {
			body["conversionsToken"] = nil
		}
		if wantsKey {
			secret, err := readSecret(ctx, app, *referrerKeyStdin, secretPrompt{
				What:      "Meta install referrer key",
				Message:   "The Meta install referrer key",
				PipeUsage: fmt.Sprintf(measurementPipeUsage, "install-referrer-key-stdin"),
			})
			if err != nil {
				return err
			}
			body["installReferrerKey"] = secret
		} else if *clearReferrerKey {
			body["installReferrerKey"] = nil
		}
		if *enable {
			question := fmt.Sprintf("Send the purchases of people in %s whose $ad_data_sharing trait is true to Meta, from now on?", target.Label())
			if err := app.ConfirmChange(ctx, *yes, question); err != nil {
				return err
			}
			body["isConversionsEnabled"] = true
		} else if *disable {
			body["isConversionsEnabled"] = false
		}
		settings, err := cli.Fetch[measurement](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.MetaMeasurementUpdateSettingsWithBody(ctx, target.Project.Id, reports.ContentType, body.Reader())
		})
		if err != nil {
			return cli.APIError(err, map[string]string{
				"conversions_not_configured":   "Set both with: voidhash ads measurement edit --dataset <id> --token",
				"invalid_dataset_id":           "Pass the number from Meta's Events Manager.",
				"invalid_install_referrer_key": "Paste the 64 hexadecimal characters Meta shows for your app.",
				"invalid_test_event_code":      "Pass the code from Meta's Test Events tab.",
			})
		}
		if *asJSON {
			return app.PrintJSON(settings)
		}
		app.Println(settings.Value.fields(app))
		return nil
	}
	return cmd
}
