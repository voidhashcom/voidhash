<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortEvaluationJsonEncoding
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
     * How many people the definition holds now.
     *
     * @var int
     */
    protected $count;
    /**
     * The first of them, newest first. Empty for a credential without `project:persons:read`.
     *
     * @var list<AnalyticsPersonJsonEncoding>
     */
    protected $people;
    /**
     * How many people the definition holds now.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many people the definition holds now.
     *
     * @param int $count
     *
     * @return self
     */
    public function setCount(int $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
    /**
     * The first of them, newest first. Empty for a credential without `project:persons:read`.
     *
     * @return list<AnalyticsPersonJsonEncoding>
     */
    public function getPeople(): array
    {
        return $this->people;
    }
    /**
     * The first of them, newest first. Empty for a credential without `project:persons:read`.
     *
     * @param list<AnalyticsPersonJsonEncoding> $people
     *
     * @return self
     */
    public function setPeople(array $people): self
    {
        $this->initialized['people'] = true;
        $this->people = $people;
        return $this;
    }
}