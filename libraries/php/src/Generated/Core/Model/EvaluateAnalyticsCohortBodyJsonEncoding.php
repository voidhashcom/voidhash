<?php

namespace Voidhash\Generated\Core\Model;

class EvaluateAnalyticsCohortBodyJsonEncoding
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
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @var AnalyticsCohortDefinition
     */
    protected $definition;
    /**
     * How many of the people to return, 1 to 100. Defaults to 20.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @return AnalyticsCohortDefinition
     */
    public function getDefinition(): AnalyticsCohortDefinition
    {
        return $this->definition;
    }
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @param AnalyticsCohortDefinition $definition
     *
     * @return self
     */
    public function setDefinition(AnalyticsCohortDefinition $definition): self
    {
        $this->initialized['definition'] = true;
        $this->definition = $definition;
        return $this;
    }
    /**
     * How many of the people to return, 1 to 100. Defaults to 20.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * How many of the people to return, 1 to 100. Defaults to 20.
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