<?php

namespace Voidhash\Generated\Core\Model;

class PersonErasureJsonEncoding
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
     * The erasure's id, `person_erasure_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the erasure runs in.
     *
     * @var string
     */
    protected $projectId;
    /**
     * `queued` and `in_progress` erasures finish on their own; request a `failed` one again to retry it.
     *
     * @var string
     */
    protected $status;
    /**
     * The person whose data is erased; null when the request named nobody.
     *
     * @var string|null
     */
    protected $personId;
    /**
     * When the erasure was requested, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $requestedAt;
    /**
     * When the erasure completed; null until it has.
     *
     * @var string|null
     */
    protected $completedAt;
    /**
     * The erasure's id, `person_erasure_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The erasure's id, `person_erasure_...`.
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
     * The project the erasure runs in.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the erasure runs in.
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
     * `queued` and `in_progress` erasures finish on their own; request a `failed` one again to retry it.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `queued` and `in_progress` erasures finish on their own; request a `failed` one again to retry it.
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
     * The person whose data is erased; null when the request named nobody.
     *
     * @return string|null
     */
    public function getPersonId(): ?string
    {
        return $this->personId;
    }
    /**
     * The person whose data is erased; null when the request named nobody.
     *
     * @param string|null $personId
     *
     * @return self
     */
    public function setPersonId(?string $personId): self
    {
        $this->initialized['personId'] = true;
        $this->personId = $personId;
        return $this;
    }
    /**
     * When the erasure was requested, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getRequestedAt(): string
    {
        return $this->requestedAt;
    }
    /**
     * When the erasure was requested, as an ISO 8601 timestamp.
     *
     * @param string $requestedAt
     *
     * @return self
     */
    public function setRequestedAt(string $requestedAt): self
    {
        $this->initialized['requestedAt'] = true;
        $this->requestedAt = $requestedAt;
        return $this;
    }
    /**
     * When the erasure completed; null until it has.
     *
     * @return string|null
     */
    public function getCompletedAt(): ?string
    {
        return $this->completedAt;
    }
    /**
     * When the erasure completed; null until it has.
     *
     * @param string|null $completedAt
     *
     * @return self
     */
    public function setCompletedAt(?string $completedAt): self
    {
        $this->initialized['completedAt'] = true;
        $this->completedAt = $completedAt;
        return $this;
    }
}