// Package credentials keeps the tokens the CLI signs in with, keyed by the
// API origin they are sent to: in the operating system's own store when
// there is one (the macOS keychain, the Secret Service on Linux), and in a
// file readable only by its owner otherwise.
package credentials

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Source says where a credential came from.
type Source string

const (
	// SourceKeychain is the macOS login keychain.
	SourceKeychain Source = "keychain"
	// SourceSecretService is the Secret Service keyring on Linux.
	SourceSecretService Source = "secret-service"
	// SourceFile is the credentials file.
	SourceFile Source = "file"
	// SourceEnvironment is the VOIDHASH_API_KEY environment variable.
	SourceEnvironment Source = "environment"
	// SourceNone means there is no operating system store.
	SourceNone Source = ""
)

// service is the name the CLI's credentials are kept under in the operating
// system's store.
const service = "voidhash"

// Runner runs a credential tool, writing stdin to its standard input, and
// answers its exit code and standard output. Tests replace it to stand in
// for the keychain.
type Runner func(ctx context.Context, name string, args []string, stdin string) (exitCode int, stdout string, err error)

// ExecRunner runs the tool as a process. A tool that waits for a password
// nobody can type (no login keychain for this home, say) is stopped after
// 30 seconds, so the file is used instead of hanging the CLI.
func ExecRunner(ctx context.Context, name string, args []string, stdin string) (int, string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, name, args...)
	command.Stdin = strings.NewReader(stdin)
	output, err := command.Output()
	var exit *exec.ExitError
	if errors.As(err, &exit) && ctx.Err() == nil {
		return exit.ExitCode(), string(output), nil
	}
	if err != nil {
		return 0, "", err
	}
	return 0, string(output), nil
}

// ChooseOSStore picks the operating system store for goos: the login
// keychain on macOS, the Secret Service through secret-tool on Linux when it
// is installed, and none elsewhere.
func ChooseOSStore(goos string, hasSecretTool bool) Source {
	switch {
	case goos == "darwin":
		return SourceKeychain
	case goos == "linux" && hasSecretTool:
		return SourceSecretService
	default:
		return SourceNone
	}
}

// FilePath is the credentials file: %APPDATA%\voidhash\credentials.json on
// Windows, otherwise $XDG_CONFIG_HOME/voidhash/credentials.json, by default
// under ~/.config.
func FilePath(goos, home, xdgConfigHome, appData string) string {
	var configHome string
	switch {
	case goos == "windows" && appData != "":
		configHome = appData
	case goos == "windows":
		configHome = filepath.Join(home, "AppData", "Roaming")
	case xdgConfigHome != "" && filepath.IsAbs(xdgConfigHome):
		configHome = xdgConfigHome
	default:
		configHome = filepath.Join(home, ".config")
	}
	return filepath.Join(configHome, "voidhash", "credentials.json")
}

// IsOnPath reports whether an executable called name is in one of the
// directories of pathVariable.
func IsOnPath(name, pathVariable string) bool {
	for _, directory := range filepath.SplitList(pathVariable) {
		if directory == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(directory, name)); err == nil {
			return true
		}
	}
	return false
}

// Origin is what credentials are stored under for apiURL, such as
// https://api.voidhash.com: its scheme, host and port, so a token is never
// sent to another port, or over plain HTTP to the host it was issued on.
func Origin(apiURL string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(apiURL))
	if err != nil || parsed.Hostname() == "" {
		return "", false
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", false
	}
	host := strings.ToLower(parsed.Hostname())
	if strings.Contains(host, ":") {
		host = "[" + host + "]"
	}
	port := parsed.Port()
	if (scheme == "http" && port == "80") || (scheme == "https" && port == "443") {
		port = ""
	}
	if port != "" {
		host += ":" + port
	}
	return scheme + "://" + host, true
}

// An API origin as it may appear in a keychain account name: http or https,
// then a hostname or a bracketed IPv6 address, and maybe a port.
var safeOrigin = regexp.MustCompile(`^https?://[a-z0-9.\-\[\]:]+$`)

// Stored is a credential found in the store, and where.
type Stored struct {
	Token  string
	Source Source
}

// StoreOptions configures a [Store].
type StoreOptions struct {
	// OSStore is the operating system store to use, or [SourceNone].
	OSStore Source
	// FilePath is the credentials file.
	FilePath string
	// Run runs the operating system store's tool. Defaults to [ExecRunner].
	Run Runner
	// Warn tells the person about a problem that does not stop the command.
	Warn func(message string)
	// Debug receives detail shown only with --debug.
	Debug func(message string)
}

