<?php

namespace Voidhash\Generated\Core\Model;

class ChartTileInput
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
     * The built-in chart drawn, by its id in the chart catalog.
     *
     * @var string
     */
    protected $chartId;
    /**
     * The days it covers: a named range, which moves with today, or `YYYY-MM-DD..YYYY-MM-DD`; `last_30d` unless given.
     *
     * @var mixed
     */
    protected $range;
    /**
     * The built-in chart drawn, by its id in the chart catalog.
     *
     * @return string
     */
    public function getChartId(): string
    {
        return $this->chartId;
    }
    /**
     * The built-in chart drawn, by its id in the chart catalog.
     *
     * @param string $chartId
     *
     * @return self
     */
    public function setChartId(string $chartId): self
    {
        $this->initialized['chartId'] = true;
        $this->chartId = $chartId;
        return $this;
    }
    /**
     * The days it covers: a named range, which moves with today, or `YYYY-MM-DD..YYYY-MM-DD`; `last_30d` unless given.
     *
     * @return mixed
     */
    public function getRange()
    {
        return $this->range;
    }
    /**
     * The days it covers: a named range, which moves with today, or `YYYY-MM-DD..YYYY-MM-DD`; `last_30d` unless given.
     *
     * @param mixed $range
     *
     * @return self
     */
    public function setRange($range): self
    {
        $this->initialized['range'] = true;
        $this->range = $range;
        return $this;
    }
}