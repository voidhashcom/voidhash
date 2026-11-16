//! Client construction and resource APIs.

use crate::error::Error;
use crate::generated;
use crate::generated::types;

/// The production management API base URL.
pub const DEFAULT_BASE_URL: &str = "https://api.voidhash.com";
/// The production event ingestion base URL.
pub const DEFAULT_INGEST_URL: &str = "https://ingest.voidhash.com";
/// Event capture authenticates on the secret key in this header; the
/// management API takes it as the `Authorization` bearer credential.
const SECRET_KEY_HEADER: &str = "x-secret-key";
/// The largest page the API serves, used where the SDK reads a whole list.
const MAX_PAGE_SIZE: std::num::NonZeroU64 = std::num::NonZeroU64::new(100).unwrap();

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
///
/// Project resources act on the project set with
/// [`ClientBuilder::project_id`]. Without one, the first project call reads
/// the secret key's project from the session and the client keeps it.
pub struct VoidhashClient {
    /// Management API client; its transport sends the secret key as the
    /// `Authorization` bearer credential.
    pub(crate) core: generated::Client,
    /// Ingestion transport; it sends the secret key as `x-secret-key`.
    ingest_http: reqwest::Client,
    ingest_url: String,
    publishable_key: Option<String>,
    project_id: tokio::sync::OnceCell<String>,
}

/// Builder for [`VoidhashClient`].
pub struct ClientBuilder {
    secret_key: String,
    publishable_key: Option<String>,
    project_id: Option<String>,
    base_url: String,
    ingest_url: String,
    extra_headers: Vec<(String, String)>,
}

impl Default for ClientBuilder {
    fn default() -> Self {
        Self {
            secret_key: String::new(),
            publishable_key: None,
            project_id: None,
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

    /// Sets the project that project resources act on. Optional for a
    /// project secret key, which belongs to one project: without it the
    /// client reads that project from the session on its first project call.
    /// Required for a credential that can use several projects.
    pub fn project_id(mut self, project_id: impl Into<String>) -> Self {
        self.project_id = Some(project_id.into());
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

    /// Sends an additional header with every request. The credential
    /// headers, `authorization` and `x-secret-key`, cannot be set here.
    pub fn header(mut self, name: impl Into<String>, value: impl Into<String>) -> Self {
        self.extra_headers.push((name.into(), value.into()));
        self
    }

    /// Builds the client. Makes no network calls.
    pub fn build(self) -> Result<VoidhashClient, Error> {
        if self.secret_key.trim().is_empty() {
            return Err(Error::Request("secret_key is required".to_string()));
        }
        let project_id = match self.project_id {
            Some(project_id) if project_id.trim().is_empty() => {
                return Err(Error::Request(
                    "project_id cannot be empty; leave it unset to use the secret key's project"
                        .to_string(),
                ));
            }
            project_id => project_id,
        };

        let mut headers = reqwest::header::HeaderMap::new();
        for (name, value) in &self.extra_headers {
            let name = reqwest::header::HeaderName::from_bytes(name.as_bytes())
                .map_err(|error| Error::Request(format!("invalid header name {name}: {error}")))?;
            if name == reqwest::header::AUTHORIZATION || name == SECRET_KEY_HEADER {
                return Err(Error::Request(format!(
                    "{name} carries the secret key and cannot be set explicitly"
                )));
            }
            let value = reqwest::header::HeaderValue::from_str(value).map_err(|error| {
                Error::Request(format!("invalid header value {value}: {error}"))
            })?;
            headers.insert(name, value);
        }

        let mut management_headers = headers.clone();
        management_headers.insert(
            reqwest::header::AUTHORIZATION,
            sensitive_header_value(&format!("Bearer {}", self.secret_key))?,
        );
        let mut ingest_headers = headers;
        ingest_headers.insert(SECRET_KEY_HEADER, sensitive_header_value(&self.secret_key)?);

        let management_http = reqwest::ClientBuilder::new()
            .default_headers(management_headers)
            .build()?;
        let ingest_http = reqwest::ClientBuilder::new()
            .default_headers(ingest_headers)
            .build()?;

        Ok(VoidhashClient {
            core: generated::Client::new_with_client(&self.base_url, management_http),
            ingest_http,
            ingest_url: self.ingest_url,
            publishable_key: self.publishable_key,
            project_id: tokio::sync::OnceCell::new_with(project_id),
        })
    }
}

fn sensitive_header_value(value: &str) -> Result<reqwest::header::HeaderValue, Error> {
    let mut value = reqwest::header::HeaderValue::from_str(value)
        .map_err(|error| Error::Request(format!("invalid secret key: {error}")))?;
    value.set_sensitive(true);
    Ok(value)
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

    /// The project that project resources act on: the configured one, or the
    /// credential's only project, read from the session by the first call
    /// that needs it and kept for the client's lifetime. Concurrent first
    /// calls share one lookup; a failed lookup is retried by the next call.
    pub(crate) async fn project_id(&self) -> Result<&str, Error> {
        let project_id = self
            .project_id
            .get_or_try_init(|| async {
                let session = self.core.session_get().await?.into_inner();
                match session.projects.as_slice() {
                    [project] => Ok(project.id.clone()),
                    projects => Err(Error::Request(format!(
                        "the secret key can use {} projects, so the client cannot choose one; \
                         set the project with ClientBuilder::project_id",
                        projects.len()
                    ))),
                }
            })
            .await?;
        Ok(project_id)
    }

    /// The credential the client authenticates with.
    pub fn auth(&self) -> AuthApi<'_> {
        AuthApi { client: self }
    }

    /// API key management.
    pub fn api_keys(&self) -> ApiKeysApi<'_> {
        ApiKeysApi { client: self }
    }

    /// Person records and entitlements.
    pub fn persons(&self) -> PersonsApi<'_> {
        PersonsApi { client: self }
    }

