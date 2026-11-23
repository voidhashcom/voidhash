<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputStickiness
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
     * People active on exactly N periods (`exact`) or on N or more (`cumulative`).
     *
     * @var string
     */
    protected $computation;
    /**
     * People active on exactly N periods (`exact`) or on N or more (`cumulative`).
     *
     * @return string
     */
    public function getComputation(): string
    {
        return $this->computation;
    }
    /**
     * People active on exactly N periods (`exact`) or on N or more (`cumulative`).
     *
     * @param string $computation
     *
     * @return self
     */
    public function setComputation(string $computation): self
    {
        $this->initialized['computation'] = true;
        $this->computation = $computation;
        return $this;
    }
}