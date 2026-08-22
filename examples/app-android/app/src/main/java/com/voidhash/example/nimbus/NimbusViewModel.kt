package com.voidhash.example.nimbus

import android.app.Activity
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.voidhash.sdk.ANONYMOUS_DISTINCT_ID_PREFIX
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.api.FeatureFlag
import com.voidhash.sdk.api.VoidhashPerson
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashTransaction
import com.voidhash.sdk.paywall.PaywallListener
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

/** Paywall location the Notes screen asks for. */
const val PAYWALL_LOCATION = "onboarding"

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
    val isResolvingPaywall: Boolean = false,
    /** Store id of the product whose purchase is in flight, if any. */
    val pendingProductId: String? = null,
) {
    /** True while the person holds an active `pro` grant. */
    val isPro: Boolean get() = person?.activePerkIds?.contains(PRO_PERK_SLUG) == true

    /** Notes a free account may still create. */
    val notesRemaining: Int get() = (FREE_NOTE_LIMIT - notes.size).coerceAtLeast(0)

    /** False once a free account holds [FREE_NOTE_LIMIT] notes. */
    val canCreateNote: Boolean get() = isPro || notes.size < FREE_NOTE_LIMIT

    /** True once `identify` replaced the generated anonymous distinct id. */
    val isSignedIn: Boolean
        get() = distinctId.isNotEmpty() && !distinctId.startsWith(ANONYMOUS_DISTINCT_ID_PREFIX)

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

    /**
     * Reacts to the paywall the SDK presents.
     *
     * The SDK already captures the paywall's own analytics events, handles the
     * purchase and the restore, and never reports a user cancellation as a
     * failure — so all that is left here is refreshing entitlements.
     */
    private val paywallListener = object : PaywallListener {
        override fun onPurchaseCompleted(transaction: VoidhashTransaction) {
            viewModelScope.launch {
                refreshPerson()
                emitMessage("Purchased ${transaction.productId}")
            }
        }

        override fun onPurchaseFailed(error: Throwable) {
            viewModelScope.launch { emitMessage("Purchase failed: ${error.userMessage()}") }
        }

        override fun onRestoreCompleted() {
            viewModelScope.launch {
                refreshPerson()
                emitMessage("Purchases restored")
            }
        }

        override fun onEvent(name: String, properties: Map<String, Any?>) {
            Log.d(TAG, "Paywall event: $name $properties")
        }

        override fun onDismiss() {
            viewModelScope.launch { refreshPerson() }
        }
    }

    init {
        initialize()
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
            _uiState.update { it.copy(pendingProductId = product.id) }
            sdk.capture(
                "checkout_started",
                mapOf("product_slug" to product.slug, "source" to "upgrade_screen"),
            )

            try {
                val transaction = sdk.purchase(activity, product)
                refreshPerson()
                val suffix = if (transaction.isDevelopment) " (test purchase)" else ""
                emitMessage("Purchased ${product.displayName}$suffix")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                // Backing out of the store sheet is an ordinary outcome, not a
                // failure worth putting in front of the user.
                if (!error.isPurchaseCancellation()) {
                    emitMessage("Purchase failed: ${error.userMessage()}")
                }
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
                sdk.restorePurchases()
                refreshPerson()
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
                val products = sdk.getProducts().sortedBy { product ->
                    PRODUCT_ORDER.indexOf(product.slug).takeIf { it >= 0 } ?: PRODUCT_ORDER.size
                }
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
     * Asks for the paywall published at [PAYWALL_LOCATION], and falls back to
     * the app's own Upgrade screen when there is none.
     *
     * This is the part worth copying. `presentPaywall` returns `false` when the
     * backend has nothing showing for the location, and a project that has
     * never published one answers the resolve call with a 404, which surfaces
     * as a thrown [VoidhashException]. Both mean the same thing: there is no
     * remote paywall right now. Neither is an error the user should ever see —
     * the app owns a screen that sells the same thing.
     */
    private suspend fun requestUpgrade(activity: Activity?, source: String) {
        val sdk = client
        if (sdk == null || activity == null) {
            _events.emit(NimbusEvent.OpenUpgrade)
            return
        }

        _uiState.update { it.copy(isResolvingPaywall = true) }
        val presented = try {
            sdk.presentPaywall(activity, location = PAYWALL_LOCATION, listener = paywallListener)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            Log.i(TAG, "No paywall for \"$PAYWALL_LOCATION\": ${error.userMessage()}")
            false
        } finally {
            _uiState.update { it.copy(isResolvingPaywall = false) }
        }

        if (presented) {
            sdk.capture("paywall_viewed", mapOf("location" to PAYWALL_LOCATION, "source" to source))
        } else {
            _events.emit(NimbusEvent.OpenUpgrade)
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

/**
 * True when [this] is the SDK's user-cancelled purchase signal.
 *
 * Play Billing reports a cancellation as a plain `Error` whose message starts
 * with `USER_CANCELLED`, and the development store throws a
 * [VoidhashException] with the same code; either can arrive wrapped, so the
 * whole cause chain is walked — the same check the SDK's paywall coordinator
 * makes before it decides not to report a failure.
 */
fun Throwable.isPurchaseCancellation(): Boolean {
    var current: Throwable? = this
    var depth = 0
    while (current != null && depth < MAX_CAUSE_DEPTH) {
        if (current.message.orEmpty().startsWith("USER_CANCELLED")) return true
        current = current.cause
        depth++
    }
    return false
}

/** The part of an SDK error worth showing a user. */
fun Throwable.userMessage(): String = when (this) {
    is VoidhashException -> description
    else -> message ?: this::class.java.simpleName
}

/** Bounds the cause walk: a self-referencing cause chain must not hang the UI. */
private const val MAX_CAUSE_DEPTH = 8
