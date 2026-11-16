<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsGroupJsonEncoding
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
     * The group's id, `an_group_...`.
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
     * The key of its group type.
     *
     * @var string
     */
    protected $groupType;
    /**
     * Its key within the type, as events name it in `$groups`.
     *
     * @var string
     */
    protected $groupKey;
    /**
     * Its properties as they are now, set by `$groupidentify` events and by this API. Studio shows `name` as the group's name.
     *
     * @var array<string, mixed>
     */
    protected $properties;
    /**
     * When an event first named it, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The group's id, `an_group_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The group's id, `an_group_...`.
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
     * The key of its group type.
     *
     * @return string
     */
    public function getGroupType(): string
    {
        return $this->groupType;
    }
    /**
     * The key of its group type.
     *
     * @param string $groupType
     *
     * @return self
     */
    public function setGroupType(string $groupType): self
    {
        $this->initialized['groupType'] = true;
        $this->groupType = $groupType;
        return $this;
    }
    /**
     * Its key within the type, as events name it in `$groups`.
     *
     * @return string
     */
    public function getGroupKey(): string
    {
        return $this->groupKey;
    }
    /**
     * Its key within the type, as events name it in `$groups`.
     *
     * @param string $groupKey
     *
     * @return self
     */
    public function setGroupKey(string $groupKey): self
    {
        $this->initialized['groupKey'] = true;
        $this->groupKey = $groupKey;
        return $this;
    }
    /**
     * Its properties as they are now, set by `$groupidentify` events and by this API. Studio shows `name` as the group's name.
     *
     * @return array<string, mixed>
     */
    public function getProperties(): iterable
    {
        return $this->properties;
    }
    /**
     * Its properties as they are now, set by `$groupidentify` events and by this API. Studio shows `name` as the group's name.
     *
     * @param array<string, mixed> $properties
     *
     * @return self
     */
    public function setProperties(iterable $properties): self
    {
        $this->initialized['properties'] = true;
        $this->properties = $properties;
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