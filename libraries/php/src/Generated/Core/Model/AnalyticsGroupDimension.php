<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsGroupDimension
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
     * @var string
     */
    protected $kind;
    /**
     * A group type's key, such as `organization` or `company`: a lower-case letter, then up to 63 lower-case letters, digits or underscores.
     *
     * @var string
     */
    protected $groupType;
    /**
     * A property of the group, as it is now. Without it, the group itself, by its key, labelled by its `name` property.
     *
     * @var string|null
     */
    protected $key;
    /**
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * A group type's key, such as `organization` or `company`: a lower-case letter, then up to 63 lower-case letters, digits or underscores.
     *
     * @return string
     */
    public function getGroupType(): string
    {
        return $this->groupType;
    }
    /**
     * A group type's key, such as `organization` or `company`: a lower-case letter, then up to 63 lower-case letters, digits or underscores.
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
     * A property of the group, as it is now. Without it, the group itself, by its key, labelled by its `name` property.
     *
     * @return string|null
     */
    public function getKey(): ?string
    {
        return $this->key;
    }
    /**
     * A property of the group, as it is now. Without it, the group itself, by its key, labelled by its `name` property.
     *
     * @param string|null $key
     *
     * @return self
     */
    public function setKey(?string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
}