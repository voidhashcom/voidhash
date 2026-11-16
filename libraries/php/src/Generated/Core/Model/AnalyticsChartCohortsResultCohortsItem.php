<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartCohortsResultCohortsItem
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
     * When the cohort's period starts, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $start;
    /**
     * How many people the cohort started with.
     *
     * @var float
     */
    protected $size;
    /**
     * One value per offset; null for a period the cohort has not reached yet.
     *
     * @var list<float>
     */
    protected $values;
    /**
     * When the cohort's period starts, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * When the cohort's period starts, as an ISO 8601 timestamp.
     *
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * How many people the cohort started with.
     *
     * @return float
     */
    public function getSize(): float
    {
        return $this->size;
    }
    /**
     * How many people the cohort started with.
     *
     * @param float $size
     *
     * @return self
     */
    public function setSize(float $size): self
    {
        $this->initialized['size'] = true;
        $this->size = $size;
        return $this;
    }
    /**
     * One value per offset; null for a period the cohort has not reached yet.
     *
     * @return list<float>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * One value per offset; null for a period the cohort has not reached yet.
     *
     * @param list<float> $values
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