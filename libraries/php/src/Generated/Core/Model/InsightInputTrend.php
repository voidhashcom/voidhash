<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputTrend
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
     * Series combined by their letters, such as `A / B * 100`, drawn in their place.
     *
     * @var string
     */
    protected $formula;
    /**
     * Whether each point is the sum of every one up to it.
     *
     * @var bool
     */
    protected $cumulative;
    /**
     * Each point the average of this many up to it, from 1 to 28; 1 leaves them be.
     *
     * @var int
     */
    protected $smoothing;
    /**
     * How the trend draws: auto, line, bar, area, number, table, pie, bar_total; `auto` unless given.
     *
     * @var string
     */
    protected $chart;
    /**
     * Whether the value axis is logarithmic.
     *
     * @var bool
     */
    protected $logScale;
    /**
     * Whether each point is labelled with its value.
     *
     * @var bool
     */
    protected $showValues;
    /**
     * Whether stacked lines draw as shares of their total.
     *
     * @var bool
     */
    protected $percentStack;
    /**
     * Lines across the chart at values to reach, at most 5.
     *
     * @var list<InsightInputTrendGoalsItem>
     */
    protected $goals;
    /**
     * Series combined by their letters, such as `A / B * 100`, drawn in their place.
     *
     * @return string
     */
    public function getFormula(): string
    {
        return $this->formula;
    }
    /**
     * Series combined by their letters, such as `A / B * 100`, drawn in their place.
     *
     * @param string $formula
     *
     * @return self
     */
    public function setFormula(string $formula): self
    {
        $this->initialized['formula'] = true;
        $this->formula = $formula;
        return $this;
    }
    /**
     * Whether each point is the sum of every one up to it.
     *
     * @return bool
     */
    public function getCumulative(): bool
    {
        return $this->cumulative;
    }
    /**
     * Whether each point is the sum of every one up to it.
     *
     * @param bool $cumulative
     *
     * @return self
     */
    public function setCumulative(bool $cumulative): self
    {
        $this->initialized['cumulative'] = true;
        $this->cumulative = $cumulative;
        return $this;
    }
    /**
     * Each point the average of this many up to it, from 1 to 28; 1 leaves them be.
     *
     * @return int
     */
    public function getSmoothing(): int
    {
        return $this->smoothing;
    }
    /**
     * Each point the average of this many up to it, from 1 to 28; 1 leaves them be.
     *
     * @param int $smoothing
     *
     * @return self
     */
    public function setSmoothing(int $smoothing): self
    {
        $this->initialized['smoothing'] = true;
        $this->smoothing = $smoothing;
        return $this;
    }
    /**
     * How the trend draws: auto, line, bar, area, number, table, pie, bar_total; `auto` unless given.
     *
     * @return string
     */
    public function getChart(): string
    {
        return $this->chart;
    }
    /**
     * How the trend draws: auto, line, bar, area, number, table, pie, bar_total; `auto` unless given.
     *
     * @param string $chart
     *
     * @return self
     */
    public function setChart(string $chart): self
    {
        $this->initialized['chart'] = true;
        $this->chart = $chart;
        return $this;
    }
    /**
     * Whether the value axis is logarithmic.
     *
     * @return bool
     */
    public function getLogScale(): bool
    {
        return $this->logScale;
    }
    /**
     * Whether the value axis is logarithmic.
     *
     * @param bool $logScale
     *
     * @return self
     */
    public function setLogScale(bool $logScale): self
    {
        $this->initialized['logScale'] = true;
        $this->logScale = $logScale;
        return $this;
    }
    /**
     * Whether each point is labelled with its value.
     *
     * @return bool
     */
    public function getShowValues(): bool
    {
        return $this->showValues;
    }
    /**
     * Whether each point is labelled with its value.
     *
     * @param bool $showValues
     *
     * @return self
     */
    public function setShowValues(bool $showValues): self
    {
        $this->initialized['showValues'] = true;
        $this->showValues = $showValues;
        return $this;
    }
    /**
     * Whether stacked lines draw as shares of their total.
     *
     * @return bool
     */
    public function getPercentStack(): bool
    {
        return $this->percentStack;
    }
    /**
     * Whether stacked lines draw as shares of their total.
     *
     * @param bool $percentStack
     *
     * @return self
     */
    public function setPercentStack(bool $percentStack): self
    {
        $this->initialized['percentStack'] = true;
        $this->percentStack = $percentStack;
        return $this;
    }
    /**
     * Lines across the chart at values to reach, at most 5.
     *
     * @return list<InsightInputTrendGoalsItem>
     */
    public function getGoals(): array
    {
        return $this->goals;
    }
    /**
     * Lines across the chart at values to reach, at most 5.
     *
     * @param list<InsightInputTrendGoalsItem> $goals
     *
     * @return self
     */
    public function setGoals(array $goals): self
    {
        $this->initialized['goals'] = true;
        $this->goals = $goals;
        return $this;
    }
}