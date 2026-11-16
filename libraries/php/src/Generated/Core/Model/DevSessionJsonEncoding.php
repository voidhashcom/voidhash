<?php

namespace Voidhash\Generated\Core\Model;

class DevSessionJsonEncoding
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
     * The dev session's id, `cmp_dev_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the run works in.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The origin of the run's server on the loopback interface.
     *
     * @var string
     */
    protected $url;
    /**
     * The token the run's server requires.
     *
     * @var string
     */
    protected $token;
    /**
     * The components the run serves.
     *
     * @var list<DevSessionComponentJsonEncoding>
     */
    protected $components;
    /**
     * When the run started, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the run last reported, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $updatedAt;
    /**
     * When the session expires unless the run reports again, 30 seconds after its last report, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $expiresAt;
    /**
     * The dev session's id, `cmp_dev_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The dev session's id, `cmp_dev_...`.
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
     * The project the run works in.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the run works in.
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
     * The origin of the run's server on the loopback interface.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * The origin of the run's server on the loopback interface.
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
     * The token the run's server requires.
     *
     * @return string
     */
    public function getToken(): string
    {
        return $this->token;
    }
    /**
     * The token the run's server requires.
     *
     * @param string $token
     *
     * @return self
     */
    public function setToken(string $token): self
    {
        $this->initialized['token'] = true;
        $this->token = $token;
        return $this;
    }
    /**
     * The components the run serves.
     *
     * @return list<DevSessionComponentJsonEncoding>
     */
    public function getComponents(): array
    {
        return $this->components;
    }
    /**
     * The components the run serves.
     *
     * @param list<DevSessionComponentJsonEncoding> $components
     *
     * @return self
     */
    public function setComponents(array $components): self
    {
        $this->initialized['components'] = true;
        $this->components = $components;
        return $this;
    }
    /**
     * When the run started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the run started, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the run last reported, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When the run last reported, as an ISO 8601 timestamp.
     *
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
    /**
     * When the session expires unless the run reports again, 30 seconds after its last report, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getExpiresAt(): string
    {
        return $this->expiresAt;
    }
    /**
     * When the session expires unless the run reports again, 30 seconds after its last report, as an ISO 8601 timestamp.
     *
     * @param string $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
}