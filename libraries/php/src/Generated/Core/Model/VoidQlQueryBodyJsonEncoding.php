<?php

namespace Voidhash\Generated\Core\Model;

class VoidQlQueryBodyJsonEncoding
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
     * The VoidQL `SELECT` to run, up to 50,000 characters.
     *
     * @var string
     */
    protected $query;
    /**
     * The most rows to return, from 1 to 10,000; 100 when omitted.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * The VoidQL `SELECT` to run, up to 50,000 characters.
     *
     * @return string
     */
    public function getQuery(): string
    {
        return $this->query;
    }
    /**
     * The VoidQL `SELECT` to run, up to 50,000 characters.
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
    /**
     * The most rows to return, from 1 to 10,000; 100 when omitted.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * The most rows to return, from 1 to 10,000; 100 when omitted.
     *
     * @param int|null $limit
     *
     * @return self
     */
    public function setLimit(?int $limit): self
    {
        $this->initialized['limit'] = true;
        $this->limit = $limit;
        return $this;
    }
}