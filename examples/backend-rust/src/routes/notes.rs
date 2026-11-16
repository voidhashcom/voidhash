//! `/v1/notes` — the free-quota and premium-gate routes.

use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map};

use crate::entitlements::Freshness;
use crate::error::ApiError;
use crate::notes::{Note, FREE_NOTE_LIMIT};
use crate::routes::DistinctId;
use crate::state::SharedState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    distinct_id: String,
    pro: bool,
    /// `null` for Pro accounts, which are unlimited.
    limit: Option<usize>,
    /// `null` for Pro accounts.
    remaining: Option<usize>,
    freshness: Freshness,
    notes: Vec<Note>,
}

/// `GET /v1/notes?distinctId=…`
pub async fn list(
    State(state): State<SharedState>,
    DistinctId(distinct_id): DistinctId,
) -> Result<Json<ListResponse>, ApiError> {
    let resolved = state.entitlements.resolve(&distinct_id).await?;
    let pro = resolved.entitlements.pro;

    Ok(Json(ListResponse {
        limit: (!pro).then_some(FREE_NOTE_LIMIT),
        remaining: state.notes.remaining(&distinct_id, pro),
        freshness: resolved.freshness,
        notes: state.notes.list(&distinct_id),
        distinct_id,
        pro,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteBody {
    distinct_id: String,
    title: String,
    #[serde(default)]
    body: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResponse {
    note: Note,
    pro: bool,
    limit: Option<usize>,
    remaining: Option<usize>,
}

/// `POST /v1/notes`
///
/// Rejects with `403 note_limit_reached` once a free account holds
/// [`FREE_NOTE_LIMIT`] notes, then captures `note_created`.
pub async fn create(
    State(state): State<SharedState>,
    body: Result<Json<CreateNoteBody>, JsonRejection>,
) -> Result<(StatusCode, Json<CreateResponse>), ApiError> {
    let Json(body) = body?;

    let distinct_id = body.distinct_id.trim();
    if distinct_id.is_empty() {
        return Err(ApiError::invalid_body("\"distinctId\" is required"));
    }
    let title = body.title.trim();
    if title.is_empty() {
        return Err(ApiError::invalid_body("\"title\" must not be empty"));
    }

    let resolved = state.entitlements.resolve(distinct_id).await?;
    let pro = resolved.entitlements.pro;
    if !pro && state.notes.count(distinct_id) >= FREE_NOTE_LIMIT {
        return Err(ApiError::note_limit_reached(FREE_NOTE_LIMIT));
    }

    let note = state
        .notes
        .create(distinct_id, title.to_string(), body.body.clone());
    let total = state.notes.count(distinct_id);

    state
        .analytics
        .capture_best_effort(
            distinct_id,
            "note_created",
            Map::from_iter([("note_id".to_string(), json!(note.id))]),
        )
        .await;
    // `notes_created` and `plan` describe the person, not this one event, so
    // they are written as person traits instead of repeated on every capture.
    state
        .analytics
        .set_attributes_best_effort(
            distinct_id,
            Map::from_iter([
                ("notes_created".to_string(), json!(total)),
                ("plan".to_string(), json!(plan(pro))),
            ]),
        )
        .await;

    Ok((
        StatusCode::CREATED,
        Json(CreateResponse {
            note,
            pro,
            limit: (!pro).then_some(FREE_NOTE_LIMIT),
            remaining: state.notes.remaining(distinct_id, pro),
        }),
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResponse {
    distinct_id: String,
    exported_at: String,
    count: usize,
    notes: Vec<Note>,
}

/// `GET /v1/notes/export?distinctId=…`
///
/// Pro only. Rejects with `402 premium_required`, then captures
/// `export_requested`.
pub async fn export(
    State(state): State<SharedState>,
    DistinctId(distinct_id): DistinctId,
) -> Result<Json<ExportResponse>, ApiError> {
    let resolved = state.entitlements.resolve(&distinct_id).await?;
    if !resolved.entitlements.pro {
        // The paywall belongs to the client: the server's job is to say no
        // with a code the app can map to the `onboarding` paywall.
        return Err(ApiError::premium_required());
    }

    let notes = state.notes.list(&distinct_id);
    state
        .analytics
        .capture_best_effort(
            &distinct_id,
            "export_requested",
            Map::from_iter([("note_count".to_string(), json!(notes.len()))]),
        )
        .await;
    state
        .analytics
        .set_attributes_best_effort(
            &distinct_id,
            Map::from_iter([("plan".to_string(), json!("pro"))]),
        )
        .await;

    Ok(Json(ExportResponse {
        distinct_id,
        exported_at: chrono::Utc::now().to_rfc3339(),
        count: notes.len(),
        notes,
    }))
}

fn plan(pro: bool) -> &'static str {
    if pro {
        "pro"
    } else {
        "free"
    }
}
