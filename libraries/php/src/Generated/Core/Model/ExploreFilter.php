<?php

namespace Voidhash\Generated\Core\Model;

class ExploreFilter
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
     * @var ExploreStoreDimension|ExploreProductDimension|ExploreBillingPeriodDimension|ExplorePlanDimension|ExploreTraitDimension|ExplorePropertyDimension|ExploreCohortDimension|ExploreGroupDimension
     */
    protected $dimension;
    /**
     * @var string
     */
    protected $op;
    /**
     * @var list<string>
     */
    protected $values;
    /**
     * @return ExploreStoreDimension|ExploreProductDimension|ExploreBillingPeriodDimension|ExplorePlanDimension|ExploreTraitDimension|ExplorePropertyDimension|ExploreCohortDimension|ExploreGroupDimension
     */
    public function getDimension()
    {
        return $this->dimension;
    }
    /**
     * @param ExploreStoreDimension|ExploreProductDimension|ExploreBillingPeriodDimension|ExplorePlanDimension|ExploreTraitDimension|ExplorePropertyDimension|ExploreCohortDimension|ExploreGroupDimension $dimension
     *
     * @return self
     */
    public function setDimension($dimension): self
    {
        $this->initialized['dimension'] = true;
        $this->dimension = $dimension;
        return $this;
    }
    /**
     * @return string
     */
    public function getOp(): string
    {
        return $this->op;
    }
    /**
     * @param string $op
     *
     * @return self
     */
    public function setOp(string $op): self
    {
        $this->initialized['op'] = true;
        $this->op = $op;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * @param list<string> $values
     *
     * @return self
     */
    public function setValues(array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}