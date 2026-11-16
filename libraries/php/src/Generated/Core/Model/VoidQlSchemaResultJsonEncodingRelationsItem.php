<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlSchemaResultJsonEncodingRelationsItem
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
     * The relation's name, as a query's `FROM` names it.
     *
     * @var string
     */
    protected $name;
    /**
     * What one row of the relation is.
     *
     * @var string
     */
    protected $description;
    /**
     * The relation's columns.
     *
     * @var list<VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem>
     */
    protected $columns;
    /**
     * JSON columns read as `<namespace>.<key>`, such as `properties.plan`.
     *
     * @var list<VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItem>
     */
    protected $namespaces;
    /**
     * The relation's name, as a query's `FROM` names it.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The relation's name, as a query's `FROM` names it.
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
     * What one row of the relation is.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What one row of the relation is.
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
     * The relation's columns.
     *
     * @return list<VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem>
     */
    public function getColumns(): array
    {
        return $this->columns;
    }
    /**
     * The relation's columns.
     *
     * @param list<VoidQlSchemaResultJsonEncodingRelationsItemColumnsItem> $columns
     *
     * @return self
     */
    public function setColumns(array $columns): self
    {
        $this->initialized['columns'] = true;
        $this->columns = $columns;
        return $this;
    }
    /**
     * JSON columns read as `<namespace>.<key>`, such as `properties.plan`.
     *
     * @return list<VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItem>
     */
    public function getNamespaces(): array
    {
        return $this->namespaces;
    }
    /**
     * JSON columns read as `<namespace>.<key>`, such as `properties.plan`.
     *
     * @param list<VoidQlSchemaResultJsonEncodingRelationsItemNamespacesItem> $namespaces
     *
     * @return self
     */
    public function setNamespaces(array $namespaces): self
    {
        $this->initialized['namespaces'] = true;
        $this->namespaces = $namespaces;
        return $this;
    }
}