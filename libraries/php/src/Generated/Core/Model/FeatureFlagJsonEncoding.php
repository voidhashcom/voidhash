<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagJsonEncoding
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
     * The flag's id, `ff_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the flag belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The flag's key, unique in the project; SDKs ask for the flag by it.
     *
     * @var string
     */
    protected $key;
    /**
     * What the flag controls; null when it has no description.
     *
     * @var string|null
     */
    protected $description;
    /**
     * What the flag evaluates to: only on or off (`boolean`), or also one of its variants' values, each a `string`, a `number` or any `json`. It cannot change once the flag is created.
     *
     * @var string
     */
    protected $type;
    /**
     * @var FeatureFlagEnvironmentsJsonEncoding
     */
    protected $environments;
    /**
     * Whether the flag is archived; apps do not receive an archived flag.
     *
     * @var bool
     */
    protected $isArchived;
    /**
     * The experiment whose arms the flag assigns, `exp_...`; null for a flag of your own. Such a flag changes only through its experiment, though its production overrides can still be set, and it has no test configuration.
     *
     * @var string|null
     */
    protected $experimentId;
    /**
     * When the flag was created, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the flag was last changed, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * The flag's id, `ff_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The flag's id, `ff_...`.
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
     * The project the flag belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the flag belongs to.
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
     * The flag's key, unique in the project; SDKs ask for the flag by it.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The flag's key, unique in the project; SDKs ask for the flag by it.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * What the flag controls; null when it has no description.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the flag controls; null when it has no description.
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
     * What the flag evaluates to: only on or off (`boolean`), or also one of its variants' values, each a `string`, a `number` or any `json`. It cannot change once the flag is created.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * What the flag evaluates to: only on or off (`boolean`), or also one of its variants' values, each a `string`, a `number` or any `json`. It cannot change once the flag is created.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * @return FeatureFlagEnvironmentsJsonEncoding
     */
    public function getEnvironments(): FeatureFlagEnvironmentsJsonEncoding
    {
        return $this->environments;
    }
    /**
     * @param FeatureFlagEnvironmentsJsonEncoding $environments
     *
     * @return self
     */
    public function setEnvironments(FeatureFlagEnvironmentsJsonEncoding $environments): self
    {
        $this->initialized['environments'] = true;
        $this->environments = $environments;
        return $this;
    }
    /**
     * Whether the flag is archived; apps do not receive an archived flag.
     *
     * @return bool
     */
    public function getIsArchived(): bool
    {
        return $this->isArchived;
    }
    /**
     * Whether the flag is archived; apps do not receive an archived flag.
     *
     * @param bool $isArchived
     *
     * @return self
     */
    public function setIsArchived(bool $isArchived): self
    {
        $this->initialized['isArchived'] = true;
        $this->isArchived = $isArchived;
        return $this;
    }
    /**
     * The experiment whose arms the flag assigns, `exp_...`; null for a flag of your own. Such a flag changes only through its experiment, though its production overrides can still be set, and it has no test configuration.
     *
     * @return string|null
     */
    public function getExperimentId(): ?string
    {
        return $this->experimentId;
    }
    /**
     * The experiment whose arms the flag assigns, `exp_...`; null for a flag of your own. Such a flag changes only through its experiment, though its production overrides can still be set, and it has no test configuration.
     *
     * @param string|null $experimentId
     *
     * @return self
     */
    public function setExperimentId(?string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * When the flag was created, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the flag was created, as an ISO 8601 timestamp.
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
     * When the flag was last changed, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the flag was last changed, as an ISO 8601 timestamp.
     *
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}