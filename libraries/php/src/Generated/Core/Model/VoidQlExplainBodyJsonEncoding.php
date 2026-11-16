<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlExplainBodyJsonEncoding
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
     * The VoidQL `SELECT` to explain, up to 50,000 characters.
     *
     * @var string
     */
    protected $query;
    /**
     * The VoidQL `SELECT` to explain, up to 50,000 characters.
     *
     * @return string
     */
    public function getQuery(): string
    {
        return $this->query;
    }
    /**
     * The VoidQL `SELECT` to explain, up to 50,000 characters.
     *
     * @param string $query
     *
     * @return self
     */
    public function setQuery(string $query): self
    {
        $this->initialized['query'] = true;
        $this->query = $query;
        return $this;
    }
}