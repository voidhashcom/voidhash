//! Shared application state.

use std::sync::Arc;
use std::time::Duration;

use voidhash::VoidhashClient;

use crate::analytics::Analytics;
use crate::entitlements::EntitlementCache;
use crate::notes::NoteStore;
use crate::webhooks::WebhookProcessor;

/// Everything a handler needs, built once at boot.
pub struct AppState {
    pub voidhash: Arc<VoidhashClient>,
    pub analytics: Analytics,
    pub entitlements: EntitlementCache,
    pub notes: NoteStore,
    pub webhooks: WebhookProcessor,
    /// The Acme Pay payment source's payment provider id, which its records
    /// are pushed under.
    pub acme_pay_payment_provider_id: Option<String>,
}

/// The state as handlers see it.
pub type SharedState = Arc<AppState>;

impl AppState {
    /// Wires the client, the store, the cache, analytics and the webhook
    /// processor together.
    pub fn new(
        voidhash: Arc<VoidhashClient>,
        analytics: Analytics,
        webhook_secret: Option<String>,
        acme_pay_payment_provider_id: Option<String>,
        entitlement_ttl: Duration,
    ) -> Self {
        Self {
            voidhash: Arc::clone(&voidhash),
            analytics,
            entitlements: EntitlementCache::new(voidhash, entitlement_ttl),
            notes: NoteStore::new(),
            webhooks: WebhookProcessor::new(webhook_secret),
            acme_pay_payment_provider_id,
        }
    }
}