// Store keeps tokens by API origin. It uses the operating system's store
// when there is one, and falls back to the credentials file when there is
// none or it cannot be written.
type Store struct {
	options StoreOptions
	warned  bool
}

// NewStore creates a store.
func NewStore(options StoreOptions) *Store {
	if options.Run == nil {
		options.Run = ExecRunner
	}
	if options.Warn == nil {
		options.Warn = func(string) {}
	}
	if options.Debug == nil {
		options.Debug = func(string) {}
	}
	return &Store{options: options}
}

// FilePath is the credentials file.
func (s *Store) FilePath() string { return s.options.FilePath }

// OSStore is the operating system store in use, or [SourceNone].
func (s *Store) OSStore() Source { return s.options.OSStore }

// Get returns the token stored for origin, or nil: the file first, then the
// operating system's store. The file holds a token only while the last save
// could not use the operating system's store, as over SSH with the keychain
// locked, so it is newer than one left there. Get fails when the file holds
// no token and the operating system's store could not be read, since one may
// be stored there.
func (s *Store) Get(ctx context.Context, origin string) (*Stored, error) {
	if token, ok := s.readFile()[origin]; ok {
		return &Stored{Token: token, Source: SourceFile}, nil
	}
	if s.options.OSStore == SourceNone {
		return nil, nil
	}
	token, err := s.osGet(ctx, origin)
	if err != nil || token == "" {
		return nil, err
	}
	return &Stored{Token: token, Source: s.options.OSStore}, nil
}

// Set stores token for origin, and answers where it went.
func (s *Store) Set(ctx context.Context, origin, token string) (Source, error) {
	if s.options.OSStore != SourceNone {
		err := s.osSet(ctx, origin, token)
		if err == nil {
			// A token left in the file from an earlier fallback would be read
			// before this one, so the save fails unless it is gone.
			if err := s.fileRemove(origin); err != nil {
				return SourceNone, err
			}
			return s.options.OSStore, nil
		}
		s.options.Debug("Credential store failed: " + err.Error())
	}
	credentials := s.readFile()
	credentials[origin] = token
	if err := s.writeFile(credentials); err != nil {
		return SourceNone, err
	}
	return SourceFile, nil
}

// Remove deletes the token stored for origin from source, where it was
// found, and any copy elsewhere. It fails when the token could not be
// deleted from source.
func (s *Store) Remove(ctx context.Context, origin string, source Source) error {
	if s.options.OSStore != SourceNone {
		if err := s.osRemove(ctx, origin); err != nil {
			// Where no token was found, the operating system's store may not
			// run at all, as in a headless session.
			if source == s.options.OSStore {
				return err
			}
			s.options.Debug("Credential removal failed: " + err.Error())
		}
	}
	return s.fileRemove(origin)
}

func (s *Store) run(ctx context.Context, name string, args []string, stdin string) (int, string, error) {
	exitCode, stdout, err := s.options.Run(ctx, name, args, stdin)
	if err != nil {
		return 0, "", fmt.Errorf("Could not run %s", name)
	}
	return exitCode, stdout, nil
}

// `security` reports a missing item with exit code 44.
const keychainNotFound = 44

func (s *Store) osGet(ctx context.Context, origin string) (string, error) {
	if s.options.OSStore == SourceKeychain {
		if !safeOrigin.MatchString(origin) {
			return "", fmt.Errorf("Unexpected API origin %s", origin)
		}
		exitCode, stdout, err := s.run(ctx, "security", []string{"find-generic-password", "-s", service, "-a", origin, "-w"}, "")
		switch {
		case err != nil:
			return "", err
		case exitCode == 0:
			return strings.TrimSpace(stdout), nil
		case exitCode == keychainNotFound:
			return "", nil
		default:
			return "", fmt.Errorf("The keychain could not be read (security exited with %d)", exitCode)
		}
	}
	// `secret-tool lookup` exits with 1 both for a missing item and when no
	// Secret Service is running (a headless session); either way the file was
	// checked first.
	exitCode, stdout, err := s.run(ctx, "secret-tool", []string{"lookup", "service", service, "account", origin}, "")
	if err != nil || exitCode != 0 {
		return "", err
	}
	return strings.TrimSpace(stdout), nil
}

