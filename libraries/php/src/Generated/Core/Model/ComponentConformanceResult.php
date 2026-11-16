<?php

namespace Voidhash\Generated\Core\Model;

class ComponentConformanceResult
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
     * Whether no check failed.
     *
     * @var bool
     */
    protected $hasPassed;
    /**
     * Every check that ran, with its status, errors and warnings.
     *
     * @var list<ComponentConformanceCheck>
     */
    protected $checks;
    /**
     * Whether no check failed.
     *
     * @return bool
     */
    public function getHasPassed(): bool
    {
        return $this->hasPassed;
    }
    /**
     * Whether no check failed.
     *
     * @param bool $hasPassed
     *
     * @return self
     */
    public function setHasPassed(bool $hasPassed): self
    {
        $this->initialized['hasPassed'] = true;
        $this->hasPassed = $hasPassed;
        return $this;
    }
    /**
     * Every check that ran, with its status, errors and warnings.
     *
     * @return list<ComponentConformanceCheck>
     */
    public function getChecks(): array
    {
        return $this->checks;
    }
    /**
     * Every check that ran, with its status, errors and warnings.
     *
     * @param list<ComponentConformanceCheck> $checks
     *
     * @return self
     */
    public function setChecks(array $checks): self
    {
        $this->initialized['checks'] = true;
        $this->checks = $checks;
        return $this;
    }
}