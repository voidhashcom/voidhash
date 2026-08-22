//! Client construction and resource APIs.

use crate::error::Error;
use crate::generated;
use crate::generated::types;

/// The production management API base URL.
pub const DEFAULT_BASE_URL: &str = "https://api.voidhash.com";
/// The production event ingestion base URL.
pub const DEFAULT_INGEST_URL: &str = "https://ingest.voidhash.com";
const SECRET_KEY_HEADER: &str = "x-secret-key";

/// Entry point of the Rust SDK. Create one with [`VoidhashClient::new`] or
/// [`VoidhashClient::builder`], then use the resource accessors:
///
/// ```no_run
/// # async fn example() -> Result<(), voidhash::Error> {
/// let client = voidhash::VoidhashClient::new("vh_sk_...")?;
/// let person = client.persons().get_by_distinct_id("user-123").await?;
/// # Ok(())
/// # }
/// ```
pub struct VoidhashClient {
    core: generated::Client,
    /// Shared transport. Its default headers carry the secret key and any
    /// caller-supplied extras, so ingestion — which authenticates on the same
    /// secret key — reuses it rather than building its own request.
    http: reqwest::Client,
    ingest_url: String,
    publishable_key: Option<String>,
}

/// Builder for [`VoidhashClient`].
pub struct ClientBuilder {
    secret_key: String,
    publishable_key: Option<String>,
    base_url: String,
    ingest_url: String,
    extra_headers: Vec<(String, String)>,
}

impl Default for ClientBuilder {
    fn default() -> Self {
        Self {
            secret_key: String::new(),
            publishable_key: None,
            base_url: DEFAULT_BASE_URL.to_string(),
            ingest_url: DEFAULT_INGEST_URL.to_string(),
            extra_headers: Vec::new(),
        }
    }
}

impl ClientBuilder {
    /// Sets the secret key (required).
    pub fn secret_key(mut self, key: impl Into<String>) -> Self {
        self.secret_key = key.into();
        self
    }

    /// Sets the publishable key (`vh_pk_...`). Optional: event capture
    /// authenticates on the secret key like every other resource, and a
    /// publishable key is only forwarded as the capture body `token` so that
    /// server-side captures match what the browser and mobile SDKs send.
    pub fn publishable_key(mut self, key: impl Into<String>) -> Self {
        self.publishable_key = Some(key.into());
        self
    }

    /// Overrides the management API base URL.
    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }

    /// Overrides the event ingestion base URL.
    pub fn ingest_url(mut self, url: impl Into<String>) -> Self {
        self.ingest_url = url.into();
        self
    }

    /// Sends an additional header with every request. The reserved
    /// x-secret-key header cannot be set here.
    pub fn header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.extra_headers.push((name.into(), value.into()));
        self
    }

    /// Builds the client.
    pub fn build(self) -> Result<VoidhashClient, Error> {
        if self.secret_key.trim().is_empty() {
            return Err(Error::Request("secret_key is required".to_string()));
        }

        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            SECRET_KEY_HEADER,
            reqwest::header::HeaderValue::from_str(&self.secret_key)
                .map_err(|error| Error::Request(format!("invalid secret key: {error}")))?,
        );
        for (name, value) in &self.extra_headers {
            if name.eq_ignore_ascii_case(SECRET_KEY_HEADER) {
                return Err(Error::Request(
                    "x-secret-key cannot be set explicitly".to_string(),
                ));
            }
            let name = reqwest::header::HeaderName::from_bytes(name.as_bytes())
                .map_err(|error| Error::Request(format!("invalid header name {name}: {error}")))?;
            let value = reqwest::header::HeaderValue::from_str(value).map_err(|error| {
                Error::Request(format!("invalid header value {value}: {error}"))
            })?;
            headers.insert(name, value);
        }

        let http = reqwest::ClientBuilder::new()
            .default_headers(headers)
            .build()?;
        let core = generated::Client::new_with_client(&self.base_url, http.clone());

        Ok(VoidhashClient {
            core,
            http,
            ingest_url: self.ingest_url,
            publishable_key: self.publishable_key,
        })
    }
}

