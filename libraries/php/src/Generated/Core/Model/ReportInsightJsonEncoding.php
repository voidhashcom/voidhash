<?php

namespace Voidhash\Generated\Core\Model;

class ReportInsightJsonEncoding
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
     * The insight's id, which `<#insight:ID>` and `<#value:ID>` in the body name.
     *
     * @var string
     */
    protected $id;
    /**
     * The insight's title, shown above its chart.
     *
     * @var string
     */
    protected $title;
    /**
     * What an insight shows: an `insight` asks its own Explore query; a `chart` draws one of the built-in charts.
     *
     * @var string
     */
    protected $kind;
    /**
     * @var InsightInput
     */
    protected $insight;
    /**
     * @var ChartTileInput
     */
    protected $chart;
    /**
     * How many `<#insight:ID>` blocks of the body show it; 0 when only inline values do, or nothing.
     *
     * @var int
     */
    protected $blocks;
    /**
     * How many `<#value:ID>` inline values in the body's text show it.
     *
     * @var int
     */
    protected $values;
    /**
     * The insight's id, which `<#insight:ID>` and `<#value:ID>` in the body name.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The insight's id, which `<#insight:ID>` and `<#value:ID>` in the body name.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The insight's title, shown above its chart.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The insight's title, shown above its chart.
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
     * What an insight shows: an `insight` asks its own Explore query; a `chart` draws one of the built-in charts.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What an insight shows: an `insight` asks its own Explore query; a `chart` draws one of the built-in charts.
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
    /**
     * How many `<#insight:ID>` blocks of the body show it; 0 when only inline values do, or nothing.
     *
     * @return int
     */
    public function getBlocks(): int
    {
        return $this->blocks;
    }
    /**
     * How many `<#insight:ID>` blocks of the body show it; 0 when only inline values do, or nothing.
     *
     * @param int $blocks
     *
     * @return self
     */
    public function setBlocks(int $blocks): self
    {
        $this->initialized['blocks'] = true;
        $this->blocks = $blocks;
        return $this;
    }
    /**
     * How many `<#value:ID>` inline values in the body's text show it.
     *
     * @return int
     */
    public function getValues(): int
    {
        return $this->values;
    }
    /**
     * How many `<#value:ID>` inline values in the body's text show it.
     *
     * @param int $values
     *
     * @return self
     */
    public function setValues(int $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}