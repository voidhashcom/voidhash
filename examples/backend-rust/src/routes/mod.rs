//! HTTP surface. One module per route group.

mod events;
mod health;
mod me;
mod notes;
mod webhooks;

use axum::extract::{FromRequestParts, Query};
use axum::http::request::Parts;
use axum::routing::{get, post};
use axum::Router;
use serde::Deserialize;

use crate::error::ApiError;
use crate::state::SharedState;

/// Builds the Nimbus router.
pub fn router(state: SharedState) -> Router {
    Router::new()
        .route("/health", get(health::health))
        .route("/v1/me", get(me::me))
        .route("/v1/notes", get(notes::list).post(notes::create))
        .route("/v1/notes/export", get(notes::export))
        .route("/v1/events", post(events::capture))
        .route("/webhooks/voidhash", post(webhooks::receive))
        .with_state(state)
}

#[derive(Deserialize)]
struct DistinctIdQuery {
    #[serde(rename = "distinctId")]
    distinct_id: String,
}

/// The `?distinctId=…` query parameter every read route takes.
///
/// Nimbus trusts the query string because it has no session layer; a real
/// service would resolve the distinct id from the caller's access token and
/// never from user-controlled input.
pub struct DistinctId(pub String);

impl<S> FromRequestParts<S> for DistinctId
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let Query(query) = Query::<DistinctIdQuery>::try_from_uri(&parts.uri)
            .map_err(|_| ApiError::missing_distinct_id())?;

        let distinct_id = query.distinct_id.trim();
        if distinct_id.is_empty() {
            return Err(ApiError::missing_distinct_id());
        }
        Ok(Self(distinct_id.to_string()))
    }
}