impl VoidhashClient {
    /// Creates a client against the production API.
    pub fn new(secret_key: impl Into<String>) -> Result<Self, Error> {
        Self::builder().secret_key(secret_key).build()
    }

    /// Starts a customized client build.
    pub fn builder() -> ClientBuilder {
        ClientBuilder::default()
    }

    /// Session introspection.
    pub fn auth(&self) -> AuthApi<'_> {
        AuthApi { core: &self.core }
    }

    /// Secret API key management.
    pub fn api_keys(&self) -> ApiKeysApi<'_> {
        ApiKeysApi { core: &self.core }
    }

    /// Person records and entitlements.
    pub fn persons(&self) -> PersonsApi<'_> {
        PersonsApi { core: &self.core }
    }

    /// Entitlement perk definitions.
    pub fn perks(&self) -> PerksApi<'_> {
        PerksApi { core: &self.core }
    }

    /// Organizations.
    pub fn organizations(&self) -> OrganizationsApi<'_> {
        OrganizationsApi { core: &self.core }
    }

    /// Projects.
    pub fn projects(&self) -> ProjectsApi<'_> {
        ProjectsApi { core: &self.core }
    }

    /// Products and their perk associations.
    pub fn products(&self) -> ProductsApi<'_> {
        ProductsApi { core: &self.core }
    }

    /// Paywall locations and deploys.
    pub fn paywalls(&self) -> PaywallsApi<'_> {
        PaywallsApi { core: &self.core }
    }

    /// Project runtime schema.
    pub fn schema(&self) -> SchemaApi<'_> {
        SchemaApi { core: &self.core }
    }

    /// Server-to-server push notifications.
    pub fn notifications(&self) -> NotificationsApi<'_> {
        NotificationsApi { core: &self.core }
    }

    /// The authenticated user.
    pub fn users(&self) -> UsersApi<'_> {
        UsersApi { core: &self.core }
    }

    /// Webhook endpoints and deliveries.
    pub fn webhooks(&self) -> WebhooksApi<'_> {
        WebhooksApi { core: &self.core }
    }

    /// Analytics ingestion. Authenticates on the secret key, so no extra
    /// configuration is needed.
    pub fn event_capture(&self) -> EventCaptureApi<'_> {
        EventCaptureApi {
            http: &self.http,
            ingest_url: &self.ingest_url,
            publishable_key: self.publishable_key.as_deref(),
        }
    }
}

macro_rules! resource_api {
    ($name:ident) => {
        pub struct $name<'a> {
            core: &'a generated::Client,
        }
    };
}

resource_api!(AuthApi);
resource_api!(ApiKeysApi);
resource_api!(PersonsApi);
resource_api!(PerksApi);
resource_api!(OrganizationsApi);
resource_api!(ProjectsApi);
resource_api!(ProductsApi);
resource_api!(PaywallsApi);
resource_api!(SchemaApi);
resource_api!(NotificationsApi);
resource_api!(UsersApi);
resource_api!(WebhooksApi);

impl AuthApi<'_> {
    /// Validates the configured secret key and reports what it can access.
    pub async fn session(&self) -> Result<types::AuthSessionResponse, Error> {
        Ok(self.core.auth_session().await?.into_inner())
    }
}

impl ApiKeysApi<'_> {
    /// Issues a new secret key; the raw value is only returned here.
    pub async fn create(
        &self,
        params: &types::CreateSecretKeyBodyJsonEncoding,
    ) -> Result<types::ApiKeyWithRawKeyJsonEncoding, Error> {
        Ok(self
            .core
            .api_keys_create_secret_key(params)
            .await?
            .into_inner())
    }

    /// Lists all secret keys visible to the current key.
    pub async fn list(&self) -> Result<Vec<types::ApiKeyJsonEncoding>, Error> {
        Ok(self.core.api_keys_list_api_keys().await?.into_inner())
    }

    /// Fetches one secret key by id.
    pub async fn get(&self, api_key_id: &str) -> Result<types::ApiKeyJsonEncoding, Error> {
        Ok(self
            .core
            .api_keys_get_api_key_by_id(api_key_id)
            .await?
            .into_inner())
    }

    /// Revokes a secret key.
    pub async fn delete(&self, api_key_id: &str) -> Result<(), Error> {
        self.core.api_keys_delete_api_key(api_key_id).await?;
        Ok(())
    }

    /// Replaces a secret key and returns the new raw value.
    pub async fn rotate(
        &self,
        api_key_id: &str,
    ) -> Result<types::ApiKeyWithRawKeyJsonEncoding, Error> {
        Ok(self
            .core
            .api_keys_rotate_secret_key(api_key_id)
            .await?
            .into_inner())
    }
}

