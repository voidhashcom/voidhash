//! Entitlement resolution with a short read-through cache.
//!
//! Two behaviours here are the whole point of the file:
//!
//! 1. **The cache is short (60s), not clever.** Access checks sit on every
//!    request; a per-request round trip to Voidhash is a latency floor you do
//!    not need. 60s is short enough that a webhook-driven invalidation is a
//!    nicety rather than a requirement.
//! 2. **Failure is not denial.** A transport error or a `5xx` means *unknown*.
//!    Serving the last known answer past its TTL is correct; downgrading a
//!    paying customer to the free tier because a network hop flapped is not.
//!    A `404` is a different thing entirely: it is a definite "no such person",
//!    so it is cached like any other answer.

use std::collections::HashMap;
use std::sync::{Arc, PoisonError, RwLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use voidhash::generated::types::{
    PersonJsonEncoding, SdkEntitlementGrantJsonEncoding, SdkEntitlementGrantJsonEncodingStatus,
};
use voidhash::VoidhashClient;

use crate::error::ApiError;

/// Perk slug that unlocks Nimbus Pro.
pub const PRO_PERK_SLUG: &str = "pro";

/// How long a resolved answer stays fresh.
pub const CACHE_TTL: Duration = Duration::from_secs(60);

/// One entitlement grant, flattened for the wire.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Grant {
    pub perk_id: String,
    pub status: String,
    pub source: String,
    pub source_id: Option<String>,
    pub expires_at: Option<String>,
}

impl From<SdkEntitlementGrantJsonEncoding> for Grant {
    fn from(grant: SdkEntitlementGrantJsonEncoding) -> Self {
        Self {
            perk_id: grant.perk_id,
            status: grant.status.to_string(),
            source: grant.source.to_string(),
            source_id: grant.source_id,
            expires_at: grant.expires_at,
        }
    }
}

/// The person record Voidhash holds for a distinct id.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub person_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
}

impl From<PersonJsonEncoding> for Person {
    fn from(person: PersonJsonEncoding) -> Self {
        Self {
            person_id: person.person_id,
            email: person.email,
            name: person.name,
        }
    }
}

/// Everything the service needs to know about a caller.
#[derive(Clone, Debug, Serialize, Default)]
pub struct Entitlements {
    /// `false` when Voidhash has never seen this distinct id.
    pub known: bool,
    /// Whether an active `pro` grant is present.
    pub pro: bool,
    pub person: Option<Person>,
    pub grants: Vec<Grant>,
}

/// Where a resolved answer came from. Surfaced in responses so the cache is
/// observable from `curl` instead of only from the logs.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Freshness {
    /// Just fetched from Voidhash.
    Fresh,
    /// Served from a cache entry that is still inside its TTL.
    Cached,
    /// Served past its TTL because Voidhash could not be reached.
    Stale,
}

/// A resolved answer plus its provenance.
#[derive(Clone, Debug)]
pub struct Resolved {
    pub entitlements: Entitlements,
    pub freshness: Freshness,
}

struct Entry {
    value: Entitlements,
    fetched_at: Instant,
}

/// Read-through cache in front of the Voidhash entitlement lookup.
pub struct EntitlementCache {
    client: Arc<VoidhashClient>,
    ttl: Duration,
    entries: RwLock<HashMap<String, Entry>>,
    pro_perk_id: RwLock<Option<String>>,
}

impl EntitlementCache {
    /// Builds a cache over `client` with the given entry lifetime.
    pub fn new(client: Arc<VoidhashClient>, ttl: Duration) -> Self {
        Self {
            client,
            ttl,
            entries: RwLock::new(HashMap::new()),
            pro_perk_id: RwLock::new(None),
        }
    }

