<?php

namespace Voidhash\Generated\Core\Model;

class ExploreGroupDimension
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
     * @return string|null
     */
    public function getKey(): ?string
    {
        return $this->key;
    }
    /**
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