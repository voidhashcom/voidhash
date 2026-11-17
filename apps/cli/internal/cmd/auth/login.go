package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/voidhashcom/voidhash-go"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/config"
	"github.com/voidhashcom/voidhash/apps/cli/internal/credentials"
)

// formatWait is a wait for messages: "45 seconds", "4 minutes".
func formatWait(wait time.Duration) string {
	seconds := max(int(wait.Round(time.Second)/time.Second), 1)
	if seconds < 60 {
		if seconds == 1 {
			return "1 second"
		}
		return fmt.Sprintf("%d seconds", seconds)
	}
	minutes := (seconds + 59) / 60
	if minutes == 1 {
		return "1 minute"
	}
	return fmt.Sprintf("%d minutes", minutes)
}

// refused is a sign-in the server or the person ended.
func refused(message, hint string) *cli.UserError {
	return &cli.UserError{Message: message, Hint: hint, ExitCode: cli.ExitUnauthenticated}
}

const newCodeHint = "Run 'voidhash login' again for a new code."

// startFailure words a sign-in the server would not start.
func startFailure(apiURL string, err error) error {
	var oauthErr *voidhash.OAuthError
	if errors.As(err, &oauthErr) {
		if oauthErr.StatusCode == 429 || oauthErr.Code == "slow_down" {
			// The server limits sign-ins per network over a 10-minute window.
			when := "Wait up to 10 minutes and try again."
			if oauthErr.RetryAfter > 0 {
				when = "Try again in " + formatWait(oauthErr.RetryAfter) + "."
			}
			return refused("Too many sign-in attempts from this network. "+when, "")
		}
		detail := oauthErr.Description
		if detail == "" {
			detail = oauthErr.Code
		}
		if detail == "" {
			return refused(fmt.Sprintf("The server refused to start a sign-in (status %d).", oauthErr.StatusCode), newCodeHint)
		}
		return refused("The server refused to start a sign-in: "+cli.Printable(detail)+".", newCodeHint)
	}
	if cli.IsAPIError(err) {
		return &cli.UserError{Message: "Could not sign in: " + cli.Printable(err.Error()), Cause: err}
	}
	reason := "Could not reach " + apiURL + "."
	if errors.Is(err, context.DeadlineExceeded) {
		reason = apiURL + " did not answer in time."
	}
	return &cli.UserError{
		Message: "Could not sign in: " + reason,
		Hint:    "Check your connection and the API URL ('voidhash config'), then try again.",
		Cause:   err,
	}
}

// Approval is a sign-in the server started, waiting for the person to
// approve its code in the browser.
type Approval struct {
	// Code is the code the person checks against the page.
	Code string
	// Address is the page where the code is entered, safe to print.
	Address string
	// BrowserURL is the address the browser may be opened at. It is empty
	// when the CLI does not open it, and Unopened then says why, unless
	// the person asked for no browser.
	BrowserURL string
	Unopened   string

	app           *cli.App
	settings      config.Settings
	deviceAuth    *voidhash.DeviceAuth
	authorization *voidhash.DeviceAuthorization
}

// Signed is a sign-in that was approved and stored.
type Signed struct {
	Credential *credentials.Credential
	// Replaced says what became of the sign-in stored before; empty when
	// there is nothing to say.
	Replaced string
}

// Begin starts a sign-in with the device authorization grant: the server
// issues a code, which the person approves in the browser while
// [Approval.Wait] polls for the token.
func Begin(ctx context.Context, app *cli.App, readOnly, noBrowser bool) (*Approval, error) {
	settings, err := app.Config()
	if err != nil {
		return nil, err
	}
	installID, err := app.ConfigStore().InstallID()
	if err != nil {
		return nil, cli.Failf("Could not write the CLI config, ~/.voidhash: %v", err)
	}
	scope := "read write"
	if readOnly {
		scope = "read"
	}
	deviceAuth := app.DeviceAuth(settings.APIURL)
	authorization, err := deviceAuth.Start(ctx, voidhash.DeviceAuthorizationParams{
		Scope: scope, DeviceName: app.Hostname, InstallID: installID,
	})
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, startFailure(settings.APIURL, err)
	}
	approval := &Approval{
		Code:    cli.Printable(authorization.UserCode),
		Address: printableURL(authorization.VerificationURI),
		app:     app, settings: settings, deviceAuth: deviceAuth, authorization: authorization,
	}

	verificationURI := authorization.VerificationURIComplete
	if verificationURI == "" {
		verificationURI = authorization.VerificationURI
	}
	if shouldOpenBrowser(noBrowser, app.GOOS, app.Getenv) {
		browserURL, canOpen := openableVerificationURL(verificationURI, settings.WebURL)
		var named advertised
		isNamed := false
		if !canOpen {
			named, isNamed = advertisedDashboard(ctx, app, settings.APIURL)
			if isNamed && named.trusted {
				browserURL, canOpen = openableVerificationURL(verificationURI, named.origin)
			}
		}
		if canOpen {
			approval.BrowserURL = browserURL
		} else {
			approval.Unopened = notOpened(app, verificationURI, settings.APIURL, settings.WebURL, named, isNamed)
		}
	}
	return approval, nil
}