    /// Entitlement perk definitions.
    pub fn perks(&self) -> PerksApi<'_> {
        PerksApi { client: self }
    }

    /// Organizations.
    pub fn organizations(&self) -> OrganizationsApi<'_> {
        OrganizationsApi { client: self }
    }

    /// Projects.
    pub fn projects(&self) -> ProjectsApi<'_> {
        ProjectsApi { client: self }
    }

    /// Products and the perks they grant.
    pub fn products(&self) -> ProductsApi<'_> {
        ProductsApi { client: self }
    }

    /// Paywall locations.
    pub fn paywalls(&self) -> PaywallsApi<'_> {
        PaywallsApi { client: self }
    }

    /// Project runtime schema.
    pub fn schema(&self) -> SchemaApi<'_> {
        SchemaApi { client: self }
    }

    /// Server-to-server push notifications.
    pub fn notifications(&self) -> NotificationsApi<'_> {
        NotificationsApi { client: self }
    }

    /// The signed-in person.
    pub fn users(&self) -> UsersApi<'_> {
        UsersApi { client: self }
    }

    /// Webhook endpoints and deliveries.
    pub fn webhooks(&self) -> WebhooksApi<'_> {
        WebhooksApi { client: self }
    }

    /// Records payments and subscription state for a payment source, a
    /// provider Voidhash does not integrate natively, named by its payment
    /// provider id.
    pub fn payment_source(
        &self,
        payment_provider_id: impl Into<String>,
    ) -> crate::payment_sources::PaymentSourceApi<'_> {
        crate::payment_sources::PaymentSourceApi {
            client: self,
            payment_provider_id: payment_provider_id.into(),
        }
    }

    /// Analytics ingestion. Authenticates on the secret key, so no extra
    /// configuration is needed.
    pub fn event_capture(&self) -> EventCaptureApi<'_> {
        EventCaptureApi {
            http: &self.ingest_http,
            ingest_url: &self.ingest_url,
            publishable_key: self.publishable_key.as_deref(),
        }
    }
}

