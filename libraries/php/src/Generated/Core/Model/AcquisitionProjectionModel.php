<?php

namespace Voidhash\Generated\Core\Model;

class AcquisitionProjectionModel
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
     * What projections learned of each plan.
     *
     * @var list<AcquisitionProjectionPlan>
     */
    protected $plans;
    /**
     * What projections learned of each plan.
     *
     * @return list<AcquisitionProjectionPlan>
     */
    public function getPlans(): array
    {
        return $this->plans;
    }
    /**
     * What projections learned of each plan.
     *
     * @param list<AcquisitionProjectionPlan> $plans
     *
     * @return self
     */
    public function setPlans(array $plans): self
    {
        $this->initialized['plans'] = true;
        $this->plans = $plans;
        return $this;
    }
}