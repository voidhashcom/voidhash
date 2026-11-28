package provider

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/catalog"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/libraries/go/api"
)

// storeImportBatch is how many purchases one request adds to a store import.
const storeImportBatch = 1000

// storeImportLimit is how many purchases one import holds.
const storeImportLimit = 100_000

// storeFile is what a store's import file holds: the column naming each
// purchase, the API field it is sent as, and how to check it.
type storeFile struct {
	column, field, noun  string
	pattern              *regexp.Regexp
	minLength, maxLength int
}

var (
	appStoreFile   = storeFile{"transaction_id", "transactionId", "transaction id", regexp.MustCompile(`^[0-9]+$`), 1, 32}
	googlePlayFile = storeFile{"purchase_token", "purchaseToken", "purchase token", regexp.MustCompile(`^[A-Za-z0-9._-]+$`), 8, 2000}
)

// isValid says whether value can name a purchase of the store, as the API checks it.
func (f storeFile) isValid(value string) bool {
	return len(value) >= f.minLength && len(value) <= f.maxLength && f.pattern.MatchString(value)
}

// isStore says whether found is a store whose import takes a file of purchases.
func isStore(found provider) bool {
	return found.Type == "app_store" || found.Type == "google_play"
}

func fileOf(found provider) storeFile {
	if found.Type == "google_play" {
		return googlePlayFile
	}
	return appStoreFile
}

// storeRow is one purchase of an import file.
type storeRow struct{ value, appUserID string }

// storeRows reads path a row at a time: each purchase it names, and each line
// it leaves out with why. It holds no more of the file than a row.
type storeRows struct {
	file    storeFile
	reader  *csv.Reader
	closer  io.Closer
	id, app int
	line    int
}

// inDir is path as given on the command line, from the directory the CLI runs in.
func inDir(app *cli.App, path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(app.Dir, path)
}

func openStoreRows(app *cli.App, path string, file storeFile) (*storeRows, error) {
	handle, err := os.Open(inDir(app, path))
	if err != nil {
		return nil, cli.Usagef("Cannot read %s: %v.", path, errors.Unwrap(err))
	}
	reader := csv.NewReader(handle)
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true
	reader.ReuseRecord = true
	header, err := reader.Read()
	if err != nil {
		handle.Close()
		return nil, cli.Usagef("%s is empty or not a CSV file.", path)
	}
	rows := &storeRows{file: file, reader: reader, closer: handle, id: -1, app: -1, line: 1}
	for index, name := range header {
		switch strings.ToLower(strings.TrimSpace(strings.TrimPrefix(name, "\ufeff"))) {
		case file.column:
			rows.id = index
		case "app_user_id":
			rows.app = index
		}
	}
	if rows.id == -1 {
		handle.Close()
		return nil, cli.Usagef("The first line of %s must name the columns, with one called %q.", path, file.column).
			WithHint(fmt.Sprintf("Write it as '%s,app_user_id', then one purchase per line; app_user_id, your id for the buyer, is optional.", file.column))
	}
	return rows, nil
}

// next is the next purchase, or a line left out (problem set), or io.EOF.
func (r *storeRows) next() (row storeRow, problem string, err error) {
	for {
		record, err := r.reader.Read()
		if err == io.EOF {
			return storeRow{}, "", io.EOF
		}
		// A record that fails to parse has no field positions; the error names its line.
		var parseErr *csv.ParseError
		if errors.As(err, &parseErr) {
			r.line = parseErr.StartLine
			return storeRow{}, fmt.Sprintf("line %d is not valid CSV", r.line), nil
		}
		if err != nil {
			return storeRow{}, "", err
		}
		r.line, _ = r.reader.FieldPos(0)
		cell := func(index int) string {
			if index < 0 || index >= len(record) {
				return ""
			}
			return strings.TrimSpace(record[index])
		}
		value, appUserID := cell(r.id), cell(r.app)
		if value == "" && appUserID == "" && len(strings.Join(record, "")) == 0 {
			continue
		}
		switch {
		case value == "":
			return storeRow{}, fmt.Sprintf("line %d has no %s", r.line, r.file.noun), nil
		case !r.file.isValid(value):
			return storeRow{}, fmt.Sprintf("line %d: %q is not a %s", r.line, truncate(value, 40), r.file.noun), nil
		case len(appUserID) > 255:
			return storeRow{}, fmt.Sprintf("line %d has an app_user_id longer than 255 characters", r.line), nil
		}
		return storeRow{value: value, appUserID: appUserID}, "", nil
	}
}

