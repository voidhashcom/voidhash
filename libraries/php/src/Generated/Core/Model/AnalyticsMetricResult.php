<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricResult
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
     * `money`, in integer minor units of the response's `currency`, or `count`.
     *
     * @var string
     */
    protected $unit;
    /**
     * The start of each bucket of the range; every series has a value per bucket.
     *
     * @var list<string>
     */
    protected $buckets;
    /**
     * The metric with the filters applied and no split, per bucket. Splits of money, counts, first times and sums add up to it; people, sessions and other statistics do not. With `isCumulative`, each bucket holds everything from the range's start through it.
     *
     * @var list<float>
     */
    protected $total;
    /**
     * `total` over the `comparison` period or the `comparisonRange`, bucket by bucket beside `buckets`; only with one of them. A year earlier, a bucket without a counterpart, such as 29 February, is null. Over a `comparisonRange` it holds every bucket of that range, so it is longer than `buckets` when the range is longer: draw the first `buckets.length` values and summarise them all.
     *
     * @var list<float>|null
     */
    protected $previousTotal;
    /**
     * One series per group of the split, biggest first; none without one.
     *
     * @var list<AnalyticsMetricResultSeriesItem>
     */
    protected $series;
    /**
     * Whether the values are withheld because a trait or a group's property narrowed them to fewer than five people.
     *
     * @var bool
     */
    protected $isWithheld;
    /**
     * Whether one row can count in several groups of the split, as a person in two cohorts does, so the groups don't add up to `total`: shares of the total and stacked charts mean nothing. False without a split.
     *
     * @var bool
     */
    protected $hasOverlappingGroups;
    /**
     * `money`, in integer minor units of the response's `currency`, or `count`.
     *
     * @return string
     */
    public function getUnit(): string
    {
        return $this->unit;
    }
    /**
     * `money`, in integer minor units of the response's `currency`, or `count`.
     *
     * @param string $unit
     *
     * @return self
     */
    public function setUnit(string $unit): self
    {
        $this->initialized['unit'] = true;
        $this->unit = $unit;
        return $this;
    }
    /**
     * The start of each bucket of the range; every series has a value per bucket.
     *
     * @return list<string>
     */
    public function getBuckets(): array
    {
        return $this->buckets;
    }
    /**
     * The start of each bucket of the range; every series has a value per bucket.
     *
     * @param list<string> $buckets
     *
     * @return self
     */
    public function setBuckets(array $buckets): self
    {
        $this->initialized['buckets'] = true;
        $this->buckets = $buckets;
        return $this;
    }
    /**
     * The metric with the filters applied and no split, per bucket. Splits of money, counts, first times and sums add up to it; people, sessions and other statistics do not. With `isCumulative`, each bucket holds everything from the range's start through it.
     *
     * @return list<float>
     */
    public function getTotal(): array
    {
        return $this->total;
    }
    /**
     * The metric with the filters applied and no split, per bucket. Splits of money, counts, first times and sums add up to it; people, sessions and other statistics do not. With `isCumulative`, each bucket holds everything from the range's start through it.
     *
     * @param list<float> $total
     *
     * @return self
     */
    public function setTotal(array $total): self
    {
        $this->initialized['total'] = true;
        $this->total = $total;
        return $this;
    }
    /**
     * `total` over the `comparison` period or the `comparisonRange`, bucket by bucket beside `buckets`; only with one of them. A year earlier, a bucket without a counterpart, such as 29 February, is null. Over a `comparisonRange` it holds every bucket of that range, so it is longer than `buckets` when the range is longer: draw the first `buckets.length` values and summarise them all.
     *
     * @return list<float>|null
     */
    public function getPreviousTotal(): ?array
    {
        return $this->previousTotal;
    }
    /**
     * `total` over the `comparison` period or the `comparisonRange`, bucket by bucket beside `buckets`; only with one of them. A year earlier, a bucket without a counterpart, such as 29 February, is null. Over a `comparisonRange` it holds every bucket of that range, so it is longer than `buckets` when the range is longer: draw the first `buckets.length` values and summarise them all.
     *
     * @param list<float>|null $previousTotal
     *
     * @return self
     */
    public function setPreviousTotal(?array $previousTotal): self
    {
        $this->initialized['previousTotal'] = true;
        $this->previousTotal = $previousTotal;
        return $this;
    }
    /**
     * One series per group of the split, biggest first; none without one.
     *
     * @return list<AnalyticsMetricResultSeriesItem>
     */
    public function getSeries(): array
    {
        return $this->series;
    }
    /**
     * One series per group of the split, biggest first; none without one.
     *
     * @param list<AnalyticsMetricResultSeriesItem> $series
     *
     * @return self
     */
    public function setSeries(array $series): self
    {
        $this->initialized['series'] = true;
        $this->series = $series;
        return $this;
    }
    /**
     * Whether the values are withheld because a trait or a group's property narrowed them to fewer than five people.
     *
     * @return bool
     */
    public function getIsWithheld(): bool
    {
        return $this->isWithheld;
    }
    /**
     * Whether the values are withheld because a trait or a group's property narrowed them to fewer than five people.
     *
     * @param bool $isWithheld
     *
     * @return self
     */
    public function setIsWithheld(bool $isWithheld): self
    {
        $this->initialized['isWithheld'] = true;
        $this->isWithheld = $isWithheld;
        return $this;
    }
    /**
     * Whether one row can count in several groups of the split, as a person in two cohorts does, so the groups don't add up to `total`: shares of the total and stacked charts mean nothing. False without a split.
     *
     * @return bool
     */
    public function getHasOverlappingGroups(): bool
    {
        return $this->hasOverlappingGroups;
    }
    /**
     * Whether one row can count in several groups of the split, as a person in two cohorts does, so the groups don't add up to `total`: shares of the total and stacked charts mean nothing. False without a split.
     *
     * @param bool $hasOverlappingGroups
     *
     * @return self
     */
    public function setHasOverlappingGroups(bool $hasOverlappingGroups): self
    {
        $this->initialized['hasOverlappingGroups'] = true;
        $this->hasOverlappingGroups = $hasOverlappingGroups;
        return $this;
    }
}