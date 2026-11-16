import SwiftUI

/// The note list, the free quota, and the two actions that touch the SDK:
/// `capture("note_created")` and the Pro-only export that presents the paywall.
struct NotesScreen: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Screen(title: "Notes", subtitle: "Free keeps \(Nimbus.freeNoteLimit). Pro is unlimited.") {
            quota
            actions
            if model.notes.isEmpty {
                Card {
                    Text("No notes yet. Creating one captures a note_created event.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            } else {
                VStack(spacing: 8) {
                    ForEach(model.notes) { note in
                        noteRow(note)
                    }
                }
            }
        }
    }

    private var quota: some View {
        Card {
            if let remaining = model.notesRemaining {
                Text("\(remaining) of \(Nimbus.freeNoteLimit) notes left")
                    .font(.headline)
                Text("Upgrade to Pro for unlimited notes and export.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                Label("Pro — unlimited notes", systemImage: "checkmark.seal.fill")
                    .font(.headline)
                    .foregroundColor(.green)
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 12) {
            Button {
                Task { await model.createNote() }
            } label: {
                Label("New note", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)

            Button {
                Task { await model.exportNotes() }
            } label: {
                Label("Export", systemImage: model.isPro ? "square.and.arrow.up" : "lock.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(model.notes.isEmpty)
        }
        .disabled(model.isWorking)
    }

    private func noteRow(_ note: Note) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(note.title)
                Text(note.createdAt, style: .time)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Button {
                model.deleteNote(note)
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.plain)
            .foregroundColor(.secondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(12)
    }
}
