<?php

namespace Voidhash\Generated\Core\Model;

class WebhookEndpointJsonEncoding
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
     * @var mixed
     */
    protected $consecutiveFailures;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $description;
    /**
     * @var list<string>
     */
    protected $events;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string|null
     */
    protected $lastSuccessAt;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var string
     */
    protected $secret;
    /**
     * @var string
     */
    protected $status;
    /**
     * @var string
     */
    protected $url;
    /**
     * @return mixed
     */
    public function getConsecutiveFailures()
    {
        return $this->consecutiveFailures;
    }
    /**
     * @param mixed $consecutiveFailures
     *
     * @return self
     */
    public function setConsecutiveFailures($consecutiveFailures): self
    {
        $this->initialized['consecutiveFailures'] = true;
        $this->consecutiveFailures = $consecutiveFailures;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
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
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
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
     * @return list<string>
     */
    public function getEvents(): array
    {
        return $this->events;
    }
    /**
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
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return string|null
     */
    public function getLastSuccessAt(): ?string
    {
        return $this->lastSuccessAt;
    }
    /**
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
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
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
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
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
     * @return string
     */
    public function getSecret(): string
    {
        return $this->secret;
    }
    /**
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
    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
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
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
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
}