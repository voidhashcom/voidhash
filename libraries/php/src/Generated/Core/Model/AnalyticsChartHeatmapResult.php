<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartHeatmapResult
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
     * Always `heatmap`.
     *
     * @var string
     */
    protected $shape;
    /**
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
     *
     * @var string
     */
    protected $unit;
    /**
     * The row names, in order.
     *
     * @var list<string>
     */
    protected $rows;
    /**
     * The column names, in order.
     *
     * @var list<string>
     */
    protected $columns;
    /**
     * One array per row, one value per column.
     *
     * @var list<list<float>>
     */
    protected $values;
    /**
     * Always `heatmap`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `heatmap`.
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
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
     *
     * @return string
     */
    public function getUnit(): string
    {
        return $this->unit;
    }
    /**
     * What the values are: `count`; `money`, in integer minor units of the result's `currency`; `rate`, a share from 0 to 1; `ratio` or `score`; or a duration in `milliseconds`, `seconds`, `minutes` or `days`.
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
     * The row names, in order.
     *
     * @return list<string>
     */
    public function getRows(): array
    {
        return $this->rows;
    }
    /**
     * The row names, in order.
     *
     * @param list<string> $rows
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
     * The column names, in order.
     *
     * @return list<string>
     */
    public function getColumns(): array
    {
        return $this->columns;
    }
    /**
     * The column names, in order.
     *
     * @param list<string> $columns
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
     * One array per row, one value per column.
     *
     * @return list<list<float>>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * One array per row, one value per column.
     *
     * @param list<list<float>> $values
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