macro_rules! resource_api {
    ($name:ident) => {
        pub struct $name<'a> {
            client: &'a VoidhashClient,
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
    /// Validates the configured secret key and reports what it can access:
    /// its kind and the organizations and projects it can use.
    pub async fn session(&self) -> Result<types::SessionJsonEncoding, Error> {
        Ok(self.client.core.session_get().await?.into_inner())
    }
}

impl ApiKeysApi<'_> {
    /// Issues a new secret key; the raw value is only returned here. Only a
    /// person signed in to the dashboard can create keys, so a secret key
    /// fails with `permission_denied`.
    pub async fn create(
        &self,
        params: &types::CreateApiKeyBodyJsonEncoding,
    ) -> Result<types::ApiKeyWithRawKeyJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .api_keys_create(project_id, params)
            .await?
            .into_inner())
    }

    /// Lists the first page of the project's keys, publishable keys first.
    pub async fn list(&self) -> Result<Vec<types::ApiKeyJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .api_keys_list(project_id, None, None, None, None)
            .await?
            .into_inner()
            .data)
    }

    /// Fetches one key by id.
    pub async fn get(&self, api_key_id: &str) -> Result<types::ApiKeyJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .api_keys_get(project_id, api_key_id)
            .await?
            .into_inner())
    }

    /// Revokes a secret key.
    pub async fn delete(&self, api_key_id: &str) -> Result<(), Error> {
        let project_id = self.client.project_id().await?;
        self.client
            .core
            .api_keys_delete(project_id, api_key_id)
            .await?;
        Ok(())
    }

    /// Replaces a secret key and returns the new raw value. The previous value
    /// stops working immediately.
    pub async fn rotate(
        &self,
        api_key_id: &str,
    ) -> Result<types::ApiKeyWithRawKeyJsonEncoding, Error> {
        self.rotate_after(api_key_id, None).await
    }

    /// Replaces a secret key and returns the new raw value. The previous value
    /// keeps working for `overlap` (up to 7 days, whole seconds), so deployments
    /// can switch to the new key first.
    pub async fn rotate_with_overlap(
        &self,
        api_key_id: &str,
        overlap: std::time::Duration,
    ) -> Result<types::ApiKeyWithRawKeyJsonEncoding, Error> {
        let seconds = i64::try_from(overlap.as_secs())
            .map_err(|_| Error::Request("overlap is longer than the API accepts".to_string()))?;
        self.rotate_after(api_key_id, Some(seconds)).await
    }

    async fn rotate_after(
        &self,
        api_key_id: &str,
        overlap_seconds: Option<i64>,
    ) -> Result<types::ApiKeyWithRawKeyJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        let body = types::RotateApiKeyBodyJsonEncoding { overlap_seconds };
        Ok(self
            .client
            .core
            .api_keys_rotate(project_id, api_key_id, &body)
            .await?
            .into_inner())
    }
}

