package com.voidhash.example.nimbus.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.voidhash.example.nimbus.NimbusEvent
import com.voidhash.example.nimbus.NimbusViewModel
import com.voidhash.example.nimbus.SdkStatus

private enum class NimbusTab(val label: String, val icon: ImageVector) {
    Notes("Notes", Icons.Default.Edit),
    Upgrade("Upgrade", Icons.Default.Star),
    Account("Account", Icons.Default.Person),
}

/**
 * The whole app: a loading / failure / ready gate around three tabs.
 *
 * The gate is not decoration. `initialize()` talks to the network and to Google
 * Play, both of which fail on a bad day, and an app that renders nothing in
 * that case looks broken. Here the failure is a screen with a retry button.
 */
@Composable
fun NimbusApp(viewModel: NimbusViewModel) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var selectedTabIndex by rememberSaveable { mutableIntStateOf(0) }

    LaunchedEffect(viewModel) {
        viewModel.events.collect { event ->
            when (event) {
                is NimbusEvent.Message -> snackbarHostState.showSnackbar(event.text)
                NimbusEvent.OpenUpgrade -> selectedTabIndex = NimbusTab.Upgrade.ordinal
            }
        }
    }

    Surface(color = MaterialTheme.colorScheme.background) {
        when (val status = state.status) {
            SdkStatus.MissingKey -> MissingKeyScreen()
            SdkStatus.Loading -> LoadingScreen()
            is SdkStatus.Failed -> FailureScreen(status.message, viewModel::initialize)
            SdkStatus.Ready -> ReadyScaffold(
                viewModel = viewModel,
                snackbarHostState = snackbarHostState,
                selectedTabIndex = selectedTabIndex,
                onSelectTab = { selectedTabIndex = it },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReadyScaffold(
    viewModel: NimbusViewModel,
    snackbarHostState: SnackbarHostState,
    selectedTabIndex: Int,
    onSelectTab: (Int) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val tab = NimbusTab.entries[selectedTabIndex]

    Scaffold(
        topBar = { TopAppBar(title = { Text(tab.label) }) },
        bottomBar = {
            NavigationBar {
                NimbusTab.entries.forEachIndexed { index, entry ->
                    NavigationBarItem(
                        selected = index == selectedTabIndex,
                        onClick = { onSelectTab(index) },
                        icon = { Icon(entry.icon, contentDescription = null) },
                        label = { Text(entry.label) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { contentPadding ->
        val content = Modifier.padding(contentPadding)
        when (tab) {
            NimbusTab.Notes -> NotesScreen(
                state = state,
                onCreateNote = viewModel::createNote,
                onDeleteNote = viewModel::deleteNote,
                onExport = viewModel::exportNotes,
                modifier = content,
            )

            NimbusTab.Upgrade -> UpgradeScreen(
                state = state,
                onPurchase = viewModel::purchase,
                onRestore = viewModel::restorePurchases,
                onReload = viewModel::loadProducts,
                modifier = content,
            )

            NimbusTab.Account -> AccountScreen(
                state = state,
                onSignIn = viewModel::signIn,
                onSignOut = viewModel::signOut,
                onRefresh = viewModel::refreshAccount,
                onFlush = viewModel::flushAnalytics,
                modifier = content,
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    CenteredMessage {
        CircularProgressIndicator()
        Text("Starting Voidhash…", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun FailureScreen(message: String, onRetry: () -> Unit) {
    CenteredMessage {
        Text("Voidhash could not start", style = MaterialTheme.typography.titleMedium)
        Text(
            message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center,
        )
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}

@Composable
private fun MissingKeyScreen() {
    CenteredMessage {
        Text("No publishable key", style = MaterialTheme.typography.titleMedium)
        Text(
            "Add voidhash.publishableKey=vh_pk_… to local.properties and rebuild. " +
                "The key lives in Studio under Project settings → API keys.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun CenteredMessage(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            content()
        }
    }
}