impl PersonsApi<'_> {
    /// Creates a person keyed by a distinct id.
    pub async fn create(
        &self,
        params: &types::CreatePersonBodyJsonEncoding,
    ) -> Result<types::PersonJsonEncoding, Error> {
        Ok(self.core.persons_create_person(params).await?.into_inner())
    }

    /// Lists all persons.
    pub async fn list(&self) -> Result<Vec<types::PersonJsonEncoding>, Error> {
        Ok(self.core.persons_list_persons().await?.into_inner())
    }

    /// Fetches one person by id.
    pub async fn get(&self, person_id: &str) -> Result<types::PersonJsonEncoding, Error> {
        Ok(self
            .core
            .persons_get_person_by_id(person_id)
            .await?
            .into_inner())
    }

    /// Writes profile fields and traits for the person with the given distinct
    /// id, creating the person when the distinct id is new.
    ///
    /// Traits describe the person and persist across events, so a fact like a
    /// subscription plan belongs here rather than repeated on every event's
    /// properties.
    pub async fn set_attributes(
        &self,
        params: &crate::PersonAttributes,
    ) -> Result<types::PersonJsonEncoding, Error> {
        // The generated trait map is a union type that is awkward to build by
        // hand, so `PersonAttributes` is converted through the generated body's
        // own `Deserialize` rather than constructed field by field.
        let body: types::SetPersonAttributesBodyJsonEncoding = serde_json::from_value(
            serde_json::to_value(params)
                .map_err(|error| Error::Request(format!("encoding person attributes: {error}")))?,
        )
        .map_err(|error| Error::Request(format!("encoding person attributes: {error}")))?;

        Ok(self
            .core
            .persons_set_person_attributes(&body)
            .await?
            .into_inner())
    }

    /// Fetches one person by their distinct id.
    pub async fn get_by_distinct_id(
        &self,
        distinct_id: &str,
    ) -> Result<types::PersonJsonEncoding, Error> {
        Ok(self
            .core
            .persons_get_person_by_distinct_id(distinct_id)
            .await?
            .into_inner())
    }

    /// Returns the person's entitlement grants. A 404 surfaces as
    /// [`Error::is_not_found`].
    pub async fn entitlements(
        &self,
        person_id: &str,
    ) -> Result<Vec<types::SdkEntitlementGrantJsonEncoding>, Error> {
        let response = self.core.persons_get_person_entitlements(person_id).await?;
        Ok(response.into_inner().grants)
    }

    /// Resolves a person by distinct id and returns their grants.
    pub async fn grants_by_distinct_id(
        &self,
        distinct_id: &str,
    ) -> Result<Vec<types::SdkEntitlementGrantJsonEncoding>, Error> {
        let person = self.get_by_distinct_id(distinct_id).await?;
        self.entitlements(&person.person_id).await
    }

    /// Reports whether the person holds an active grant for a perk selected
    /// by `perk_id` or `perk_slug`. Exactly one selector must be set. An
    /// unknown distinct id — or unknown slug — resolves to `false`;
    /// authentication and server failures still return errors.
    pub async fn has_active_perk(
        &self,
        distinct_id: &str,
        perk_id: Option<&str>,
        perk_slug: Option<&str>,
    ) -> Result<bool, Error> {
        match (perk_id.map(str::trim), perk_slug.map(str::trim)) {
            (Some(id), None) if !id.is_empty() => self.has_active_perk_by_id(distinct_id, id).await,
            (None, Some(slug)) if !slug.is_empty() => {
                self.has_active_perk_by_slug(distinct_id, slug).await
            }
            _ => Err(Error::Request(
                "has_active_perk requires exactly one of perk_id or perk_slug".to_string(),
            )),
        }
    }

    async fn has_active_perk_by_id(&self, distinct_id: &str, perk_id: &str) -> Result<bool, Error> {
        match self.grants_by_distinct_id(distinct_id).await {
            Ok(grants) => Ok(grants.iter().any(|grant| {
                grant.perk_id == perk_id
                    && grant.status == types::SdkEntitlementGrantJsonEncodingStatus::Active
            })),
            Err(error) if error.is_not_found() => Ok(false),
            Err(error) => Err(error),
        }
    }

    async fn has_active_perk_by_slug(
        &self,
        distinct_id: &str,
        perk_slug: &str,
    ) -> Result<bool, Error> {
        let perks = self.core.perks_list_perks().await?.into_inner();
        let Some(perk) = perks.iter().find(|perk| perk.slug == perk_slug) else {
            return Ok(false);
        };
        self.has_active_perk_by_id(distinct_id, &perk.id).await
    }
}