    /// Resolves `distinct_id`, hitting Voidhash only when nothing fresh is
    /// cached.
    ///
    /// Errors only when the answer is genuinely unknown: Voidhash is
    /// unreachable and this process has never resolved the caller.
    pub async fn resolve(&self, distinct_id: &str) -> Result<Resolved, ApiError> {
        if let Some(value) = self.cached(distinct_id, self.ttl) {
            return Ok(Resolved {
                entitlements: value,
                freshness: Freshness::Cached,
            });
        }

        match self.fetch(distinct_id).await {
            Ok(entitlements) => {
                self.store(distinct_id, entitlements.clone());
                Ok(Resolved {
                    entitlements,
                    freshness: Freshness::Fresh,
                })
            }
            Err(error) if is_unknown(&error) => match self.cached(distinct_id, Duration::MAX) {
                Some(value) => {
                    tracing::warn!(
                        distinct_id,
                        %error,
                        "entitlement lookup failed; serving the stale cached answer"
                    );
                    Ok(Resolved {
                        entitlements: value,
                        freshness: Freshness::Stale,
                    })
                }
                None => {
                    tracing::error!(distinct_id, %error, "entitlement lookup failed with no cached answer");
                    Err(ApiError::entitlements_unavailable())
                }
            },
            Err(error) => Err(error.into()),
        }
    }

    /// Drops the cached answer for `distinct_id`. Called from the webhook
    /// handler so a purchase is reflected before the TTL lapses.
    pub fn invalidate(&self, distinct_id: &str) {
        self.entries
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(distinct_id);
    }

    fn cached(&self, distinct_id: &str, max_age: Duration) -> Option<Entitlements> {
        let entries = self.entries.read().unwrap_or_else(PoisonError::into_inner);
        let entry = entries.get(distinct_id)?;
        (entry.fetched_at.elapsed() < max_age).then(|| entry.value.clone())
    }

    fn store(&self, distinct_id: &str, value: Entitlements) {
        self.entries
            .write()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(
                distinct_id.to_string(),
                Entry {
                    value,
                    fetched_at: Instant::now(),
                },
            );
    }

    async fn fetch(&self, distinct_id: &str) -> Result<Entitlements, voidhash::Error> {
        // `client.persons().has_active_perk(distinct_id, None, Some("pro"))` is
        // the one-line version of everything below, but it answers only
        // `bool`. GET /v1/me has to return the person record and the grants
        // too, so the two calls are made here and cached together.
        let person = match self.client.persons().get_by_distinct_id(distinct_id).await {
            Ok(person) => person,
            // A distinct id Voidhash has never seen is a free user, not an
            // error. This is a definite answer, so it gets cached.
            Err(error) if error.is_not_found() => return Ok(Entitlements::default()),
            Err(error) => return Err(error),
        };

        let grants = match self.client.persons().entitlements(&person.person_id).await {
            Ok(grants) => grants,
            Err(error) if error.is_not_found() => Vec::new(),
            Err(error) => return Err(error),
        };

        let pro_perk_id = self.pro_perk_id().await?;
        let pro = grants.iter().any(|grant| {
            grant.status == SdkEntitlementGrantJsonEncodingStatus::Active
                && Some(&grant.perk_id) == pro_perk_id.as_ref()
        });

        Ok(Entitlements {
            known: true,
            pro,
            person: Some(person.into()),
            grants: grants.into_iter().map(Grant::from).collect(),
        })
    }

    /// Resolves the `pro` perk slug to its id, once. Perk definitions are
    /// project configuration, not per-user state, so this is memoised for the
    /// lifetime of the process instead of sharing the entitlement TTL.
    async fn pro_perk_id(&self) -> Result<Option<String>, voidhash::Error> {
        let cached = self
            .pro_perk_id
            .read()
            .unwrap_or_else(PoisonError::into_inner)
            .clone();
        if cached.is_some() {
            return Ok(cached);
        }

        let perks = self.client.perks().list().await?;
        let resolved = perks
            .into_iter()
            .find(|perk| perk.slug == PRO_PERK_SLUG)
            .map(|perk| perk.id);

        if let Some(id) = &resolved {
            *self
                .pro_perk_id
                .write()
                .unwrap_or_else(PoisonError::into_inner) = Some(id.clone());
        } else {
            tracing::warn!(
                slug = PRO_PERK_SLUG,
                "no perk with that slug exists in the project; every caller resolves as free"
            );
        }

        Ok(resolved)
    }
}

/// Whether a failure means "unknown" rather than "denied".
fn is_unknown(error: &voidhash::Error) -> bool {
    match error {
        voidhash::Error::Transport(_) => true,
        voidhash::Error::Api { status, .. } => *status >= 500,
        voidhash::Error::Request(_) => false,
    }
}
