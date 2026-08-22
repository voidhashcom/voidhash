//! Nimbus — the Voidhash Rust SDK reference backend.
//!
//! A notes service with a free tier of three notes and a `pro` perk that
//! unlocks unlimited notes plus export. See `README.md` for the routes.

mod analytics;
mod entitlements;
mod error;
mod notes;
mod routes;
mod state;
mod webhooks;

use std::process::ExitCode;
use std::sync::Arc;

use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;
use voidhash::VoidhashClient;

use crate::analytics::Analytics;
use crate::entitlements::CACHE_TTL;
use crate::state::AppState;

/// Boot configuration, read from the environment.
struct Config {
    secret_key: String,
    webhook_secret: Option<String>,
    base_url: Option<String>,
    ingest_url: String,
    port: u16,
}

impl Config {
    /// Reads and validates the environment. Everything that can be wrong is
    /// wrong before the listener opens, not on the first request.
    fn from_env() -> Result<Self, String> {
        let secret_key = non_empty("VOIDHASH_SECRET_KEY").ok_or_else(|| {
            "VOIDHASH_SECRET_KEY is not set.\n\
             Create one in Studio under Project settings -> API keys (it starts with \"vh_sk_\") \
             and export it before starting the server:\n\
             \n    export VOIDHASH_SECRET_KEY=vh_sk_...\n"
                .to_string()
        })?;

        if !secret_key.starts_with("vh_sk_") {
            tracing::warn!(
                "VOIDHASH_SECRET_KEY does not start with \"vh_sk_\"; \
                 publishable keys (vh_pk_) cannot read entitlements"
            );
        }

        let port = match non_empty("PORT") {
            Some(value) => value
                .parse()
                .map_err(|_| format!("PORT must be a number between 1 and 65535, got {value:?}"))?,
            None => 8080,
        };

        Ok(Self {
            secret_key,
            webhook_secret: non_empty("VOIDHASH_WEBHOOK_SECRET"),
            base_url: non_empty("VOIDHASH_BASE_URL"),
            ingest_url: non_empty("VOIDHASH_INGEST_URL")
                .unwrap_or_else(|| voidhash::DEFAULT_INGEST_URL.to_string()),
            port,
        })
    }
}

fn non_empty(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,voidhash_example_backend_rust=debug")),
        )
        .init();

    let config = match Config::from_env() {
        Ok(config) => config,
        Err(message) => {
            eprintln!("nimbus: {message}");
            return ExitCode::FAILURE;
        }
    };

    match serve(config).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("nimbus: {error}");
            ExitCode::FAILURE
        }
    }
}

async fn serve(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let mut builder = VoidhashClient::builder()
        .secret_key(config.secret_key)
        .ingest_url(config.ingest_url.clone());
    if let Some(base_url) = &config.base_url {
        // Only the management API moves with this; analytics ingestion is a
        // separate origin, configured through `VOIDHASH_INGEST_URL`.
        builder = builder.base_url(base_url.clone());
    }
    let client = Arc::new(builder.build()?);

    if config.webhook_secret.is_none() {
        tracing::warn!(
            "VOIDHASH_WEBHOOK_SECRET is not set; POST /webhooks/voidhash will reject deliveries"
        );
    }

    let analytics = Analytics::new(Arc::clone(&client));

    let state = Arc::new(AppState::new(
        client,
        analytics,
        config.webhook_secret,
        CACHE_TTL,
    ));
    let listener = TcpListener::bind(("0.0.0.0", config.port)).await?;

    tracing::info!(
        address = %listener.local_addr()?,
        base_url = config.base_url.as_deref().unwrap_or(voidhash::DEFAULT_BASE_URL),
        "nimbus listening"
    );

    axum::serve(listener, routes::router(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        tracing::error!(%error, "failed to install the ctrl-c handler");
        return;
    }
    tracing::info!("shutting down");
}
