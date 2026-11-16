<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem
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
     * The column's name.
     *
     * @var string
     */
    protected $name;
    /**
     * The column's VoidQL type.
     *
     * @var string
     */
    protected $type;
    /**
     * What the column holds.
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
     * The `<relation>.<column>` it refers to, such as `people.id`; null when it refers to none.
     *
     * @var string|null
     */
    protected $references;
    /**
     * The column's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The column's name.
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
     * The column's VoidQL type.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The column's VoidQL type.
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
     * What the column holds.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the column holds.
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
    /**
     * The `<relation>.<column>` it refers to, such as `people.id`; null when it refers to none.
     *
     * @return string|null
     */
    public function getReferences(): ?string
    {
        return $this->references;
    }
    /**
     * The `<relation>.<column>` it refers to, such as `people.id`; null when it refers to none.
     *
     * @param string|null $references
     *
     * @return self
     */
    public function setReferences(?string $references): self
    {
        $this->initialized['references'] = true;
        $this->references = $references;
        return $this;
    }
}