// Wait waits for the person to approve, then stores the token for the API
// origin. It ends with ctx's error when ctx ends first.
func (a *Approval) Wait(ctx context.Context) (Signed, error) {
	app, settings := a.app, a.settings
	token, err := a.deviceAuth.Wait(ctx, a.authorization)
	if err != nil {
		var authErr *voidhash.DeviceAuthError
		switch {
		case errors.As(err, &authErr) && authErr.Reason == voidhash.DeviceAuthDenied:
			return Signed{}, refused(cli.Printable(authErr.Message), "Run 'voidhash login' again to sign in.")
		case errors.As(err, &authErr):
			return Signed{}, refused(cli.Printable(authErr.Message), newCodeHint)
		case ctx.Err() != nil:
			return Signed{}, ctx.Err()
		default:
			return Signed{}, startFailure(settings.APIURL, err)
		}
	}

	creds := app.Credentials(ctx)
	previous, _ := creds.Stored(ctx, settings.APIURL)
	credential, err := creds.Save(ctx, settings.APIURL, token.AccessToken)
	if err != nil {
		// The server has started a session for the token, which nothing here
		// could use or end once the token is lost.
		note := app.RevokeToken(ctx, settings.APIURL, token.AccessToken).Note("")
		if note == "" {
			note = "The session it started has ended on the server."
		}
		return Signed{}, &cli.UserError{
			Message: fmt.Sprintf("Could not save the token: %v.\n%s", err, note),
			Hint:    "Make sure you can write to that file, then run 'voidhash login' again.",
		}
	}
	// The server replaces this installation's earlier session itself; a key
	// from before installation ids is revoked here, which may fail and leave
	// its session active. A project key is only replaced, and that may have
	// been the only copy of it.
	signed := Signed{Credential: credential}
	if previous != nil && previous.Token != token.AccessToken {
		revocation := app.RevokeToken(ctx, settings.APIURL, previous.Token)
		// The new sign-in may be this computer's session itself, which
		// disconnecting would end.
		note := revocation.Note("if an older sign-in from this computer is still listed under Settings → Devices and apps in the dashboard, disconnect it there.")
		switch {
		case note == "":
		case revocation.Outcome == "not_a_session":
			signed.Replaced = fmt.Sprintf("The project key stored for %s was replaced, so the CLI no longer has it. %s", credential.Origin, note)
		default:
			signed.Replaced = fmt.Sprintf("The earlier sign-in stored for %s was replaced. %s", credential.Origin, note)
		}
	}
	return signed, nil
}

