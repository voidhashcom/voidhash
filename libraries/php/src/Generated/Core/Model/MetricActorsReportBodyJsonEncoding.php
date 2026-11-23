<?php

namespace Voidhash\Generated\Core\Model;

class MetricActorsReportBodyJsonEncoding
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
     * One metric to measure over a time range.
     *
     * @var AnalyticsMetricQuery
     */
    protected $query;
    /**
     * The start of the point's bucket, as one of the result's `buckets` gives it, such as `2026-03-02T00:00:00.000Z`.
     *
     * @var string
     */
    protected $bucketStart;
    /**
     * A key of the result's `series`, `$other` and `$unknown` included, for that group's point; without it, the point of `total`.
     *
     * @var string|null
     */
    protected $group;
    /**
     * Whether the point is the comparison period's beside `bucketStart`, of `previousTotal` or a group's `previousValues`: the bucket at the same position for a `comparisonRange` and for `previous_period`, the one starting a year earlier for `previous_year`. The query needs a `comparison` or a `comparisonRange`. Defaults to false.
     *
     * @var bool|null
     */
    protected $isPrevious;
    /**
     * Only actors whose name, email, distinct id or key contains this, ignoring case; a group by its key or `name` property.
     *
     * @var string|null
     */
    protected $search;
    /**
     * Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *
     * @var string|null
     */
    protected $cursor;
    /**
     * How many actors to return, from 1 to 200. Defaults to 50.
     *
     * @var int|null
     */
    protected $limit;
    /**
     * One metric to measure over a time range.
     *
     * @return AnalyticsMetricQuery
     */
    public function getQuery(): AnalyticsMetricQuery
    {
        return $this->query;
    }
    /**
     * One metric to measure over a time range.
     *
     * @param AnalyticsMetricQuery $query
     *
     * @return self
     */
    public function setQuery(AnalyticsMetricQuery $query): self
    {
        $this->initialized['query'] = true;
        $this->query = $query;
        return $this;
    }
    /**
     * The start of the point's bucket, as one of the result's `buckets` gives it, such as `2026-03-02T00:00:00.000Z`.
     *
     * @return string
     */
    public function getBucketStart(): string
    {
        return $this->bucketStart;
    }
    /**
     * The start of the point's bucket, as one of the result's `buckets` gives it, such as `2026-03-02T00:00:00.000Z`.
     *
     * @param string $bucketStart
     *
     * @return self
     */
    public function setBucketStart(string $bucketStart): self
    {
        $this->initialized['bucketStart'] = true;
        $this->bucketStart = $bucketStart;
        return $this;
    }
    /**
     * A key of the result's `series`, `$other` and `$unknown` included, for that group's point; without it, the point of `total`.
     *
     * @return string|null
     */
    public function getGroup(): ?string
    {
        return $this->group;
    }
    /**
     * A key of the result's `series`, `$other` and `$unknown` included, for that group's point; without it, the point of `total`.
     *
     * @param string|null $group
     *
     * @return self
     */
    public function setGroup(?string $group): self
    {
        $this->initialized['group'] = true;
        $this->group = $group;
        return $this;
    }
    /**
     * Whether the point is the comparison period's beside `bucketStart`, of `previousTotal` or a group's `previousValues`: the bucket at the same position for a `comparisonRange` and for `previous_period`, the one starting a year earlier for `previous_year`. The query needs a `comparison` or a `comparisonRange`. Defaults to false.
     *
     * @return bool|null
     */
    public function getIsPrevious(): ?bool
    {
        return $this->isPrevious;
    }
    /**
     * Whether the point is the comparison period's beside `bucketStart`, of `previousTotal` or a group's `previousValues`: the bucket at the same position for a `comparisonRange` and for `previous_period`, the one starting a year earlier for `previous_year`. The query needs a `comparison` or a `comparisonRange`. Defaults to false.
     *
     * @param bool|null $isPrevious
     *
     * @return self
     */
    public function setIsPrevious(?bool $isPrevious): self
    {
        $this->initialized['isPrevious'] = true;
        $this->isPrevious = $isPrevious;
        return $this;
    }
    /**
     * Only actors whose name, email, distinct id or key contains this, ignoring case; a group by its key or `name` property.
     *
     * @return string|null
     */
    public function getSearch(): ?string
    {
        return $this->search;
    }
    /**
     * Only actors whose name, email, distinct id or key contains this, ignoring case; a group by its key or `name` property.
     *
     * @param string|null $search
     *
     * @return self
     */
    public function setSearch(?string $search): self
    {
        $this->initialized['search'] = true;
        $this->search = $search;
        return $this;
    }
    /**
     * Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *
     * @return string|null
     */
    public function getCursor(): ?string
    {
        return $this->cursor;
    }
    /**
     * Where the page starts: the `pageInfo.endCursor` of the previous page. Omit it for the first page.
     *
     * @param string|null $cursor
     *
     * @return self
     */
    public function setCursor(?string $cursor): self
    {
        $this->initialized['cursor'] = true;
        $this->cursor = $cursor;
        return $this;
    }
    /**
     * How many actors to return, from 1 to 200. Defaults to 50.
     *
     * @return int|null
     */
    public function getLimit(): ?int
    {
        return $this->limit;
    }
    /**
     * How many actors to return, from 1 to 200. Defaults to 50.
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
}