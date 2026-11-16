<?php

namespace Voidhash\Generated\Core\Model;

class WebhookWithSecretJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The webhook's id, `wh_ep_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project whose events it receives.
     *
     * @var string
     */
    protected $projectId;
    /**
     * What the webhook is for.
     *
     * @var string
     */
    protected $name;
    /**
     * A longer note for the team; null when there is none.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The URL Voidhash POSTs events to.
     *
     * @var string
     */
    protected $url;
    /**
     * The events the webhook receives.
     *
     * @var list<string>
     */
    protected $events;
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @var string
     */
    protected $environment;
    /**
     * `active` webhooks receive events. `disabled` was turned off by a person; `failed` was turned off by Voidhash after 20 failed attempts in a row.
     *
     * @var string
     */
    protected $status;
    /**
     * Delivery attempts that failed since the last one that succeeded.
     *
     * @var int
     */
    protected $consecutiveFailures;
    /**
     * When a delivery last succeeded; null if none has.
     *
     * @var string|null
     */
    protected $lastSuccessAt;
    /**
     * When the webhook was created, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * The signing secret, `whsec_...`, that verifies the `X-Webhook-Signature` header of every delivery. It is never shown again, so store it now.
     *
     * @var string
     */
    protected $secret;
    /**
     * The webhook's id, `wh_ep_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The webhook's id, `wh_ep_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The project whose events it receives.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose events it receives.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * What the webhook is for.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * What the webhook is for.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * A longer note for the team; null when there is none.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * A longer note for the team; null when there is none.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * The URL Voidhash POSTs events to.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * The URL Voidhash POSTs events to.
     *
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
    /**
     * The events the webhook receives.
     *
     * @return list<string>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
     * The events the webhook receives.
     *
     * @param list<string> $events
     *
     * @return self
     */
    public function setEvents(array $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * The purchases an API key or webhook works with: `production` ones, or store sandbox and test ones for `test`.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * `active` webhooks receive events. `disabled` was turned off by a person; `failed` was turned off by Voidhash after 20 failed attempts in a row.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `active` webhooks receive events. `disabled` was turned off by a person; `failed` was turned off by Voidhash after 20 failed attempts in a row.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * Delivery attempts that failed since the last one that succeeded.
     *
     * @return int
     */
    public function getConsecutiveFailures(): int
    {
        return $this->consecutiveFailures;
    }
    /**
     * Delivery attempts that failed since the last one that succeeded.
     *
     * @param int $consecutiveFailures
     *
     * @return self
     */
    public function setConsecutiveFailures(int $consecutiveFailures): self
    {
        $this->initialized['consecutiveFailures'] = true;
        $this->consecutiveFailures = $consecutiveFailures;
        return $this;
    }
    /**
     * When a delivery last succeeded; null if none has.
     *
     * @return string|null
     */
    public function getLastSuccessAt(): ?string
    {
        return $this->lastSuccessAt;
    }
    /**
     * When a delivery last succeeded; null if none has.
     *
     * @param string|null $lastSuccessAt
     *
     * @return self
     */
    public function setLastSuccessAt(?string $lastSuccessAt): self
    {
        $this->initialized['lastSuccessAt'] = true;
        $this->lastSuccessAt = $lastSuccessAt;
        return $this;
    }
    /**
     * When the webhook was created, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the webhook was created, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * The signing secret, `whsec_...`, that verifies the `X-Webhook-Signature` header of every delivery. It is never shown again, so store it now.
     *
     * @return string
     */
    public function getSecret(): string
    {
        return $this->secret;
    }
    /**
     * The signing secret, `whsec_...`, that verifies the `X-Webhook-Signature` header of every delivery. It is never shown again, so store it now.
     *
     * @param string $secret
     *
     * @return self
     */
    public function setSecret(string $secret): self
    {
        $this->initialized['secret'] = true;
        $this->secret = $secret;
        return $this;
    }
}