func (s *Store) osSet(ctx context.Context, origin, token string) error {
	if s.options.OSStore == SourceKeychain {
		if !safeOrigin.MatchString(origin) {
			return fmt.Errorf("Unexpected API origin %s", origin)
		}
		// `security add-generic-password -w <token>` would put the token on a
		// command line other users can read, and it cannot read a password
		// from standard input. Its interactive mode reads the command itself
		// from standard input, so the token, written as hexadecimal with -X,
		// never appears in argv.
		command := fmt.Sprintf("add-generic-password -U -s %s -a \"%s\" -l \"Voidhash CLI\" -X %s\n", service, origin, hex.EncodeToString([]byte(token)))
		exitCode, _, err := s.run(ctx, "security", []string{"-i"}, command)
		if err != nil {
			return err
		}
		if exitCode != 0 {
			return fmt.Errorf("The keychain could not be written (security exited with %d)", exitCode)
		}
		return nil
	}
	// `secret-tool store` reads the secret from standard input.
	exitCode, _, err := s.run(ctx, "secret-tool", []string{"store", "--label=Voidhash CLI (" + origin + ")", "service", service, "account", origin}, token)
	if err != nil {
		return err
	}
	if exitCode != 0 {
		return fmt.Errorf("The Secret Service could not be written (secret-tool exited with %d)", exitCode)
	}
	return nil
}

func (s *Store) osRemove(ctx context.Context, origin string) error {
	if s.options.OSStore == SourceKeychain {
		if !safeOrigin.MatchString(origin) {
			return fmt.Errorf("Unexpected API origin %s", origin)
		}
		exitCode, _, err := s.run(ctx, "security", []string{"delete-generic-password", "-s", service, "-a", origin}, "")
		if err != nil {
			return err
		}
		if exitCode != 0 && exitCode != keychainNotFound {
			return fmt.Errorf("The keychain item could not be deleted (security exited with %d)", exitCode)
		}
		return nil
	}
	// `secret-tool clear` exits with 0 when no item matched, too.
	exitCode, _, err := s.run(ctx, "secret-tool", []string{"clear", "service", service, "account", origin}, "")
	if err != nil {
		return err
	}
	if exitCode != 0 {
		return fmt.Errorf("The Secret Service item could not be deleted (secret-tool exited with %d)", exitCode)
	}
	return nil
}

// readFile returns the tokens in the file. A file that cannot be read or is
// not a credentials file counts as empty, so `login` can replace it and
// `logout` still runs; the person is told once per run.
func (s *Store) readFile() map[string]string {
	credentials := map[string]string{}
	data, err := os.ReadFile(s.options.FilePath)
	if errors.Is(err, fs.ErrNotExist) {
		return credentials
	}
	if err == nil {
		err = json.Unmarshal(data, &credentials)
	}
	if err != nil {
		if !s.warned {
			s.warned = true
			s.options.Warn(fmt.Sprintf(
				"Could not read %s (%s), so the tokens in it are ignored. Delete the file, then sign in again with 'voidhash login'.",
				s.options.FilePath, strings.SplitN(err.Error(), "\n", 2)[0],
			))
		}
		return map[string]string{}
	}
	if credentials == nil {
		credentials = map[string]string{}
	}
	return credentials
}

// writeFile writes the credentials readable by this user only: the directory
// 0700 and the file 0600. They go to a new file beside it first, which then
// replaces it, so an interrupted write leaves the previous file whole.
func (s *Store) writeFile(credentials map[string]string) error {
	path := s.options.FilePath
	failed := func(err error) error { return fmt.Errorf("Could not write %s: %w", path, err) }
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return failed(err)
	}
	if err := os.Chmod(directory, 0o700); err != nil {
		return failed(err)
	}
	data, err := json.Marshal(credentials)
	if err != nil {
		return failed(err)
	}
	temporary, err := os.CreateTemp(directory, "credentials.json.*.tmp")
	if err != nil {
		return failed(err)
	}
	_, err = temporary.Write(data)
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Chmod(temporary.Name(), 0o600)
	}
	if err == nil {
		err = os.Rename(temporary.Name(), path)
	}
	if err != nil {
		os.Remove(temporary.Name())
		return failed(err)
	}
	return nil
}

func (s *Store) fileRemove(origin string) error {
	credentials := s.readFile()
	if _, ok := credentials[origin]; !ok {
		return nil
	}
	delete(credentials, origin)
	return s.writeFile(credentials)
}
