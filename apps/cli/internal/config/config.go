// Package config reads and writes the CLI's settings file, ~/.voidhash: the
// API and dashboard addresses, the default project and the directory links,
// with named profiles that override them. It holds no secrets; tokens live in
// the credential store.
package config

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
)

const (
	// FileName is the settings file's name in the home directory.
	FileName = ".voidhash"
	// DefaultAPIURL is the API server used when none is configured.
	DefaultAPIURL = "https://api.voidhash.com"
	// DefaultWebURL is the dashboard used when none is configured.
	DefaultWebURL = "https://voidhash.com"
)

// Settings is the effective configuration of a run: the base settings with
// the active profile's overrides, and VOIDHASH_API_URL over both.
type Settings struct {
	APIURL string
	WebURL string
	// DefaultProject is the id of the project commands act on outside linked
	// directories; empty when none was chosen.
	DefaultProject string
	// Links binds directories (absolute paths) to project ids. A link applies
	// to the directory and everything below it.
	Links map[string]string
}

// Profile holds the settings one profile overrides. Only the keys it sets
// are stored; the rest fall back to the base settings.
type Profile struct {
	// APIKey is a key from before the credential store.
	APIKey         *string           `json:"api_key,omitempty"`
	APIURL         string            `json:"api_url,omitempty"`
	WebURL         string            `json:"web_url,omitempty"`
	DefaultProject *string           `json:"default_project,omitempty"`
	Links          map[string]string `json:"links,omitempty"`
}

// File is the settings file as stored: the base settings and the profiles.
type File struct {
	// APIKey is a key from before the credential store.
	APIKey         *string           `json:"api_key,omitempty"`
	APIURL         string            `json:"api_url"`
	WebURL         string            `json:"web_url"`
	DefaultProject *string           `json:"default_project,omitempty"`
	Links          map[string]string `json:"links,omitempty"`
	// InstallID identifies this installation when it signs in, so the server
	// keeps one session per installation.
	InstallID string             `json:"install_id,omitempty"`
	Profiles  map[string]Profile `json:"profiles,omitempty"`
}

// ProfileNames lists the file's profiles in alphabetical order.
func (f *File) ProfileNames() []string {
	names := make([]string, 0, len(f.Profiles))
	for name := range f.Profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// LegacyKey is a key the settings file still holds from before the
// credential store, with the API URL it was sent to.
type LegacyKey struct {
	APIKey string
	APIURL string
	// Profile is the profile that held the key; empty for the base settings.
	Profile string
}

// LegacyKeys lists the keys the file still holds: the base key first, then
// each profile's in alphabetical order.
func (f *File) LegacyKeys() []LegacyKey {
	var keys []LegacyKey
	if f.APIKey != nil && *f.APIKey != "" {
		keys = append(keys, LegacyKey{APIKey: *f.APIKey, APIURL: f.APIURL})
	}
	for _, name := range f.ProfileNames() {
		profile := f.Profiles[name]
		if profile.APIKey == nil || *profile.APIKey == "" {
			continue
		}
		apiURL := profile.APIURL
		if apiURL == "" {
			apiURL = f.APIURL
		}
		keys = append(keys, LegacyKey{APIKey: *profile.APIKey, APIURL: apiURL, Profile: name})
	}
	return keys
}

// Changes are the settings a write replaces; a nil field is left as it is.
type Changes struct {
	APIURL         *string
	WebURL         *string
	DefaultProject *string
	// Links replaces every link when it is not nil.
	Links map[string]string
}

// Store reads and writes the settings file for one run.
type Store struct {
	// Path is the settings file, ~/.voidhash.
	Path string
	// Profile is the active profile; empty for the base settings.
	Profile string
	// APIURL, from VOIDHASH_API_URL, replaces the configured API URL when set.
	APIURL string
}

// ReadFile reads the settings file with its profiles. A missing file reads
// as the defaults.
func (s *Store) ReadFile() (*File, error) {
	file := &File{}
	data, err := os.ReadFile(s.Path)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return nil, fmt.Errorf("reading %s: %w", s.Path, err)
	default:
		if err := json.Unmarshal(data, file); err != nil {
			return nil, fmt.Errorf("reading %s: %w", s.Path, err)
		}
	}
	if file.APIURL == "" {
		file.APIURL = DefaultAPIURL
	}
	if file.WebURL == "" {
		file.WebURL = DefaultWebURL
	}
	return file, nil
}

