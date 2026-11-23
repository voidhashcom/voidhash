<?php

namespace Voidhash\Generated\Core\Model;

class CreateReportInsightBodyJsonEncoding
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
     * The insight's title, 1 to 255 characters.
     *
     * @var string
     */
    protected $title;
    /**
     * @var InsightInput
     */
    protected $insight;
    /**
     * @var ChartTileInput
     */
    protected $chart;
    /**
     * The insight's title, 1 to 255 characters.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The insight's title, 1 to 255 characters.
     *
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * @return InsightInput
     */
    public function getInsight(): InsightInput
    {
        return $this->insight;
    }
    /**
     * @param InsightInput $insight
     *
     * @return self
     */
    public function setInsight(InsightInput $insight): self
    {
        $this->initialized['insight'] = true;
        $this->insight = $insight;
        return $this;
    }
    /**
     * @return ChartTileInput
     */
    public function getChart(): ChartTileInput
    {
        return $this->chart;
    }
    /**
     * @param ChartTileInput $chart
     *
     * @return self
     */
    public function setChart(ChartTileInput $chart): self
    {
        $this->initialized['chart'] = true;
        $this->chart = $chart;
        return $this;
    }
}