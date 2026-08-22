package com.voidhash.example.nimbus.ui

import android.app.Activity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.voidhash.example.nimbus.FREE_NOTE_LIMIT
import com.voidhash.example.nimbus.NimbusUiState
import com.voidhash.example.nimbus.findActivity

/**
 * The note list, the free-quota banner and the Pro-only Export action.
 *
 * SDK calls behind this screen: `capture("note_created")`,
 * `setPersonAttributes`, `capture("export_requested")` and — when a free user
 * asks to export — `presentPaywall(activity, "onboarding", listener)`.
 */
@Composable
fun NotesScreen(
    state: NimbusUiState,
    onCreateNote: (Activity?, String) -> Unit,
    onDeleteNote: (String) -> Unit,
    onExport: (Activity?) -> Unit,
    modifier: Modifier = Modifier,
) {
    // `LocalContext` hands back a ContextThemeWrapper, not the activity. Play
    // Billing and the paywall presenter both need the real one.
    val activity = LocalContext.current.findActivity()
    var draft by remember { mutableStateOf("") }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            QuotaCard(state)
        }

        item {
            SectionCard(
                title = "New note",
                subtitle = "Creating a note captures a note_created event and updates the " +
                    "notes_created person attribute.",
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            onCreateNote(activity, draft)
                            draft = ""
                        },
                    ),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            onCreateNote(activity, draft)
                            draft = ""
                        },
                        enabled = !state.isResolvingPaywall,
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Text(
                            if (state.canCreateNote) "Add note" else "Upgrade to add",
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                    OutlinedButton(
                        onClick = { onExport(activity) },
                        enabled = !state.isResolvingPaywall,
                    ) {
                        Text(if (state.isPro) "Export" else "Export (Pro)")
                    }
                }
            }
        }

        item {
            Text(
                if (state.notes.size == 1) "1 note" else "${state.notes.size} notes",
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        items(state.notes, key = { it.id }) { note ->
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        note.title,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { onDeleteNote(note.id) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete note")
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun QuotaCard(state: NimbusUiState) {
    if (state.isPro) {
        SectionCard(
            title = "Pro",
            subtitle = "Unlimited notes and export. The `pro` perk is active on this person.",
        ) {
            Text("Everything is unlocked.", style = MaterialTheme.typography.bodyMedium)
        }
        return
    }

    SectionCard(
        title = "${state.notesRemaining} of $FREE_NOTE_LIMIT notes left",
        subtitle = "Free accounts keep $FREE_NOTE_LIMIT notes. Export needs Pro.",
    ) {
        LinearProgressIndicator(
            progress = { state.notes.size.coerceAtMost(FREE_NOTE_LIMIT) / FREE_NOTE_LIMIT.toFloat() },
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
