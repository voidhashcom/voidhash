package com.voidhash.example.nimbus

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.voidhash.sdk.isAnonymousDistinctId
import com.voidhash.sdk.FlowException
import com.voidhash.sdk.FlowFailure
import com.voidhash.sdk.FlowResult
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.FeatureFlag
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashPurchaseResult
import com.voidhash.sdk.billing.VoidhashStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.flow.updateAndGet
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "Nimbus"

/** Free accounts keep three notes; the fourth one needs Pro. */
const val FREE_NOTE_LIMIT = 3

/** Perk slug that unlocks Pro, as configured in Studio. */
const val PRO_PERK_SLUG = "pro"

/** Location whose flow the Notes screen presents. */
const val FLOW_LOCATION = "onboarding"

/** Feature flag the Account screen evaluates. */
const val ONBOARDING_FLAG_KEY = "nimbus-new-onboarding"

/** Display order for the shared product slugs; anything else sorts last. */
private val PRODUCT_ORDER = listOf("pro-monthly", "pro-annual", "pro-lifetime")

/** Where the SDK is in its lifecycle, as far as the UI is concerned. */
sealed interface SdkStatus {
    /** No publishable key was compiled in; the app shows setup instructions. */
    data object MissingKey : SdkStatus

    /** `initialize()` is running. */
    data object Loading : SdkStatus

    /** `initialize()` succeeded; the schema and the store are available. */
    data object Ready : SdkStatus

    /** `initialize()` failed and can be retried. */
    data class Failed(val message: String) : SdkStatus
}

/** Everything the three screens render. */
data class NimbusUiState(
    val status: SdkStatus = SdkStatus.Loading,
    val notes: List<Note> = emptyList(),
    val person: VoidhashPerson? = null,
    val distinctId: String = "",
    val products: List<VoidhashProduct> = emptyList(),
    val productsError: String? = null,
    val isLoadingProducts: Boolean = false,
    val onboardingFlag: FeatureFlag? = null,
    val flagError: String? = null,
    val isAccountBusy: Boolean = false,
    val isRestoring: Boolean = false,
    /** True while a flow is being resolved or is on screen. */
    val isPresentingFlow: Boolean = false,
    /** Store id of the product whose purchase is in flight, if any. */
    val pendingProductId: String? = null,
) {
    /** True while the person holds an active `pro` grant. */
    val isPro: Boolean get() = person?.hasActivePerk(PRO_PERK_SLUG) == true

    /** Notes a free account may still create. */
    val notesRemaining: Int get() = (FREE_NOTE_LIMIT - notes.size).coerceAtLeast(0)

    /** False once a free account holds [FREE_NOTE_LIMIT] notes. */
    val canCreateNote: Boolean get() = isPro || notes.size < FREE_NOTE_LIMIT

    /** True once `identify` replaced the generated anonymous distinct id. */
    val isSignedIn: Boolean
        get() = distinctId.isNotEmpty() && !isAnonymousDistinctId(distinctId)

    /** The `plan` person attribute this app reports. */
    val planAttribute: String get() = if (isPro) "pro" else "free"
}

/** One-shot instructions for the UI that do not belong in [NimbusUiState]. */
sealed interface NimbusEvent {
    /** Show [text] in the snackbar. */
    data class Message(val text: String) : NimbusEvent

    /** Switch to the app-owned Upgrade screen. */
    data object OpenUpgrade : NimbusEvent
}

/**
 * Owns the SDK conversation for the whole app.
 *
 * Every action catches its own failures and turns them into a snackbar or an
 * inline error: an SDK call that goes wrong is a state to render, not a crash.
 *
 * @param client the configured client, or `null` when the build has no key.
 */
class NimbusViewModel(private val client: VoidhashClient?) : ViewModel() {

    private val _uiState = MutableStateFlow(
        NimbusUiState(
            status = if (client == null) SdkStatus.MissingKey else SdkStatus.Loading,
            notes = listOf(Note.create("Welcome to Nimbus")),
        ),
    )

    /** State of all three screens. */
    val uiState: StateFlow<NimbusUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<NimbusEvent>(extraBufferCapacity = 8)

    /** Snackbar messages and navigation nudges. */
    val events: SharedFlow<NimbusEvent> = _events.asSharedFlow()

    init {
        initialize()
        observePurchases()
    }

    /**
     * Keeps the person current and tells the user about purchases that complete outside
     * `purchase()`, such as a pending payment made later. A `null` person is kept too: after a
     * sign-out, or for a visitor Voidhash has no person for, no earlier user's perks stay on screen.
     */
    private fun observePurchases() {
        val sdk = client ?: return
        viewModelScope.launch {
            sdk.person.collect { person -> _uiState.update { it.copy(person = person) } }
        }
        viewModelScope.launch {
            sdk.transactionUpdates.collect { emitMessage("Your purchase went through") }
        }
    }