// Read resolves the effective settings.
func (s *Store) Read() (Settings, error) {
	file, err := s.ReadFile()
	if err != nil {
		return Settings{}, err
	}
	settings := Settings{APIURL: file.APIURL, WebURL: file.WebURL, Links: file.Links}
	if file.DefaultProject != nil {
		settings.DefaultProject = *file.DefaultProject
	}
	if profile, ok := file.Profiles[s.Profile]; ok && s.Profile != "" {
		if profile.APIURL != "" {
			settings.APIURL = profile.APIURL
		}
		if profile.WebURL != "" {
			settings.WebURL = profile.WebURL
		}
		if profile.DefaultProject != nil {
			settings.DefaultProject = *profile.DefaultProject
		}
		if profile.Links != nil {
			settings.Links = profile.Links
		}
	}
	if s.APIURL != "" {
		settings.APIURL = s.APIURL
	}
	return settings, nil
}

// Write stores changes: in the active profile's overrides when there is one,
// leaving the base settings and other profiles untouched, else in the base
// settings.
func (s *Store) Write(changes Changes) error {
	file, err := s.ReadFile()
	if err != nil {
		return err
	}
	if s.Profile == "" {
		if changes.APIURL != nil {
			file.APIURL = *changes.APIURL
		}
		if changes.WebURL != nil {
			file.WebURL = *changes.WebURL
		}
		if changes.DefaultProject != nil {
			file.DefaultProject = changes.DefaultProject
		}
		if changes.Links != nil {
			file.Links = changes.Links
		}
		return s.writeFile(file)
	}
	profile := file.Profiles[s.Profile]
	if changes.APIURL != nil {
		profile.APIURL = *changes.APIURL
	}
	if changes.WebURL != nil {
		profile.WebURL = *changes.WebURL
	}
	if changes.DefaultProject != nil {
		profile.DefaultProject = changes.DefaultProject
	}
	if changes.Links != nil {
		profile.Links = changes.Links
	}
	if file.Profiles == nil {
		file.Profiles = map[string]Profile{}
	}
	file.Profiles[s.Profile] = profile
	return s.writeFile(file)
}

// Reset returns the API and dashboard URLs to their defaults. With an active
// profile it clears that profile's overrides instead, so the profile falls
// back to the base settings.
func (s *Store) Reset() error {
	file, err := s.ReadFile()
	if err != nil {
		return err
	}
	if s.Profile == "" {
		file.APIURL = DefaultAPIURL
		file.WebURL = DefaultWebURL
	} else {
		if file.Profiles == nil {
			file.Profiles = map[string]Profile{}
		}
		file.Profiles[s.Profile] = Profile{}
	}
	return s.writeFile(file)
}

// InstallID returns this installation's id, generated and saved in the base
// settings the first time it is needed.
func (s *Store) InstallID() (string, error) {
	file, err := s.ReadFile()
	if err != nil {
		return "", err
	}
	if file.InstallID != "" {
		return file.InstallID, nil
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return "", err
	}
	id[6] = id[6]&0x0f | 0x40
	id[8] = id[8]&0x3f | 0x80
	file.InstallID = fmt.Sprintf("%x-%x-%x-%x-%x", id[0:4], id[4:6], id[6:8], id[8:10], id[10:16])
	return file.InstallID, s.writeFile(file)
}

// RemoveLegacyKeys deletes the keys from before the credential store from
// the base settings and every profile.
func (s *Store) RemoveLegacyKeys() error {
	file, err := s.ReadFile()
	if err != nil {
		return err
	}
	file.APIKey = nil
	for name, profile := range file.Profiles {
		profile.APIKey = nil
		file.Profiles[name] = profile
	}
	return s.writeFile(file)
}

// writeFile replaces the settings file through a new file beside it, so an
// interrupted write leaves the previous one whole.
func (s *Store) writeFile(file *File) error {
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return err
	}
	temporary, err := os.CreateTemp(filepath.Dir(s.Path), FileName+".*.tmp")
	if err != nil {
		return fmt.Errorf("writing %s: %w", s.Path, err)
	}
	_, err = temporary.Write(append(data, '\n'))
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Rename(temporary.Name(), s.Path)
	}
	if err != nil {
		os.Remove(temporary.Name())
		return fmt.Errorf("writing %s: %w", s.Path, err)
	}
	return nil
}
