//! `GET /v1/me` — who the caller is and what they are entitled to.

use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::entitlements::{Freshness, Grant, Person};
use crate::error::ApiError;
use crate::routes::DistinctId;
use crate::state::SharedState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    distinct_id: String,
    /// `false` when Voidhash has never seen this distinct id.
    known: bool,
    pro: bool,
    person: Option<Person>,
    grants: Vec<Grant>,
    freshness: Freshness,
}

/// `GET /v1/me?distinctId=…`
///
/// An unknown distinct id is a free user with no grants, not a 404.
pub async fn me(
    State(state): State<SharedState>,
    DistinctId(distinct_id): DistinctId,
) -> Result<Json<MeResponse>, ApiError> {
    let resolved = state.entitlements.resolve(&distinct_id).await?;

    Ok(Json(MeResponse {
        distinct_id,
        known: resolved.entitlements.known,
        pro: resolved.entitlements.pro,
        person: resolved.entitlements.person,
        grants: resolved.entitlements.grants,
        freshness: resolved.freshness,
    }))
}
