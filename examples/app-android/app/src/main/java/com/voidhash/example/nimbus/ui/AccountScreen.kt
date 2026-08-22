package com.voidhash.example.nimbus.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.voidhash.example.nimbus.NimbusUiState
import com.voidhash.example.nimbus.ONBOARDING_FLAG_KEY
import com.voidhash.sdk.api.EntitlementGrant

/**
 * Identity, entitlements and feature flags.
 *
 * SDK calls behind this screen: `identify`, `setPersonAttributes`,
 * `getCurrentPerson(forceFetch = true)`, `getFeatureFlags`, `flush` and
 * `reset`.
 */
@Composable
fun AccountScreen(
    state: NimbusUiState,
    onSignIn: (String, String, String) -> Unit,
    onSignOut: () -> Unit,
    onRefresh: () -> Unit,
    onFlush: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            if (state.isSignedIn) {
                SignedInCard(state, onSignOut, onRefresh)
            } else {
                SignInCard(state, onSignIn)
            }
        }

        item { PersonCard(state) }

        item {
            SectionCard(
                title = "Entitlements",
                subtitle = "Grants from getCurrentPerson(forceFetch = true). " +
                    "activePerkIds is what gates Pro.",
            ) {
                val grants = state.person?.entitlementGrants.orEmpty()
                if (grants.isEmpty()) {
                    Text("No grants yet.", style = MaterialTheme.typography.bodyMedium)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        grants.forEach { GrantRow(it) }
                    }
                }
            }
        }

        item { FlagCard(state, onRefresh) }

        item {
            SectionCard(
                title = "Analytics",
                subtitle = "Events are batched (20 events or five seconds). " +
                    "The example also flushes when the activity stops.",
            ) {
                OutlinedButton(onClick = onFlush) { Text("Flush now") }
            }
        }
    }
}

@Composable
private fun SignInCard(state: NimbusUiState, onSignIn: (String, String, String) -> Unit) {
    var userId by rememberSaveable { mutableStateOf("user-123") }
    var email by rememberSaveable { mutableStateOf("ada@example.com") }
    var name by rememberSaveable { mutableStateOf("Ada Lovelace") }

    SectionCard(
        title = "Sign in",
        subtitle = "identify() aliases the anonymous distinct id onto your own user id, " +
            "carrying any purchases made before sign in.",
    ) {
        OutlinedTextField(
            value = userId,
            onValueChange = { userId = it },
            label = { Text("External user id") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Name") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = { onSignIn(userId, email, name) },
            enabled = !state.isAccountBusy,
        ) {
            Text(if (state.isAccountBusy) "Signing in…" else "Sign in")
        }
    }
}

@Composable
private fun SignedInCard(state: NimbusUiState, onSignOut: () -> Unit, onRefresh: () -> Unit) {
    SectionCard(
        title = "Signed in",
        subtitle = "reset() clears the local identity; the next call runs as a new " +
            "anonymous person.",
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onSignOut, enabled = !state.isAccountBusy) {
                Text("Sign out")
            }
            TextButton(onClick = onRefresh, enabled = !state.isAccountBusy) {
                Text("Refresh")
            }
        }
    }
}

@Composable
private fun PersonCard(state: NimbusUiState) {
    SectionCard(
        title = "Person",
        subtitle = "plan and notes_created are written with setPersonAttributes().",
    ) {
        KeyValueRow("Distinct id", state.distinctId.ifEmpty { "—" })
        KeyValueRow("Person id", state.person?.personId?.ifEmpty { "—" } ?: "—")
        KeyValueRow("Email", state.person?.email ?: "—")
        KeyValueRow("Name", state.person?.name ?: "—")
        KeyValueRow("plan", state.planAttribute)
        KeyValueRow("notes_created", state.notes.size.toString())
        val subscription = state.person?.currentSubscription
        if (subscription != null) {
            KeyValueRow("Subscription", "${subscription.productId ?: "—"} · ${subscription.status}")
        }
    }
}

@Composable
private fun GrantRow(grant: EntitlementGrant) {
    Column {
        KeyValueRow(grant.perkId, if (grant.isActive) "active" else grant.status)
        Text(
            listOfNotNull(grant.source, grant.expiresAt?.let { "expires $it" }).joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun FlagCard(state: NimbusUiState, onRefresh: () -> Unit) {
    SectionCard(
        title = "Feature flag",
        subtitle = "getFeatureFlags(listOf(\"$ONBOARDING_FLAG_KEY\"))",
    ) {
        val flag = state.onboardingFlag
        KeyValueRow(ONBOARDING_FLAG_KEY, if (flag == null) "not evaluated" else flag.enabled.toString())
        val variant = flag?.variantKey
        if (variant != null) {
            KeyValueRow("variant", variant)
        }
        if (state.flagError != null) {
            ErrorText(state.flagError)
        }
        TextButton(onClick = onRefresh, enabled = !state.isAccountBusy) { Text("Re-evaluate") }
    }
}