impl PerksApi<'_> {
    /// Lists all perks.
    pub async fn list(&self) -> Result<Vec<types::PerkJsonEncoding>, Error> {
        Ok(self.core.perks_list_perks().await?.into_inner())
    }
}

impl OrganizationsApi<'_> {
    /// Creates a new organization.
    pub async fn create(&self, name: &str) -> Result<types::OrganizationJsonEncoding, Error> {
        let params = types::CreateOrganizationBodyJsonEncoding {
            name: name.to_string(),
        };
        Ok(self
            .core
            .organizations_create_organization(&params)
            .await?
            .into_inner())
    }
}

impl ProjectsApi<'_> {
    /// Creates a project inside an organization.
    pub async fn create(
        &self,
        params: &types::CreateProjectBodyJsonEncoding,
    ) -> Result<types::ProjectJsonEncoding, Error> {
        Ok(self
            .core
            .projects_create_project(params)
            .await?
            .into_inner())
    }

    /// Lists all projects of an organization.
    pub async fn list(
        &self,
        organization_id: &str,
    ) -> Result<Vec<types::ProjectJsonEncoding>, Error> {
        Ok(self
            .core
            .projects_list_projects(organization_id)
            .await?
            .into_inner())
    }
}

impl ProductsApi<'_> {
    /// Lists all products.
    pub async fn list(&self) -> Result<Vec<types::ProductJsonEncoding>, Error> {
        Ok(self.core.products_list_products().await?.into_inner())
    }

    /// Lists every product-perk association of a product.
    pub async fn perks_by_product(
        &self,
        product_id: &str,
    ) -> Result<Vec<types::ProductPerkJsonEncoding>, Error> {
        Ok(self
            .core
            .product_perks_list_product_perks_by_product_id(product_id)
            .await?
            .into_inner())
    }
}

impl PaywallsApi<'_> {
    /// Lists all deployable paywall locations.
    pub async fn locations(&self) -> Result<Vec<types::PaywallLocationJsonEncoding>, Error> {
        Ok(self
            .core
            .paywall_locations_list_paywall_locations()
            .await?
            .into_inner())
    }

    /// Registers a new paywall deploy from a free-form manifest produced by
    /// the paywall compiler.
    pub async fn create_deploy(
        &self,
        manifest: &serde_json::Value,
    ) -> Result<types::CreatePaywallDeployResponseJsonEncoding, Error> {
        Ok(self
            .core
            .paywall_deploys_create_deploy(manifest)
            .await?
            .into_inner())
    }

    /// Uploads one binary blob for a pending deploy. The sha256 must be the
    /// lowercase hex digest of the blob contents.
    pub async fn upload_blob(
        &self,
        deploy_id: &str,
        sha256: &str,
        blob: Vec<u8>,
    ) -> Result<types::UploadPaywallDeployBlobResponseJsonEncoding, Error> {
        Ok(self
            .core
            .paywall_deploys_upload_blob(deploy_id, sha256, blob)
            .await?
            .into_inner())
    }

    /// Completes a pending deploy after all blobs are uploaded.
    pub async fn finalize_deploy(
        &self,
        deploy_id: &str,
    ) -> Result<types::FinalizePaywallDeployResponseJsonEncoding, Error> {
        Ok(self
            .core
            .paywall_deploys_finalize_deploy(deploy_id)
            .await?
            .into_inner())
    }
}

