package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// freeNoteLimit is how many notes a Nimbus account keeps without Pro.
const freeNoteLimit = 3

// unlimitedNotes is the limit passed to [noteStore.Create] for Pro accounts.
const unlimitedNotes = -1

// errNoteLimitReached is returned when a free account already holds
// [freeNoteLimit] notes.
var errNoteLimitReached = errors.New("note limit reached")

// Note is one Nimbus note.
type Note struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

// noteStore keeps notes in memory, keyed by distinct id. This is an SDK
// example, not a database tutorial — restarting the process empties it.
type noteStore struct {
	mu       sync.RWMutex
	byPerson map[string][]Note
}

func newNoteStore() *noteStore {
	return &noteStore{byPerson: map[string][]Note{}}
}

// List returns a copy of the person's notes, oldest first.
func (s *noteStore) List(distinctID string) []Note {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stored := s.byPerson[distinctID]
	notes := make([]Note, len(stored))
	copy(notes, stored)
	return notes
}

// Count returns how many notes the person holds.
func (s *noteStore) Count(distinctID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.byPerson[distinctID])
}

// Create appends a note, refusing to exceed limit. Pass [unlimitedNotes] for
// Pro accounts. The quota is enforced under the same lock as the insert, so
// two concurrent requests cannot both slip past the last free slot.
func (s *noteStore) Create(distinctID, title, body string, limit int) (Note, int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing := s.byPerson[distinctID]
	if limit != unlimitedNotes && len(existing) >= limit {
		return Note{}, len(existing), errNoteLimitReached
	}

	note := Note{
		ID:        newNoteID(),
		Title:     title,
		Body:      body,
		CreatedAt: time.Now().UTC(),
	}
	s.byPerson[distinctID] = append(existing, note)
	return note, len(s.byPerson[distinctID]), nil
}

// Forget drops everything stored for a person, for use when Voidhash reports
// the person was deleted.
func (s *noteStore) Forget(distinctID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.byPerson, distinctID)
}

func newNoteID() string {
	buffer := make([]byte, 8)
	if _, err := rand.Read(buffer); err != nil {
		// crypto/rand never fails on the platforms this runs on; a timestamp
		// keeps the id unique enough for an in-memory store if it ever does.
		return "note_" + time.Now().UTC().Format("20060102150405.000000000")
	}
	return "note_" + hex.EncodeToString(buffer)
}

// quota describes how much of the free allowance a person has left. Limit and
// Remaining are null for Pro accounts.
type quota struct {
	Limit     *int `json:"limit"`
	Used      int  `json:"used"`
	Remaining *int `json:"remaining"`
	Unlimited bool `json:"unlimited"`
}

func newQuota(used int, pro bool) quota {
	if pro {
		return quota{Used: used, Unlimited: true}
	}
	limit := freeNoteLimit
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}
	return quota{Limit: &limit, Used: used, Remaining: &remaining}
}