func truncate(text string, most int) string {
	if len(text) <= most {
		return text
	}
	return text[:most] + "…"
}

// checkStoreFile reads path once: how many purchases it names, and the lines
// it leaves out, so nothing is sent for a file that cannot be imported.
func checkStoreFile(app *cli.App, path string, file storeFile) (count int, problems []string, err error) {
	rows, err := openStoreRows(app, path, file)
	if err != nil {
		return 0, nil, err
	}
	defer rows.closer.Close()
	for {
		_, problem, err := rows.next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, problems, cli.Usagef("Cannot read %s: %v.", path, err)
		}
		if problem != "" {
			problems = append(problems, problem)
			continue
		}
		count++
	}
	if count == 0 {
		return 0, problems, cli.Usagef("%s names no %s to import.", path, file.noun)
	}
	if count > storeImportLimit {
		return 0, problems, cli.Usagef("%s names %d purchases; an import holds at most %d.", path, count, storeImportLimit).
			WithHint("Split the file, and import the next part once this import completes.")
	}
	return count, problems, nil
}

// sendStoreFile adds the purchases of path to the import, a batch at a time,
// reporting progress on a terminal, and concludes it once all are sent.
func sendStoreFile(ctx context.Context, app *cli.App, mode cli.OutputMode, projectID string, found provider, importID, path string, total int) (cli.Object[api.PaymentProviderHistoryImport], error) {
	file := fileOf(found)
	rows, err := openStoreRows(app, path, file)
	if err != nil {
		return cli.Object[api.PaymentProviderHistoryImport]{}, err
	}
	defer rows.closer.Close()
	sent := 0
	batch := make([]any, 0, storeImportBatch)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.PaymentProviderHistoryImportsAddIdentifiersWithBody(ctx, projectID, found.Id, importID, catalog.JSON,
				catalog.Body(map[string]any{"identifiers": batch}))
		})
		if err != nil {
			if sent > 0 {
				app.Notef("%s were sent before this failed; sending the file again adds only the rest.", plural(sent, "purchase"))
			}
			return err
		}
		sent += len(batch)
		batch = batch[:0]
		if mode == cli.Human && total > storeImportBatch {
			app.Notef("Sent %d of %d purchases.", sent, total)
		}
		return nil
	}
	for {
		row, problem, err := rows.next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return cli.Object[api.PaymentProviderHistoryImport]{}, cli.Usagef("Cannot read %s: %v.", path, err)
		}
		if problem != "" {
			continue
		}
		identifier := map[string]any{file.field: row.value}
		if row.appUserID != "" {
			identifier["appUserId"] = row.appUserID
		}
		batch = append(batch, identifier)
		if len(batch) == storeImportBatch {
			if err := flush(); err != nil {
				return cli.Object[api.PaymentProviderHistoryImport]{}, err
			}
		}
	}
	if err := flush(); err != nil {
		return cli.Object[api.PaymentProviderHistoryImport]{}, err
	}
	return cli.Fetch[api.PaymentProviderHistoryImport](ctx, app, func(c *api.Client) (*http.Response, error) {
		return c.PaymentProviderHistoryImportsConclude(ctx, projectID, found.Id, importID)
	})
}

// storeOutcomeLabels names each outcome of a store import's report.
var storeOutcomeLabels = []struct{ outcome, label string }{
	{"imported", "imported"},
	{"already_known", "already recorded"},
	{"waiting_for_product", "waiting for a store product mapping"},
	{"not_paid", "not paid"},
	{"not_found", "not found"},
	{"other_environment", "of the other environment"},
	{"no_longer_available", "no longer available"},
	{"other_app", "of another app"},
	{"invalid", "invalid"},
	{"pending", "not looked up"},
}