impl SchemaApi<'_> {
    /// Returns the full runtime schema of the project.
    pub async fn get(&self) -> Result<types::ProjectSchemaResponseJsonEncoding, Error> {
        Ok(self.core.schema_get_schema().await?.into_inner())
    }

    /// Returns the current schema revision.
    pub async fn version(&self) -> Result<types::SchemaVersionJsonEncoding, Error> {
        Ok(self.core.schema_get_schema_version().await?.into_inner())
    }
}

impl NotificationsApi<'_> {
    /// Delivers a push notification to the persons or distinct ids in params.
    pub async fn send(
        &self,
        notification: &types::SendNotificationBodyJsonEncoding,
    ) -> Result<types::SendNotificationResponseJsonEncoding, Error> {
        Ok(self
            .core
            .notifications_send_notification(notification)
            .await?
            .into_inner())
    }
}

impl UsersApi<'_> {
    /// Returns the user owning the current secret key.
    pub async fn current(&self) -> Result<types::UserJsonEncoding, Error> {
        Ok(self.core.users_get_user().await?.into_inner())
    }
}

impl WebhooksApi<'_> {
    /// Endpoint management operations.
    pub fn endpoints(&self) -> WebhookEndpointsApi<'_> {
        WebhookEndpointsApi { core: self.core }
    }

    /// Delivery inspection operations.
    pub fn deliveries(&self) -> WebhookDeliveriesApi<'_> {
        WebhookDeliveriesApi { core: self.core }
    }
}

resource_api!(WebhookEndpointsApi);
resource_api!(WebhookDeliveriesApi);

impl WebhookEndpointsApi<'_> {
    /// Registers a new webhook endpoint.
    pub async fn create(
        &self,
        params: &types::CreateWebhookEndpointBodyJsonEncoding,
    ) -> Result<types::WebhookEndpointJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_create_webhook_endpoint(params)
            .await?
            .into_inner())
    }

    /// Lists all registered webhook endpoints.
    pub async fn list(&self) -> Result<Vec<types::WebhookEndpointJsonEncoding>, Error> {
        Ok(self
            .core
            .webhooks_list_webhook_endpoints()
            .await?
            .into_inner())
    }

    /// Fetches one webhook endpoint.
    pub async fn get(
        &self,
        endpoint_id: &str,
    ) -> Result<types::WebhookEndpointJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_get_webhook_endpoint(endpoint_id)
            .await?
            .into_inner())
    }

    /// Patches an existing webhook endpoint.
    pub async fn update(
        &self,
        endpoint_id: &str,
        params: &types::UpdateWebhookEndpointBodyJsonEncoding,
    ) -> Result<types::WebhookEndpointJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_update_webhook_endpoint(endpoint_id, params)
            .await?
            .into_inner())
    }

    /// Removes a webhook endpoint.
    pub async fn delete(&self, endpoint_id: &str) -> Result<(), Error> {
        self.core
            .webhooks_delete_webhook_endpoint(endpoint_id)
            .await?;
        Ok(())
    }

    /// Replaces the signing secret of an endpoint.
    pub async fn rotate_secret(
        &self,
        endpoint_id: &str,
    ) -> Result<types::WebhookEndpointJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_rotate_webhook_secret(endpoint_id)
            .await?
            .into_inner())
    }

    /// Sends a signed test delivery to the endpoint.
    pub async fn test(
        &self,
        endpoint_id: &str,
    ) -> Result<types::WebhookDeliveryJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_test_webhook_endpoint(endpoint_id)
            .await?
            .into_inner())
    }
}

impl WebhookDeliveriesApi<'_> {
    /// Lists recent deliveries.
    pub async fn list(&self) -> Result<Vec<types::WebhookDeliveryJsonEncoding>, Error> {
        Ok(self
            .core
            .webhooks_list_webhook_deliveries()
            .await?
            .into_inner())
    }

    /// Fetches one delivery including its attempts.
    pub async fn get(
        &self,
        delivery_id: &str,
    ) -> Result<types::WebhookDeliveryWithAttemptsJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_get_webhook_delivery(delivery_id)
            .await?
            .into_inner())
    }

    /// Re-delivers a failed delivery.
    pub async fn retry(
        &self,
        delivery_id: &str,
    ) -> Result<types::WebhookDeliveryJsonEncoding, Error> {
        Ok(self
            .core
            .webhooks_retry_webhook_delivery(delivery_id)
            .await?
            .into_inner())
    }
}