impl PersonsApi<'_> {
    /// Creates a person keyed by a distinct id. A person who already has the
    /// distinct id is updated with the given email and name and returned.
    pub async fn create(
        &self,
        params: &types::CreatePersonBodyJsonEncoding,
    ) -> Result<types::PersonJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .persons_create(project_id, params)
            .await?
            .into_inner())
    }

    /// Lists the first page of persons, newest first.
    pub async fn list(&self) -> Result<Vec<types::PersonJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .persons_list(project_id, None, None, None, None)
            .await?
            .into_inner()
            .data)
    }

    /// Fetches one person by id.
    pub async fn get(&self, person_id: &str) -> Result<types::PersonJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .persons_get(project_id, person_id)
            .await?
            .into_inner())
    }

    /// Writes profile fields and traits for the person with the given distinct
    /// id. The distinct id is resolved to a person first, so an unknown
    /// distinct id fails with [`Error::is_not_found`] rather than creating a
    /// person; use [`PersonsApi::create`] for that.
    ///
    /// Traits describe the person and persist across events, so a fact like a
    /// subscription plan belongs here rather than repeated on every event's
    /// properties.
    pub async fn set_attributes(
        &self,
        params: &crate::PersonAttributes,
    ) -> Result<types::PersonJsonEncoding, Error> {
        let person = self.get_by_distinct_id(&params.distinct_id).await?;
        let body = types::UpdatePersonBodyJsonEncoding {
            email: params.email.clone(),
            name: params.name.clone(),
            traits: params.traits.clone().map(attribute_values),
            set_once: params.set_once.clone().map(attribute_values),
        };

        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .persons_update(project_id, &person.id, &body)
            .await?
            .into_inner())
    }

    /// Fetches one person by their distinct id. A distinct id with no person
    /// surfaces as [`Error::is_not_found`].
    pub async fn get_by_distinct_id(
        &self,
        distinct_id: &str,
    ) -> Result<types::PersonJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        let page = self
            .client
            .core
            .persons_list(project_id, None, Some(distinct_id), None, None)
            .await?
            .into_inner();
        page.data.into_iter().next().ok_or_else(|| Error::Api {
            status: 404,
            type_: "not_found".to_string(),
            code: "person_not_found".to_string(),
            message: format!("This project has no person with the distinct id {distinct_id}."),
            param: Some("distinctId".to_string()),
            request_id: None,
        })
    }

    /// Returns every perk the person can use now, one entitlement per perk,
    /// including the access of persons merged into them. A 404 surfaces as
    /// [`Error::is_not_found`].
    pub async fn entitlements(
        &self,
        person_id: &str,
    ) -> Result<Vec<types::PersonEntitlementJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        let mut entitlements = Vec::new();
        let mut cursor: Option<String> = None;
        loop {
            let page = self
                .client
                .core
                .persons_list_entitlements(
                    project_id,
                    person_id,
                    cursor.as_deref(),
                    Some(MAX_PAGE_SIZE),
                )
                .await?
                .into_inner();
            entitlements.extend(page.data);
            match page.page_info.end_cursor {
                Some(end_cursor) if page.page_info.has_next_page => cursor = Some(end_cursor),
                _ => return Ok(entitlements),
            }
        }
    }

    /// Resolves a person by distinct id and returns their entitlements.
    pub async fn grants_by_distinct_id(
        &self,
        distinct_id: &str,
    ) -> Result<Vec<types::PersonEntitlementJsonEncoding>, Error> {
        let person = self.get_by_distinct_id(distinct_id).await?;
        self.entitlements(&person.id).await
    }

    /// Reports whether the person can use a perk selected by `perk_id` or
    /// `perk_slug`. Exactly one selector must be set. An unknown distinct
    /// id — or unknown perk — resolves to `false`; authentication and server
    /// failures still return errors.
    pub async fn has_active_perk(
        &self,
        distinct_id: &str,
        perk_id: Option<&str>,
        perk_slug: Option<&str>,
    ) -> Result<bool, Error> {
        let (perk_id, perk_slug) = match (perk_id.map(str::trim), perk_slug.map(str::trim)) {
            (Some(id), None) if !id.is_empty() => (Some(id), None),
            (None, Some(slug)) if !slug.is_empty() => (None, Some(slug)),
            _ => {
                return Err(Error::Request(
                    "has_active_perk requires exactly one of perk_id or perk_slug".to_string(),
                ))
            }
        };
        match self.grants_by_distinct_id(distinct_id).await {
            Ok(entitlements) => Ok(entitlements.iter().any(|entitlement| match perk_id {
                Some(perk_id) => entitlement.perk_id == perk_id,
                None => entitlement.perk_slug.as_deref() == perk_slug,
            })),
            Err(error) if error.is_not_found() => Ok(false),
            Err(error) => Err(error),
        }
    }
}

impl PerksApi<'_> {
    /// Lists the first page of perks.
    pub async fn list(&self) -> Result<Vec<types::PerkJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .perks_list(project_id, None, None, None)
            .await?
            .into_inner()
            .data)
    }
}

impl OrganizationsApi<'_> {
    /// Creates a new organization owned by the signed-in person.
    pub async fn create(&self, name: &str) -> Result<types::OrganizationJsonEncoding, Error> {
        let params = types::CreateOrganizationBodyJsonEncoding {
            name: name
                .parse()
                .map_err(|error| Error::Request(format!("invalid organization name: {error}")))?,
        };
        Ok(self
            .client
            .core
            .organizations_create(&params)
            .await?
            .into_inner())
    }
}

impl ProjectsApi<'_> {
    /// Creates a project inside an organization. Only a person can create a
    /// project.
    pub async fn create(
        &self,
        organization_id: &str,
        params: &types::CreateProjectBodyJsonEncoding,
    ) -> Result<types::ProjectJsonEncoding, Error> {
        Ok(self
            .client
            .core
            .projects_create(organization_id, params)
            .await?
            .into_inner())
    }

    /// Lists the first page of an organization's projects.
    pub async fn list(
        &self,
        organization_id: &str,
    ) -> Result<Vec<types::ProjectJsonEncoding>, Error> {
        Ok(self
            .client
            .core
            .projects_list(organization_id, None, None)
            .await?
            .into_inner()
            .data)
    }
}

