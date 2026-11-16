<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartTableResult
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
     * Always `table`.
     *
     * @var string
     */
    protected $shape;
    /**
     * The columns, in order.
     *
     * @var list<AnalyticsChartTableResultColumnsItem>
     */
    protected $columns;
    /**
     * The rows, up to `options.limit`.
     *
     * @var list<AnalyticsChartTableResultRowsItem>
     */
    protected $rows;
    /**
     * Whether rows beyond the limit were left out.
     *
     * @var bool
     */
    protected $isTruncated;
    /**
     * Always `table`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `table`.
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
     * The columns, in order.
     *
     * @return list<AnalyticsChartTableResultColumnsItem>
     */
    public function getColumns(): array
    {
        return $this->columns;
    }
    /**
     * The columns, in order.
     *
     * @param list<AnalyticsChartTableResultColumnsItem> $columns
     *
     * @return self
     */
    public function setColumns(array $columns): self
    {
        $this->initialized['columns'] = true;
        $this->columns = $columns;
        return $this;
    }
    /**
     * The rows, up to `options.limit`.
     *
     * @return list<AnalyticsChartTableResultRowsItem>
     */
    public function getRows(): array
    {
        return $this->rows;
    }
    /**
     * The rows, up to `options.limit`.
     *
     * @param list<AnalyticsChartTableResultRowsItem> $rows
     *
     * @return self
     */
    public function setRows(array $rows): self
    {
        $this->initialized['rows'] = true;
        $this->rows = $rows;
        return $this;
    }
    /**
     * Whether rows beyond the limit were left out.
     *
     * @return bool
     */
    public function getIsTruncated(): bool
    {
        return $this->isTruncated;
    }
    /**
     * Whether rows beyond the limit were left out.
     *
     * @param bool $isTruncated
     *
     * @return self
     */
    public function setIsTruncated(bool $isTruncated): self
    {
        $this->initialized['isTruncated'] = true;
        $this->isTruncated = $isTruncated;
        return $this;
    }
}