/// Analytics ingestion API.
///
/// Capture requests authenticate with the client's secret key through the
/// `x-secret-key` header, exactly like every other resource.
pub struct EventCaptureApi<'a> {
    http: &'a reqwest::Client,
    ingest_url: &'a str,
    publishable_key: Option<&'a str>,
}

/// How ingestion handled a capture: how many events it took and how many it
/// discarded (for example because the project's admission policy rejects them).
#[derive(Clone, Copy, Debug, Default, serde::Deserialize)]
pub struct CaptureResult {
    /// Events queued for processing.
    pub accepted: u32,
    /// Events dropped at admission.
    pub rejected: u32,
}

impl EventCaptureApi<'_> {
    /// Posts one analytics event to the ingestion surface.
    pub async fn capture(&self, event: &crate::Event) -> Result<CaptureResult, Error> {
        let mut body = prepared_event(event)?;
        body.insert("sent_at".to_string(), sent_at());
        if let Some(token) = self.publishable_key {
            body.insert(
                "token".to_string(),
                serde_json::Value::String(token.to_string()),
            );
        }
        self.post("/i/v1/capture", &serde_json::Value::Object(body))
            .await
    }

    /// Posts several events in a single request. All events share one
    /// `sent_at` stamp; each still carries its own uuid and optional timestamp.
    /// An empty slice sends nothing and reports an empty result.
    pub async fn capture_batch(&self, events: &[crate::Event]) -> Result<CaptureResult, Error> {
        if events.is_empty() {
            return Ok(CaptureResult::default());
        }
        let prepared = events
            .iter()
            .map(prepared_event)
            .collect::<Result<Vec<_>, Error>>()?;
        let mut body = serde_json::Map::new();
        body.insert(
            "events".to_string(),
            serde_json::Value::Array(
                prepared
                    .into_iter()
                    .map(serde_json::Value::Object)
                    .collect(),
            ),
        );
        body.insert("sent_at".to_string(), sent_at());
        if let Some(token) = self.publishable_key {
            body.insert(
                "token".to_string(),
                serde_json::Value::String(token.to_string()),
            );
        }
        self.post("/i/v1/batch", &serde_json::Value::Object(body))
            .await
    }

    async fn post(&self, path: &str, body: &serde_json::Value) -> Result<CaptureResult, Error> {
        let response = self
            .http
            .post(format!("{}{path}", self.ingest_url))
            .json(body)
            .send()
            .await?;
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            // Ingestion errors carry the usual `_tag` discriminant plus a
            // coarser `code`; fall back to the latter when `_tag` is absent.
            let tag = serde_json::from_str::<serde_json::Value>(&body)
                .ok()
                .and_then(|value| {
                    value["_tag"]
                        .as_str()
                        .or_else(|| value["code"].as_str())
                        .map(str::to_string)
                })
                .unwrap_or_default();
            return Err(Error::Api {
                status: status.as_u16(),
                tag,
            });
        }

        response
            .json::<CaptureResult>()
            .await
            .map_err(|error| Error::Request(format!("decoding capture response: {error}")))
    }
}

/// Serializes an event and fills in a generated uuid when the caller left it
/// unset.
fn prepared_event(
    event: &crate::Event,
) -> Result<serde_json::Map<String, serde_json::Value>, Error> {
    let value = serde_json::to_value(event)
        .map_err(|error| Error::Request(format!("failed to encode event: {error}")))?;
    let serde_json::Value::Object(mut object) = value else {
        return Err(Error::Request(
            "event did not encode to an object".to_string(),
        ));
    };
    object
        .entry("uuid")
        .or_insert_with(|| serde_json::Value::String(uuid::Uuid::new_v4().to_string()));
    Ok(object)
}

fn sent_at() -> serde_json::Value {
    serde_json::Value::String(
        chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    )
}