    /**
     * Runs `initialize()` off the main thread and drives [SdkStatus].
     *
     * Also the retry action of the failure screen: a failed `initialize()`
     * leaves the client uninitialized, and calling it again is safe.
     */
    fun initialize() {
        val sdk = client ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(status = SdkStatus.Loading) }
            try {
                withContext(Dispatchers.IO) { sdk.initialize() }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                _uiState.update { it.copy(status = SdkStatus.Failed(error.userMessage())) }
                return@launch
            }

            _uiState.update { it.copy(status = SdkStatus.Ready, distinctId = sdk.getDistinctId()) }
            refreshPerson()
            refreshFlagsNow()
            loadProducts()
        }
    }

    /** Adds a note and captures `note_created`; asks for an upgrade at the free limit. */
    fun createNote(activity: Activity?, title: String) {
        val sdk = client ?: return
        val state = _uiState.value
        if (!state.canCreateNote) {
            viewModelScope.launch { requestUpgrade(activity, source = "note_limit") }
            return
        }

        val note = Note.create(title.trim().ifEmpty { "Untitled note" })
        val notes = _uiState.updateAndGet { it.copy(notes = it.notes + note) }.notes

        sdk.capture(
            "note_created",
            mapOf("note_count" to notes.size, "is_pro" to state.isPro),
        )

        viewModelScope.launch {
            try {
                sdk.setPersonAttributes(
                    mapOf("plan" to state.planAttribute, "notes_created" to notes.size),
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitMessage("Could not record the note count: ${error.userMessage()}")
            }
        }
    }

    /** Removes a note locally. Nothing to tell Voidhash about. */
    fun deleteNote(id: String) {
        _uiState.update { state -> state.copy(notes = state.notes.filterNot { it.id == id }) }
    }

    /** Captures `export_requested`, then either exports or asks for an upgrade. */
    fun exportNotes(activity: Activity?) {
        val sdk = client ?: return
        viewModelScope.launch {
            val state = _uiState.value
            sdk.capture(
                "export_requested",
                mapOf("note_count" to state.notes.size, "is_pro" to state.isPro),
            )

            if (state.isPro) {
                emitMessage("Exported ${state.notes.size} notes")
            } else {
                requestUpgrade(activity, source = "export")
            }
        }
    }

    /** Buys [product] and refreshes entitlements. */
    fun purchase(activity: Activity?, product: VoidhashProduct) {
        val sdk = client ?: return
        if (activity == null) {
            viewModelScope.launch { emitMessage("Could not resolve the activity to purchase from") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(pendingProductId = product.slug) }
            sdk.capture(
                "checkout_started",
                mapOf("product_slug" to product.slug, "source" to "upgrade_screen"),
            )

            try {
                when (val result = sdk.purchase(activity, product)) {
                    is VoidhashPurchaseResult.Purchased -> {
                        refreshPerson()
                        val suffix = if (result.transaction.store == VoidhashStore.DEVELOPMENT) " (test purchase)" else ""
                        emitMessage("Purchased ${product.displayName}$suffix")
                    }
                    // Completes later; the person refreshes when it does (see `transactionUpdates`).
                    VoidhashPurchaseResult.Pending -> emitMessage("Your payment is pending")
                    // Backing out of the store sheet is an ordinary outcome, not a failure.
                    VoidhashPurchaseResult.Cancelled, VoidhashPurchaseResult.Disabled -> Unit
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitMessage("Purchase failed: ${error.userMessage()}")
            } finally {
                _uiState.update { it.copy(pendingProductId = null) }
            }
        }
    }

    /** Reconciles anything the store still reports for the signed-in account. */
    fun restorePurchases() {
        val sdk = client ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isRestoring = true) }
            try {
                // The restore answers with the refreshed person: no second read needed.
                val person = sdk.restorePurchases()
                _uiState.update { it.copy(person = person) }
                val restored = _uiState.value.isPro
                emitMessage(if (restored) "Pro restored" else "Nothing to restore")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitMessage("Restore failed: ${error.userMessage()}")
            } finally {
                _uiState.update { it.copy(isRestoring = false) }
            }
        }
    }

    /** Loads the store products configured for the project. */
    fun loadProducts() {
        val sdk = client ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingProducts = true) }
            try {
                // In the order asked for; a product the store does not return is null and
                // reported through `onDiagnostic` as PRODUCT_NOT_FOUND.
                val products = sdk.getProducts(PRODUCT_ORDER).filterNotNull()
                _uiState.update { it.copy(products = products, productsError = null) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                _uiState.update { it.copy(productsError = error.userMessage()) }
            } finally {
                _uiState.update { it.copy(isLoadingProducts = false) }
            }
        }
    }

    /** Aliases the anonymous identity onto [externalUserId] and writes the person attributes. */
    fun signIn(externalUserId: String, email: String, name: String) {
        val sdk = client ?: return
        val userId = externalUserId.trim()
        if (userId.isEmpty()) {
            viewModelScope.launch { emitMessage("A user id is required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isAccountBusy = true) }
            try {
                sdk.identify(
                    externalUserId = userId,
                    email = email.trim().ifBlank { null },
                    name = name.trim().ifBlank { null },
                )
                sdk.setPersonAttributes(
                    mapOf(
                        "plan" to _uiState.value.planAttribute,
                        "notes_created" to _uiState.value.notes.size,
                    ),
                )
                refreshPerson()
                refreshFlagsNow()
                emitMessage("Signed in as $userId")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitMessage("Sign in failed: ${error.userMessage()}")
            } finally {
                _uiState.update { it.copy(isAccountBusy = false) }
            }
        }
    }

    /** Clears the local identity; the next call runs as a fresh anonymous person. */
    fun signOut() {
        val sdk = client ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isAccountBusy = true) }
            try {
                sdk.reset()
                _uiState.update {
                    it.copy(person = null, distinctId = sdk.getDistinctId(), onboardingFlag = null)
                }
                refreshPerson()
                refreshFlagsNow()
                emitMessage("Signed out")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitMessage("Sign out failed: ${error.userMessage()}")
            } finally {
                _uiState.update { it.copy(isAccountBusy = false) }
            }
        }
    }

    /** Re-reads the person snapshot and the feature flag. */
    fun refreshAccount() {
        if (client == null) return
        viewModelScope.launch {
            _uiState.update { it.copy(isAccountBusy = true) }
            refreshPerson()
            refreshFlagsNow()
            _uiState.update { it.copy(isAccountBusy = false) }
        }
    }

    /** Sends everything still sitting in the analytics queue. */
    fun flushAnalytics() {
        val sdk = client ?: return
        viewModelScope.launch {
            try {
                sdk.flush()
                emitMessage("Analytics flushed")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitMessage("Flush failed: ${error.userMessage()}")
            }
        }
    }

    /**
     * Presents the flow published at [FLOW_LOCATION] and reacts to how it ended.
     *
     * This is the part worth copying. `presentFlow` returns once the flow is gone, with the
     * same [FlowResult] for every ending: its outcome and the flow's outputs. A flow that
     * cannot be shown is thrown as a [FlowException] instead. A location without a flow, or
     * one that cannot be loaded offline, is not an error the user should see — the app owns a
     * screen that sells the same thing.
     */
    private suspend fun requestUpgrade(activity: Activity?, source: String) {
        val sdk = client
        if (sdk == null || activity == null) {
            _events.emit(NimbusEvent.OpenUpgrade)
            return
        }

        _uiState.update { it.copy(isPresentingFlow = true) }
        sdk.capture("upgrade_requested", mapOf("location" to FLOW_LOCATION, "source" to source))
        val result = try {
            sdk.presentFlow(activity, FLOW_LOCATION)
        } catch (error: FlowException) {
            when (error.reason) {
                // Nothing published yet, or nothing cached while offline.
                FlowFailure.NOT_ASSIGNED, FlowFailure.UNAVAILABLE -> Unit
                // The flow itself could not be shown: worth a line in the log.
                FlowFailure.PRESENTATION_FAILED, FlowFailure.UNSUPPORTED_PACKAGE ->
                    Log.w(TAG, "Flow for \"$FLOW_LOCATION\" failed: ${error.description}")
                // Set-up problems a developer has to fix.
                FlowFailure.RENDERER_MISSING, FlowFailure.DISABLED ->
                    Log.e(TAG, "Flows are unavailable: ${error.description}")
            }
            _events.emit(NimbusEvent.OpenUpgrade)
            return
        } finally {
            _uiState.update { it.copy(isPresentingFlow = false) }
        }

        when (result.outcome) {
            FlowResult.PURCHASED -> {
                refreshPerson()
                emitMessage("Purchased ${result.productId}")
            }
            FlowResult.RESTORED -> {
                refreshPerson()
                emitMessage(if (_uiState.value.isPro) "Pro restored" else "Purchases restored")
            }
            FlowResult.DISMISSED -> Unit
            // An outcome the flow finished with, such as "completed".
            else -> {
                Log.i(TAG, "Flow ended with \"${result.outcome}\": ${result.output}")
                emitMessage("Flow finished: ${result.outcome}")
            }
        }
    }

    private suspend fun refreshPerson() {
        val sdk = client ?: return
        try {
            val person = sdk.getCurrentPerson(forceFetch = true)
            _uiState.update { it.copy(person = person, distinctId = sdk.getDistinctId()) }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            emitMessage("Could not load your account: ${error.userMessage()}")
        }
    }

    private suspend fun refreshFlagsNow() {
        val sdk = client ?: return
        try {
            val flags = sdk.getFeatureFlags(listOf(ONBOARDING_FLAG_KEY))
            _uiState.update { state ->
                state.copy(
                    onboardingFlag = flags.firstOrNull { it.key == ONBOARDING_FLAG_KEY },
                    flagError = null,
                )
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            _uiState.update { it.copy(flagError = error.userMessage()) }
        }
    }

    private suspend fun emitMessage(text: String) {
        _events.emit(NimbusEvent.Message(text))
    }

    companion object {
        /** Builds the view model from the client [NimbusApplication] configured. */
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val application = this[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]
                NimbusViewModel((application as NimbusApplication).voidhash)
            }
        }
    }
}

/** The part of an SDK error worth showing a user. */
fun Throwable.userMessage(): String = when (this) {
    is VoidhashException -> description
    else -> message ?: this::class.java.simpleName
}