// login signs in on the terminal: it shows the code, opens the browser
// when it may, and says who is signed in once the person approved.
func login(ctx context.Context, app *cli.App, readOnly, noBrowser bool) error {
	approval, err := Begin(ctx, app, readOnly, noBrowser)
	if err != nil {
		return err
	}
	app.Notef("To sign in, open %s and enter\n\n    %s\n", approval.Address, approval.Code)
	if approval.Unopened != "" {
		app.Warnf("%s", approval.Unopened)
	}
	if approval.BrowserURL != "" {
		app.Notef("Opening your browser… (press Ctrl+C to cancel)")
		if err := app.OpenURL(approval.BrowserURL); err != nil {
			app.Debugf("Opening the browser failed: %v", err)
		}
	} else {
		app.Notef("Waiting for you to approve… (press Ctrl+C to cancel)")
	}

	signed, err := approval.Wait(ctx)
	if err != nil {
		if ctx.Err() != nil && err == ctx.Err() {
			app.Notef("\nSign-in cancelled.")
		}
		return err
	}
	credential, creds := signed.Credential, app.Credentials(ctx)

	check := app.Style().Green("✓")
	if creds.EnvironmentKey() != "" {
		app.Printf("%s Signed in on %s.\n", check, credential.Origin)
		app.Notef("VOIDHASH_API_KEY is set, so commands keep using it until you unset it.")
	} else {
		who, access := "", ""
		sessionCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		if session, err := app.Session(sessionCtx); err == nil {
			if !session.IsKey() {
				who = fmt.Sprintf(" as %s (%s)", cli.Printable(session.Person.Name), cli.Printable(session.Person.Email))
			}
			if session.IsReadOnly {
				access = ", read-only"
			}
		}
		cancel()
		app.Printf("%s Signed in%s on %s%s\n", check, who, credential.Origin, access)
	}
	if signed.Replaced != "" {
		app.Notef("%s", signed.Replaced)
	}
	if credential.Source == credentials.SourceFile {
		stored := fmt.Sprintf("the token is stored in %s, readable only by you.", creds.Store().FilePath())
		if osStore := creds.Store().OSStore(); osStore == credentials.SourceNone {
			app.Notef("No system keychain is available, so %s", stored)
		} else {
			app.Notef("Could not write to %s (run with --debug to see why), so %s",
				credentials.DescribeSource(osStore, creds.Store().FilePath()), stored)
		}
	}
	return nil
}

// notOpened says why the browser was not opened for the sign-in address,
// and what to do instead.
func notOpened(app *cli.App, verificationURI, apiURL, webURL string, named advertised, isNamed bool) string {
	profile := ""
	if active := app.ActiveProfile(); active != "" {
		profile = " --profile " + active
	}
	address := printableURL(verificationURI)
	// A dashboard the server names off its own domain is only suggested,
	// when the address is one of its pages, and only as a command when its
	// origin holds nothing a shell would act on.
	if isNamed && !named.trusted && plainOrigin.MatchString(named.origin) {
		if _, ok := openableVerificationURL(verificationURI, named.origin); ok {
			return fmt.Sprintf("The browser was not opened: %s is not on %s, the dashboard the CLI is set up for. The server names %s as its dashboard, which is not on the domain of %s, so the CLI does not open it. If that is your dashboard, run 'voidhash config set web_url %s%s'; otherwise open the address yourself.",
				address, webURL, named.origin, apiURL, named.origin, profile)
		}
	}
	if isPlainHTTPOnDashboard(verificationURI, webURL) || (isNamed && isPlainHTTPOnDashboard(verificationURI, named.origin)) {
		return fmt.Sprintf("The browser was not opened: %s is plain HTTP to another computer, which the CLI does not open. Open it yourself if you trust this network.", address)
	}
	return fmt.Sprintf("The browser was not opened: %s is not on %s, the dashboard the CLI is set up for, or on one the server names on its own domain. If you expected this address, open it yourself; 'voidhash config set web_url <url>%s' sets the dashboard's address.",
		address, webURL, profile)
}

// logout signs out on the API origin: it revokes the stored token on the
// server when it can be reached, and deletes it here even when it cannot.
// It fails, saying what did happen, when the token could not be read or
// deleted.
func logout(ctx context.Context, app *cli.App) error {
	settings, err := app.Config()
	if err != nil {
		return err
	}
	creds := app.Credentials(ctx)
	stored, err := creds.Stored(ctx, settings.APIURL)
	if err != nil {
		return cli.Failf("Could not sign out: %v. Nothing was changed.", err)
	}
	environmentNote := func() {
		if creds.EnvironmentKey() != "" {
			app.Notef("VOIDHASH_API_KEY is set in the environment; unset it to stop using that key.")
		}
	}
	if stored == nil {
		app.Printf("You are not signed in on %s.\n", app.APIOrigin(settings))
		environmentNote()
		return nil
	}

	where := credentials.DescribeSource(stored.Source, creds.Store().FilePath())
	revocation := app.RevokeToken(ctx, settings.APIURL, stored.Token)
	if err := creds.Forget(ctx, stored); err != nil {
		note := revocation.Note("")
		if revocation.Revoked() {
			note = "Its session on the server has ended."
		}
		return cli.Failf("Could not sign out: %v, so the token for %s is still in %s.\n%s", err, stored.Origin, where, note)
	}
	app.Printf("Signed out of %s, and removed the token from %s.\n", stored.Origin, where)
	if note := revocation.Note(""); note != "" {
		app.Notef("%s", note)
	}
	environmentNote()
	return nil
}