// readStoreReport reads an import's whole report.
func readStoreReport(ctx context.Context, app *cli.App, projectID, providerID, importID string) (cli.List[api.StoreImportIdentifierOutcome], error) {
	return cli.ListAll[api.StoreImportIdentifierOutcome](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PaymentProviderHistoryImportsListIdentifiers(ctx, projectID, providerID, importID,
			&api.PaymentProviderHistoryImportsListIdentifiersParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

// summarizeStoreReport is a report's outcomes in words, and the first
// purchases not imported with why.
func summarizeStoreReport(report []api.StoreImportIdentifierOutcome) []string {
	counts := map[string]int{}
	for _, item := range report {
		counts[string(item.Outcome)]++
	}
	var tally []string
	for _, entry := range storeOutcomeLabels {
		if counts[entry.outcome] > 0 {
			tally = append(tally, fmt.Sprintf("%d %s", counts[entry.outcome], entry.label))
		}
	}
	lines := []string{"Report: " + strings.Join(tally, ", ") + "."}
	listed := 0
	for _, item := range report {
		if item.Outcome == "imported" || item.Outcome == "already_known" || item.Note == nil {
			continue
		}
		if listed == 10 {
			lines = append(lines, "  …")
			break
		}
		lines = append(lines, fmt.Sprintf("  %s: %s", truncate(reportValue(item), 40), *item.Note))
		listed++
	}
	return lines
}

func reportValue(item api.StoreImportIdentifierOutcome) string {
	if item.TransactionId != nil {
		return *item.TransactionId
	}
	if item.PurchaseToken != nil {
		return *item.PurchaseToken
	}
	return ""
}

// writeStoreReport writes a report as CSV to path.
func writeStoreReport(app *cli.App, path string, file storeFile, report []api.StoreImportIdentifierOutcome) error {
	handle, err := os.Create(inDir(app, path))
	if err != nil {
		return cli.Failf("Cannot write %s: %v.", path, errors.Unwrap(err))
	}
	writer := csv.NewWriter(handle)
	_ = writer.Write([]string{file.column, "app_user_id", "outcome", "note"})
	for _, item := range report {
		appUserID, note := "", ""
		if item.AppUserId != nil {
			appUserID = *item.AppUserId
		}
		if item.Note != nil {
			note = *item.Note
		}
		_ = writer.Write([]string{reportValue(item), appUserID, string(item.Outcome), note})
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		handle.Close()
		return cli.Failf("Cannot write %s: %v.", path, err)
	}
	return handle.Close()
}

// storeImport is what `voidhash provider import` was asked to do for a store.
type storeImport struct {
	environment, file, handle, label, projectID, report string
	found                                               provider
	latest                                              cli.List[api.PaymentProviderHistoryImport]
	watch                                               bool
}

// importStoreFile sends a file of purchases to a store's import, to the
// upload left open or to a new import, and follows it when asked. Without a
// file it follows the running import, or writes the latest one's report.
func importStoreFile(ctx context.Context, app *cli.App, mode cli.OutputMode, input storeImport) error {
	found, file := input.found, fileOf(input.found)
	var current cli.Object[api.PaymentProviderHistoryImport]
	hasLatest := len(input.latest.Items) > 0
	if hasLatest {
		current = input.latest.Object(0)
	}
	isRunning := hasLatest && current.Value.Status == "running"
	isOpen := isRunning && current.Value.Phase == "collecting"
	retry := fmt.Sprintf("voidhash provider import %s --file <csv>", input.handle)

	started := ""
	switch {
	case input.file == "" && !hasLatest:
		return cli.Usagef("%s's import takes a CSV file of the purchases to import: --file <path>.", input.label).
			WithHint(fmt.Sprintf("Its first line names the columns: %s, one per purchase, and optionally app_user_id. Run '%s'.", file.column, retry))
	case input.file == "":
		started = fmt.Sprintf("The latest %s import of %s:", input.environment, input.label)
	case isRunning && !isOpen:
		return cli.Failf("An import of %s's %s purchases is already looking up the purchases it was given.", input.label, input.environment).
			WithHint(fmt.Sprintf("Import the file once it ends ('voidhash provider import %s --watch'), or stop it with --cancel.", input.handle))
	default:
		count, problems, err := checkStoreFile(app, input.file, file)
		if err != nil {
			return err
		}
		for index, problem := range problems {
			if index == 10 {
				app.Warnf("and %d more lines left out", len(problems)-10)
				break
			}
			app.Warnf("Left out %s.", problem)
		}
		if !isOpen {
			current, err = startImport(ctx, app, input.projectID, found.Id, input.environment)
			if err != nil {
				blocked := "Save its In-App Purchase key first: 'voidhash provider connect app-store'."
				if found.Type == "google_play" {
					blocked = "Save its service account key first: 'voidhash provider connect google-play'."
				}
				return cli.APIError(err, map[string]string{"history_import_blocked": blocked})
			}
		}
		current, err = sendStoreFile(ctx, app, mode, input.projectID, found, current.Value.Id, input.file, count)
		if err != nil {
			return cli.APIError(err, map[string]string{
				"history_import_closed":           "Run the command again to start a new import; purchases already imported are recognized.",
				"history_import_identifier_limit": "Split the file, and import the next part once this import completes.",
			})
		}
		started = fmt.Sprintf("Sent %s to the import of %s's %s purchases.", plural(count, "purchase"), input.label, input.environment)
	}

	progress := func(historyImport api.PaymentProviderHistoryImport) string {
		return "  " + describeStoreImport(historyImport)
	}
	if !input.watch {
		lines := []string{started, progress(current.Value)}
		if current.Value.Status == "running" {
			lines = append(lines, fmt.Sprintf("It looks them up in the background. Follow it with 'voidhash provider import %s --watch'.", input.handle))
		}
		if input.report != "" {
			if err := writeReport(ctx, app, input, current.Value.Id); err != nil {
				return err
			}
			lines = append(lines, fmt.Sprintf("Wrote the report to %s.", input.report))
		}
		return app.PrintItem(mode, current, strings.Join(lines, "\n"))
	}
	if mode == cli.Human {
		app.Println(cli.PrintableLines(started + "\n" + progress(current.Value)))
	}
	current, err := followImport(ctx, app, mode, input.projectID, found.Id, current, progress)
	if err != nil {
		return err
	}
	if mode != cli.Human {
		if err := app.PrintItem(mode, current, ""); err != nil {
			return err
		}
	}
	reportItems, err := readStoreReport(ctx, app, input.projectID, found.Id, current.Value.Id)
	if err != nil {
		return err
	}
	if mode == cli.Human {
		app.Println(cli.PrintableLines(strings.Join(summarizeStoreReport(reportItems.Items), "\n")))
	}
	if input.report != "" {
		if err := writeStoreReport(app, input.report, file, reportItems.Items); err != nil {
			return err
		}
		app.Notef("Wrote the report to %s.", input.report)
	} else if mode == cli.Human {
		app.Notef("Write every purchase's outcome to a file with --report <path>.")
	}
	if current.Value.Status == "failed" {
		message := "The import failed."
		if current.Value.LastError != nil {
			message = "The import failed: " + *current.Value.LastError
		}
		return cli.Failf("%s", message).WithHint(fmt.Sprintf("Fix that, then run '%s' again; what it imported stays.", retry))
	}
	if mode == cli.Human && current.Value.Counts.Parked > 0 {
		app.Notef("%s wait for store products to be mapped: 'voidhash provider products %s --unmapped'.",
			plural(current.Value.Counts.Parked, "purchase"), cli.Printable(input.handle))
	}
	return nil
}

// writeReport writes the report of an import to the file asked for.
func writeReport(ctx context.Context, app *cli.App, input storeImport, importID string) error {
	reportItems, err := readStoreReport(ctx, app, input.projectID, input.found.Id, importID)
	if err != nil {
		return err
	}
	return writeStoreReport(app, input.report, fileOf(input.found), reportItems.Items)
}

// describeStoreImport is a store import's progress in words.
func describeStoreImport(historyImport api.PaymentProviderHistoryImport) string {
	counts := historyImport.Counts
	tally := []string{
		fmt.Sprintf("%d of %d looked up", counts.Total-counts.Pending, counts.Total),
		fmt.Sprintf("%d imported", counts.Applied),
	}
	if counts.Ignored != 0 {
		tally = append(tally, fmt.Sprintf("%d already recorded or unpaid", counts.Ignored))
	}
	if counts.Parked != 0 {
		tally = append(tally, fmt.Sprintf("%d waiting for a store product mapping", counts.Parked))
	}
	if counts.Failed != 0 {
		tally = append(tally, fmt.Sprintf("%d not imported", counts.Failed))
	}
	state := string(historyImport.Status)
	if state == "running" && historyImport.Phase == "collecting" {
		state = "taking purchases"
	}
	line := state + ": " + strings.Join(tally, ", ")
	if historyImport.LastError != nil {
		line += " (last error: " + *historyImport.LastError + ")"
	}
	return line
}
