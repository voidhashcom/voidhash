//! Liveness. Deliberately never touches Voidhash: a health check that fails
//! when a third party is down takes your service out of the load balancer for
//! someone else's outage.

use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    status: &'static str,
}

/// `GET /health`
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}
