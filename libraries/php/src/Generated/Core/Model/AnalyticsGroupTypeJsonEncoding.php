<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsGroupTypeJsonEncoding
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
     * The group type's id, `an_group_type_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project whose events name it.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The key events name it with in `$groups`.
     *
     * @var string
     */
    protected $key;
    /**
     * What one group is called, such as `Team`; null reads from the key.
     *
     * @var string|null
     */
    protected $nameSingular;
    /**
     * What several groups are called, such as `Teams`; null reads from the key.
     *
     * @var string|null
     */
    protected $namePlural;
    /**
     * When an event first named it, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The group type's id, `an_group_type_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The group type's id, `an_group_type_...`.
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
     * The project whose events name it.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose events name it.
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
     * The key events name it with in `$groups`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The key events name it with in `$groups`.
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
     * What one group is called, such as `Team`; null reads from the key.
     *
     * @return string|null
     */
    public function getNameSingular(): ?string
    {
        return $this->nameSingular;
    }
    /**
     * What one group is called, such as `Team`; null reads from the key.
     *
     * @param string|null $nameSingular
     *
     * @return self
     */
    public function setNameSingular(?string $nameSingular): self
    {
        $this->initialized['nameSingular'] = true;
        $this->nameSingular = $nameSingular;
        return $this;
    }
    /**
     * What several groups are called, such as `Teams`; null reads from the key.
     *
     * @return string|null
     */
    public function getNamePlural(): ?string
    {
        return $this->namePlural;
    }
    /**
     * What several groups are called, such as `Teams`; null reads from the key.
     *
     * @param string|null $namePlural
     *
     * @return self
     */
    public function setNamePlural(?string $namePlural): self
    {
        $this->initialized['namePlural'] = true;
        $this->namePlural = $namePlural;
        return $this;
    }
    /**
     * When an event first named it, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When an event first named it, as an ISO 8601 timestamp.
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
}