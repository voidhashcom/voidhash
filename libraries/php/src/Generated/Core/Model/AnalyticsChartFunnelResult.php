<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartFunnelResult
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
     * Always `funnel`.
     *
     * @var string
     */
    protected $shape;
    /**
     * The steps, in order.
     *
     * @var list<AnalyticsChartFunnelResultStepsItem>
     */
    protected $steps;
    /**
     * Always `funnel`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `funnel`.
     *
     * @param string $shape
     *
     * @return self
     */
    public function setShape(string $shape): self
    {
        $this->initialized['shape'] = true;
        $this->shape = $shape;
        return $this;
    }
    /**
     * The steps, in order.
     *
     * @return list<AnalyticsChartFunnelResultStepsItem>
     */
    public function getSteps(): array
    {
        return $this->steps;
    }
    /**
     * The steps, in order.
     *
     * @param list<AnalyticsChartFunnelResultStepsItem> $steps
     *
     * @return self
     */
    public function setSteps(array $steps): self
    {
        $this->initialized['steps'] = true;
        $this->steps = $steps;
        return $this;
    }
}