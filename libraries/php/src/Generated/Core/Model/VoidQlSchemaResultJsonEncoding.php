<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlSchemaResultJsonEncoding
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
     * The version of the relations and columns listed, which saved queries record.
     *
     * @var int
     */
    protected $version;
    /**
     * The tables a query can read.
     *
     * @var list<VoidQlSchemaResultJsonEncodingRelationsItem>
     */
    protected $relations;
    /**
     * Functions a query may call, in the spelling to call them; any case works.
     *
     * @var list<string>
     */
    protected $functions;
    /**
     * The version of the relations and columns listed, which saved queries record.
     *
     * @return int
     */
    public function getVersion(): int
    {
        return $this->version;
    }
    /**
     * The version of the relations and columns listed, which saved queries record.
     *
     * @param int $version
     *
     * @return self
     */
    public function setVersion(int $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * The tables a query can read.
     *
     * @return list<VoidQlSchemaResultJsonEncodingRelationsItem>
     */
    public function getRelations(): array
    {
        return $this->relations;
    }
    /**
     * The tables a query can read.
     *
     * @param list<VoidQlSchemaResultJsonEncodingRelationsItem> $relations
     *
     * @return self
     */
    public function setRelations(array $relations): self
    {
        $this->initialized['relations'] = true;
        $this->relations = $relations;
        return $this;
    }
    /**
     * Functions a query may call, in the spelling to call them; any case works.
     *
     * @return list<string>
     */
    public function getFunctions(): array
    {
        return $this->functions;
    }
    /**
     * Functions a query may call, in the spelling to call them; any case works.
     *
     * @param list<string> $functions
     *
     * @return self
     */
    public function setFunctions(array $functions): self
    {
        $this->initialized['functions'] = true;
        $this->functions = $functions;
        return $this;
    }
}