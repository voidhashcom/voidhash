<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartOptions
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
     * What a breakdown chart splits by, among the dimensions its catalog entry lists, such as `store` or `country`. Defaults to the first one.
     *
     * @var string|null
     */
    protected $dimension;
    /**
     * The event a single-event chart reads; defaults to the project's most frequent event of its own. In a retention chart, the event that starts a person's cohort; defaults to any activity.
     *
     * @var string|null
     */
    protected $eventName;
    /**
     * The experiment an experiment chart reads, `exp_...`; required by those charts.
     *
     * @var string|null
     */
    protected $experimentId;
    /**
     * How many series or rows to keep, 1 to 200; the rest are summed under the key `$other`. Tables default to 50.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * What a chart with several metrics measures, among those its catalog entry lists. Defaults to the first one.
     *
     * @var string|null
     */
    protected $metric;
    /**
     * The length of each cohort of a retention chart. Defaults to `week`.
     *
     * @var string|null
     */
    protected $period;
    /**
     * Only the paywall location with this id; a paywall chart covers every location without it.
     *
     * @var string|null
     */
    protected $placementId;
    /**
     * The event that counts someone as retained in a retention chart. Defaults to any activity.
     *
     * @var string|null
     */
    protected $returnEventName;
    /**
     * The trait the `people_by_trait` chart counts people by; required by it. A value held by fewer than five people counts under `$other`.
     *
     * @var string|null
     */
    protected $trait;
    /**
     * What a breakdown chart splits by, among the dimensions its catalog entry lists, such as `store` or `country`. Defaults to the first one.
     *
     * @return string|null
     */
    public function getDimension(): ?string
    {
        return $this->dimension;
    }
    /**
     * What a breakdown chart splits by, among the dimensions its catalog entry lists, such as `store` or `country`. Defaults to the first one.
     *
     * @param string|null $dimension
     *
     * @return self
     */
    public function setDimension(?string $dimension): self
    {
        $this->initialized['dimension'] = true;
        $this->dimension = $dimension;
        return $this;
    }
    /**
     * The event a single-event chart reads; defaults to the project's most frequent event of its own. In a retention chart, the event that starts a person's cohort; defaults to any activity.
     *
     * @return string|null
     */
    public function getEventName(): ?string
    {
        return $this->eventName;
    }
    /**
     * The event a single-event chart reads; defaults to the project's most frequent event of its own. In a retention chart, the event that starts a person's cohort; defaults to any activity.
     *
     * @param string|null $eventName
     *
     * @return self
     */
    public function setEventName(?string $eventName): self
    {
        $this->initialized['eventName'] = true;
        $this->eventName = $eventName;
        return $this;
    }
    /**
     * The experiment an experiment chart reads, `exp_...`; required by those charts.
     *
     * @return string|null
     */
    public function getExperimentId(): ?string
    {
        return $this->experimentId;
    }
    /**
     * The experiment an experiment chart reads, `exp_...`; required by those charts.
     *
     * @param string|null $experimentId
     *
     * @return self
     */
    public function setExperimentId(?string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
    /**
     * How many series or rows to keep, 1 to 200; the rest are summed under the key `$other`. Tables default to 50.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * How many series or rows to keep, 1 to 200; the rest are summed under the key `$other`. Tables default to 50.
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
    /**
     * What a chart with several metrics measures, among those its catalog entry lists. Defaults to the first one.
     *
     * @return string|null
     */
    public function getMetric(): ?string
    {
        return $this->metric;
    }
    /**
     * What a chart with several metrics measures, among those its catalog entry lists. Defaults to the first one.
     *
     * @param string|null $metric
     *
     * @return self
     */
    public function setMetric(?string $metric): self
    {
        $this->initialized['metric'] = true;
        $this->metric = $metric;
        return $this;
    }
    /**
     * The length of each cohort of a retention chart. Defaults to `week`.
     *
     * @return string|null
     */
    public function getPeriod(): ?string
    {
        return $this->period;
    }
    /**
     * The length of each cohort of a retention chart. Defaults to `week`.
     *
     * @param string|null $period
     *
     * @return self
     */
    public function setPeriod(?string $period): self
    {
        $this->initialized['period'] = true;
        $this->period = $period;
        return $this;
    }
    /**
     * Only the paywall location with this id; a paywall chart covers every location without it.
     *
     * @return string|null
     */
    public function getPlacementId(): ?string
    {
        return $this->placementId;
    }
    /**
     * Only the paywall location with this id; a paywall chart covers every location without it.
     *
     * @param string|null $placementId
     *
     * @return self
     */
    public function setPlacementId(?string $placementId): self
    {
        $this->initialized['placementId'] = true;
        $this->placementId = $placementId;
        return $this;
    }
    /**
     * The event that counts someone as retained in a retention chart. Defaults to any activity.
     *
     * @return string|null
     */
    public function getReturnEventName(): ?string
    {
        return $this->returnEventName;
    }
    /**
     * The event that counts someone as retained in a retention chart. Defaults to any activity.
     *
     * @param string|null $returnEventName
     *
     * @return self
     */
    public function setReturnEventName(?string $returnEventName): self
    {
        $this->initialized['returnEventName'] = true;
        $this->returnEventName = $returnEventName;
        return $this;
    }
    /**
     * The trait the `people_by_trait` chart counts people by; required by it. A value held by fewer than five people counts under `$other`.
     *
     * @return string|null
     */
    public function getTrait(): ?string
    {
        return $this->trait;
    }
    /**
     * The trait the `people_by_trait` chart counts people by; required by it. A value held by fewer than five people counts under `$other`.
     *
     * @param string|null $trait
     *
     * @return self
     */
    public function setTrait(?string $trait): self
    {
        $this->initialized['trait'] = true;
        $this->trait = $trait;
        return $this;
    }
}