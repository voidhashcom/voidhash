//! Serving a [`ProviderHandler`] from an axum router (feature `axum`).

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{FromRequest, Request};
use axum::response::{IntoResponse, Response};

use super::{ProviderHandler, ProviderRequest, ProviderResponse};

impl ProviderHandler {
    /// A `POST` route serving this handler:
    ///
    /// ```no_run
    /// # fn example(handler: voidhash::provider::ProviderHandler) {
    /// let app: axum::Router = axum::Router::new().route("/voidhash/provider", handler.into_axum());
    /// # }
    /// ```
    pub fn into_axum<S>(self) -> axum::routing::MethodRouter<S>
    where
        S: Clone + Send + Sync + 'static,
    {
        let handler = Arc::new(self);
        axum::routing::post(
            move |request: ProviderRequest| async move { handler.handle(request).await },
        )
    }
}

impl<S: Send + Sync> FromRequest<S> for ProviderRequest {
    type Rejection = Response;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        let headers = request.headers().clone();
        let body = Bytes::from_request(request, state)
            .await
            .map_err(IntoResponse::into_response)?;
        Ok(Self {
            headers,
            body: body.to_vec(),
        })
    }
}

impl IntoResponse for ProviderResponse {
    fn into_response(self) -> Response {
        http::Response::<Vec<u8>>::from(self)
            .map(axum::body::Body::from)
            .into_response()
    }
}
