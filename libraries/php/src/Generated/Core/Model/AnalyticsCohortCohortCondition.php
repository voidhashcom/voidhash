<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortCohortCondition
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
     * The other cohort's id, of the same project.
     *
     * @var string
     */
    protected $cohortId;
    /**
     * Keeps the people not in it instead.
     *
     * @var bool
     */
    protected $isNegated;
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
     * The other cohort's id, of the same project.
     *
     * @return string
     */
    public function getCohortId(): string
    {
        return $this->cohortId;
    }
    /**
     * The other cohort's id, of the same project.
     *
     * @param string $cohortId
     *
     * @return self
     */
    public function setCohortId(string $cohortId): self
    {
        $this->initialized['cohortId'] = true;
        $this->cohortId = $cohortId;
        return $this;
    }
    /**
     * Keeps the people not in it instead.
     *
     * @return bool
     */
    public function getIsNegated(): bool
    {
        return $this->isNegated;
    }
    /**
     * Keeps the people not in it instead.
     *
     * @param bool $isNegated
     *
     * @return self
     */
    public function setIsNegated(bool $isNegated): self
    {
        $this->initialized['isNegated'] = true;
        $this->isNegated = $isNegated;
        return $this;
    }
}