impl ProductsApi<'_> {
    /// Lists the first page of products.
    pub async fn list(&self) -> Result<Vec<types::ProductJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .products_list(project_id, None, None, None, None)
            .await?
            .into_inner()
            .data)
    }

    /// Lists the first page of the perks a product grants.
    pub async fn perks_by_product(
        &self,
        product_id: &str,
    ) -> Result<Vec<types::PerkJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .products_list_perks(project_id, product_id, None, None)
            .await?
            .into_inner()
            .data)
    }
}

impl PaywallsApi<'_> {
    /// Lists the first page of paywall locations that are not archived, each
    /// with what it shows now.
    pub async fn locations(&self) -> Result<Vec<types::PaywallLocationJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .paywall_locations_list(
                project_id,
                None,
                Some(types::PaywallLocationsListIsArchived::False),
                None,
                None,
            )
            .await?
            .into_inner()
            .data)
    }
}

impl SchemaApi<'_> {
    /// Returns the full runtime schema of the project.
    pub async fn get(&self) -> Result<types::ProjectSchemaResponseJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .schema_get(project_id, None)
            .await?
            .into_inner())
    }

    /// Returns the current schema revision.
    pub async fn version(&self) -> Result<types::SchemaVersionJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .schema_get_version(project_id, None)
            .await?
            .into_inner())
    }
}

impl NotificationsApi<'_> {
    /// Sends a push notification to the devices of the persons or distinct
    /// ids in the body. Delivery continues in the background; distinct ids
    /// that name no person are reported in `unresolved_distinct_ids`.
    pub async fn send(
        &self,
        notification: &types::CreatePushNotificationBodyJsonEncoding,
    ) -> Result<types::AcceptedPushNotificationJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .push_notifications_create(project_id, None, notification)
            .await?
            .into_inner())
    }
}

impl UsersApi<'_> {
    /// Returns the signed-in person's profile. Only a person's credential
    /// has one: a project secret key fails with `permission_denied`.
    pub async fn current(&self) -> Result<types::MeJsonEncoding, Error> {
        Ok(self.client.core.me_get().await?.into_inner())
    }
}

impl WebhooksApi<'_> {
    /// Endpoint management operations.
    pub fn endpoints(&self) -> WebhookEndpointsApi<'_> {
        WebhookEndpointsApi {
            client: self.client,
        }
    }

    /// Delivery inspection operations.
    pub fn deliveries(&self) -> WebhookDeliveriesApi<'_> {
        WebhookDeliveriesApi {
            client: self.client,
        }
    }
}

resource_api!(WebhookEndpointsApi);
resource_api!(WebhookDeliveriesApi);

impl WebhookEndpointsApi<'_> {
    /// Registers a new webhook endpoint. The signing secret is only returned
    /// here and by [`WebhookEndpointsApi::rotate_secret`]; reads omit it.
    pub async fn create(
        &self,
        params: &types::CreateWebhookBodyJsonEncoding,
    ) -> Result<types::WebhookWithSecretJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_create(project_id, params)
            .await?
            .into_inner())
    }

    /// Lists the first page of registered webhook endpoints.
    pub async fn list(&self) -> Result<Vec<types::WebhookJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_list(project_id, None, None)
            .await?
            .into_inner()
            .data)
    }

    /// Fetches one webhook endpoint.
    pub async fn get(&self, endpoint_id: &str) -> Result<types::WebhookJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_get(project_id, endpoint_id)
            .await?
            .into_inner())
    }

    /// Patches an existing webhook endpoint.
    pub async fn update(
        &self,
        endpoint_id: &str,
        params: &types::UpdateWebhookBodyJsonEncoding,
    ) -> Result<types::WebhookJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_update(project_id, endpoint_id, params)
            .await?
            .into_inner())
    }

    /// Removes a webhook endpoint.
    pub async fn delete(&self, endpoint_id: &str) -> Result<(), Error> {
        let project_id = self.client.project_id().await?;
        self.client
            .core
            .webhooks_delete(project_id, endpoint_id)
            .await?;
        Ok(())
    }

    /// Replaces the signing secret of an endpoint and returns the new secret.
    pub async fn rotate_secret(
        &self,
        endpoint_id: &str,
    ) -> Result<types::WebhookWithSecretJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_rotate(project_id, endpoint_id)
            .await?
            .into_inner())
    }

    /// Sends a signed test delivery to the endpoint.
    pub async fn test(
        &self,
        endpoint_id: &str,
    ) -> Result<types::WebhookDeliveryJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_test(project_id, endpoint_id)
            .await?
            .into_inner())
    }
}

