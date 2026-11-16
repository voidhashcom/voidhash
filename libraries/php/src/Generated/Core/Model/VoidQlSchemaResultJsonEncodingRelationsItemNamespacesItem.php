<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItem
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
     * The JSON column a query reads keys of, as `<namespace>.<key>`.
     *
     * @var string
     */
    protected $name;
    /**
     * What the namespace holds.
     *
     * @var string
     */
    protected $description;
    /**
     * Whether reading it needs the `project:persons:read` permission.
     *
     * @var bool
     */
    protected $isPersonalData;
    /**
     * The JSON column a query reads keys of, as `<namespace>.<key>`.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The JSON column a query reads keys of, as `<namespace>.<key>`.
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
     * What the namespace holds.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the namespace holds.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * Whether reading it needs the `project:persons:read` permission.
     *
     * @return bool
     */
    public function getIsPersonalData(): bool
    {
        return $this->isPersonalData;
    }
    /**
     * Whether reading it needs the `project:persons:read` permission.
     *
     * @param bool $isPersonalData
     *
     * @return self
     */
    public function setIsPersonalData(bool $isPersonalData): self
    {
        $this->initialized['isPersonalData'] = true;
        $this->isPersonalData = $isPersonalData;
        return $this;
    }
}