<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsPointGroup
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
     * The group's id, `an_group_...`; null for a group the project hasn't recorded.
     *
     * @var string|null
     */
    protected $id;
    /**
     * Its type's key, such as `organization`.
     *
     * @var string
     */
    protected $groupType;
    /**
     * Its key, as events name it in `$groups`.
     *
     * @var string
     */
    protected $key;
    /**
     * Its `name` property; null without one.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The group's id, `an_group_...`; null for a group the project hasn't recorded.
     *
     * @return string|null
     */
    public function getId(): ?string
    {
        return $this->id;
    }
    /**
     * The group's id, `an_group_...`; null for a group the project hasn't recorded.
     *
     * @param string|null $id
     *
     * @return self
     */
    public function setId(?string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * Its type's key, such as `organization`.
     *
     * @return string
     */
    public function getGroupType(): string
    {
        return $this->groupType;
    }
    /**
     * Its type's key, such as `organization`.
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
     * Its key, as events name it in `$groups`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * Its key, as events name it in `$groups`.
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
     * Its `name` property; null without one.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * Its `name` property; null without one.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
}