impl WebhookDeliveriesApi<'_> {
    /// Lists the first page of an endpoint's deliveries, newest first.
    pub async fn list(
        &self,
        endpoint_id: &str,
    ) -> Result<Vec<types::WebhookDeliveryJsonEncoding>, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_list_deliveries(project_id, endpoint_id, None, None)
            .await?
            .into_inner()
            .data)
    }

    /// Fetches one delivery including its attempts.
    pub async fn get(
        &self,
        delivery_id: &str,
    ) -> Result<types::WebhookDeliveryWithAttemptsJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_get_delivery(project_id, delivery_id)
            .await?
            .into_inner())
    }

    /// Re-delivers a failed delivery.
    pub async fn retry(
        &self,
        delivery_id: &str,
    ) -> Result<types::WebhookDeliveryJsonEncoding, Error> {
        let project_id = self.client.project_id().await?;
        Ok(self
            .client
            .core
            .webhooks_retry_delivery(project_id, delivery_id)
            .await?
            .into_inner())
    }
}

/// Analytics ingestion API.
///
/// Capture requests authenticate with the client's secret key through the
/// `x-secret-key` header.
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

    /// Sets a group's properties, such as a company's plan and seats, by
    /// sending a `$groupidentify` event. It belongs to no person; events name
    /// the group with [`crate::Event::group`].
    pub async fn group_identify(
        &self,
        group: &crate::GroupIdentify,
    ) -> Result<CaptureResult, Error> {
        if group.group_type.is_empty() || group.group_key.is_empty() {
            return Err(Error::Request("a group needs a type and a key".to_string()));
        }
        // It belongs to no person, so the id only has to be valid: 255 characters at most.
        let named = format!("$group_{}_{}", group.group_type, group.group_key);
        let distinct_id = if named.chars().count() <= 255 {
            named
        } else {
            format!("$group_{}", group.group_type)
        };
        let mut event = crate::Event::new(
            "$groupidentify",
            distinct_id,
            group.timestamp.unwrap_or_else(chrono::Utc::now),
        )
        .property("$group_type", group.group_type.clone())
        .property("$group_key", group.group_key.clone())
        .property(
            "$group_set",
            serde_json::Value::Object(group.properties.clone()),
        );
        if !group.set_once.is_empty() {
            event = event.property(
                "$group_set_once",
                serde_json::Value::Object(group.set_once.clone()),
            );
        }
        if let Some(uuid) = &group.uuid {
            event = event.uuid(uuid.clone());
        }
        self.capture(&event).await
    }

    /// Posts several events in a single request. All events share one
    /// `sent_at` stamp; each still carries its own uuid and occurrence timestamp.
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
            let request_id = response
                .headers()
                .get("x-request-id")
                .and_then(|value| value.to_str().ok())
                .map(str::to_string);
            let body = response.text().await.unwrap_or_default();
            return Err(Error::from_capture_response(
                status.as_u16(),
                request_id,
                &body,
            ));
        }

        response
            .json::<CaptureResult>()
            .await
            .map_err(|error| Error::Request(format!("decoding capture response: {error}")))
    }
}

/// Wraps a plain attribute map in the generated newtype the person update
/// body expects.
fn attribute_values(
    values: serde_json::Map<String, serde_json::Value>,
) -> types::PersonAttributeValues {
    types::PersonAttributeValues(serde_json::Value::Object(values))
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
    if !event.groups.is_empty() {
        if let Some(serde_json::Value::Object(properties)) = object.get_mut("properties") {
            // A group the properties' own `$groups` names wins for its type.
            let mut groups: serde_json::Map<String, serde_json::Value> = event
                .groups
                .iter()
                .map(|(group_type, group_key)| {
                    (
                        group_type.clone(),
                        serde_json::Value::String(group_key.clone()),
                    )
                })
                .collect();
            if let Some(serde_json::Value::Object(own)) = properties.get("$groups") {
                groups.extend(own.clone());
            }
            properties.insert("$groups".to_string(), serde_json::Value::Object(groups));
        }
    }
    Ok(object)
}

fn sent_at() -> serde_json::Value {
    serde_json::Value::String(
        chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    )
}
