<?php

namespace Voidhash\Generated\Core\Model;

class CreateAnalyticsCohortBodyJsonEncoding
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
     * The cohort's name, 1 to 255 characters.
     *
     * @var string
     */
    protected $name;
    /**
     * What the cohort is for, up to 4,000 characters.
     *
     * @var string|null
     */
    protected $description;
    /**
     * `static`: the cohort lists its people, added and removed by hand or by the API. `dynamic`: its `definition` describes them, and it holds whoever matches whenever it is read.
     *
     * @var string
     */
    protected $kind;
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @var AnalyticsCohortDefinition
     */
    protected $definition;
    /**
     * A static cohort's first people, by person id, up to 10000 in one request.
     *
     * @var list<string>|null
     */
    protected $personIds;
    /**
     * One point of a metric query's result, read by the same query, filters and split as the point.
     *
     * @var AnalyticsMetricPoint
     */
    protected $fromMetric;
    /**
     * The cohort's name, 1 to 255 characters.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The cohort's name, 1 to 255 characters.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the cohort is for, up to 4,000 characters.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the cohort is for, up to 4,000 characters.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * `static`: the cohort lists its people, added and removed by hand or by the API. `dynamic`: its `definition` describes them, and it holds whoever matches whenever it is read.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * `static`: the cohort lists its people, added and removed by hand or by the API. `dynamic`: its `definition` describes them, and it holds whoever matches whenever it is read.
     *
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
     * A static cohort's first people, by person id, up to 10000 in one request.
     *
     * @return list<string>|null
     */
    public function getPersonIds(): ?array
    {
        return $this->personIds;
    }
    /**
     * A static cohort's first people, by person id, up to 10000 in one request.
     *
     * @param list<string>|null $personIds
     *
     * @return self
     */
    public function setPersonIds(?array $personIds): self
    {
        $this->initialized['personIds'] = true;
        $this->personIds = $personIds;
        return $this;
    }
    /**
     * One point of a metric query's result, read by the same query, filters and split as the point.
     *
     * @return AnalyticsMetricPoint
     */
    public function getFromMetric(): AnalyticsMetricPoint
    {
        return $this->fromMetric;
    }
    /**
     * One point of a metric query's result, read by the same query, filters and split as the point.
     *
     * @param AnalyticsMetricPoint $fromMetric
     *
     * @return self
     */
    public function setFromMetric(AnalyticsMetricPoint $fromMetric): self
    {
        $this->initialized['fromMetric'] = true;
        $this->fromMetric = $fromMetric;
        return $this;
    }
}