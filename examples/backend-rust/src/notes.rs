//! The Nimbus note store. In memory on purpose: this is an SDK example, not a
//! database tutorial. Swap [`NoteStore`] for your own repository and nothing
//! else in the service changes.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{PoisonError, RwLock, RwLockReadGuard, RwLockWriteGuard};

use serde::Serialize;

/// How many notes a free account may hold.
pub const FREE_NOTE_LIMIT: usize = 3;

/// A single note.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    pub created_at: String,
}

/// Notes indexed by distinct id.
#[derive(Default)]
pub struct NoteStore {
    notes: RwLock<HashMap<String, Vec<Note>>>,
    sequence: AtomicU64,
}

impl NoteStore {
    /// Creates an empty store.
    pub fn new() -> Self {
        Self::default()
    }

    /// Every note belonging to `distinct_id`, oldest first.
    pub fn list(&self, distinct_id: &str) -> Vec<Note> {
        self.read().get(distinct_id).cloned().unwrap_or_default()
    }

    /// How many notes `distinct_id` holds.
    pub fn count(&self, distinct_id: &str) -> usize {
        self.read().get(distinct_id).map_or(0, Vec::len)
    }

    /// Appends a note and returns it.
    pub fn create(&self, distinct_id: &str, title: String, body: String) -> Note {
        let note = Note {
            id: format!("note_{}", self.sequence.fetch_add(1, Ordering::Relaxed) + 1),
            title,
            body,
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        self.write()
            .entry(distinct_id.to_string())
            .or_default()
            .push(note.clone());
        note
    }

    /// Notes a free account may still create, or `None` when unlimited.
    pub fn remaining(&self, distinct_id: &str, pro: bool) -> Option<usize> {
        if pro {
            return None;
        }
        Some(FREE_NOTE_LIMIT.saturating_sub(self.count(distinct_id)))
    }

    // A panicking writer would otherwise poison the lock and turn every later
    // request into a 500. Nothing here can leave the map half-updated, so
    // recovering the guard is strictly better than propagating the poison.
    fn read(&self) -> RwLockReadGuard<'_, HashMap<String, Vec<Note>>> {
        self.notes.read().unwrap_or_else(PoisonError::into_inner)
    }

    fn write(&self) -> RwLockWriteGuard<'_, HashMap<String, Vec<Note>>> {
        self.notes.write().unwrap_or_else(PoisonError::into_inner)
    }
}
