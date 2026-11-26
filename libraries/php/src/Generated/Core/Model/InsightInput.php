<?php

namespace Voidhash\Generated\Core\Model;

class InsightInput
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
     * The question asked: trends, funnels, retention, paths, stickiness, lifecycle; `trends` unless given.
     *
     * @var string
     */
    protected $kind;
    /**
     * What is measured, 1 to 8 series: a trend's lines, a funnel's steps in order, retention's start and return events, or the events stickiness and lifecycle read.
     *
     * @var list<SeriesBasis>
     */
    protected $series;
    /**
     * How it draws: its chart (`trend`), one number with a sparkline (`number`), or its groups as bars (`breakdown`); `trend` unless given.
     *
     * @var string
     */
    protected $display;
    /**
     * The days it covers: a named range, which moves with today, or `YYYY-MM-DD..YYYY-MM-DD`; `last_30d` unless given.
     *
     * @var mixed
     */
    protected $range;
    /**
     * Whether it compares with an earlier period: the days of `comparisonRange` when given, else the one `comparison` names. True unless given: a new insight compares with the period before.
     *
     * @var bool
     */
    protected $compare;
    /**
     * What it compares with: `previous_period` or `previous_year`; the previous period unless given.
     *
     * @var string
     */
    protected $comparison;
    /**
     * @var string
     */
    protected $comparisonRange;
    /**
     * The periods it counts in: daily, weekly, monthly, or calendar quarterly or yearly, in the request's time zone; weekly unless given. Stickiness counts in days, weeks or months only.
     *
     * @var string
     */
    protected $granularity;
    /**
     * Whether releases and other changes are marked on the chart; true unless given.
     *
     * @var bool
     */
    protected $markers;
    /**
     * Filters every series takes where they apply, at most 10; none unless given.
     *
     * @var list<ExploreFilter>
     */
    protected $filters;
    /**
     * @var ExploreStoreDimension|ExploreProductDimension|ExploreCountryDimension|ExploreBillingPeriodDimension|ExplorePaywallDimension|ExplorePlacementDimension|ExploreOfferDimension|ExploreAcquisitionSourceDimension|ExplorePlanDimension|ExploreTraitDimension|ExplorePropertyDimension|ExploreCohortDimension|ExploreGroupDimension
     */
    protected $split;
    /**
     * Whom a funnel, retention, stickiness or lifecycle counts: `person`, `session` (funnels only), the groups of a `group` type, or the values of an event `property`. People unless given.
     *
     * @var mixed
     */
    protected $actor;
    /**
     * A funnel's rules; defaults unless given.
     *
     * @var InsightInputFunnel
     */
    protected $funnel;
    /**
     * Retention's rules; defaults unless given.
     *
     * @var InsightInputRetention
     */
    protected $retention;
    /**
     * Which paths are followed; defaults unless given.
     *
     * @var InsightInputPaths
     */
    protected $paths;
    /**
     * How stickiness counts; defaults unless given.
     *
     * @var InsightInputStickiness
     */
    protected $stickiness;
    /**
     * How lifecycle shows its groups; defaults unless given.
     *
     * @var InsightInputLifecycle
     */
    protected $lifecycle;
    /**
     * What a trend computes and how it draws; defaults unless given.
     *
     * @var InsightInputTrend
     */
    protected $trend;
    /**
     * The question asked: trends, funnels, retention, paths, stickiness, lifecycle; `trends` unless given.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * The question asked: trends, funnels, retention, paths, stickiness, lifecycle; `trends` unless given.
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
     * What is measured, 1 to 8 series: a trend's lines, a funnel's steps in order, retention's start and return events, or the events stickiness and lifecycle read.
     *
     * @return list<SeriesBasis>
     */
    public function getSeries(): array
    {
        return $this->series;
    }
    /**
     * What is measured, 1 to 8 series: a trend's lines, a funnel's steps in order, retention's start and return events, or the events stickiness and lifecycle read.
     *
     * @param list<SeriesBasis> $series
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
     * How it draws: its chart (`trend`), one number with a sparkline (`number`), or its groups as bars (`breakdown`); `trend` unless given.
     *
     * @return string
     */
    public function getDisplay(): string
    {
        return $this->display;
    }
    /**
     * How it draws: its chart (`trend`), one number with a sparkline (`number`), or its groups as bars (`breakdown`); `trend` unless given.
     *
     * @param string $display
     *
     * @return self
     */
    public function setDisplay(string $display): self
    {
        $this->initialized['display'] = true;
        $this->display = $display;
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
    /**
     * Whether it compares with an earlier period: the days of `comparisonRange` when given, else the one `comparison` names. True unless given: a new insight compares with the period before.
     *
     * @return bool
     */
    public function getCompare(): bool
    {
        return $this->compare;
    }
    /**
     * Whether it compares with an earlier period: the days of `comparisonRange` when given, else the one `comparison` names. True unless given: a new insight compares with the period before.
     *
     * @param bool $compare
     *
     * @return self
     */
    public function setCompare(bool $compare): self
    {
        $this->initialized['compare'] = true;
        $this->compare = $compare;
        return $this;
    }
    /**
     * What it compares with: `previous_period` or `previous_year`; the previous period unless given.
     *
     * @return string
     */
    public function getComparison(): string
    {
        return $this->comparison;
    }
    /**
     * What it compares with: `previous_period` or `previous_year`; the previous period unless given.
     *
     * @param string $comparison
     *
     * @return self
     */
    public function setComparison(string $comparison): self
    {
        $this->initialized['comparison'] = true;
        $this->comparison = $comparison;
        return $this;
    }
    /**
     * @return string
     */
    public function getComparisonRange(): string
    {
        return $this->comparisonRange;
    }
    /**
     * @param string $comparisonRange
     *
     * @return self
     */
    public function setComparisonRange(string $comparisonRange): self
    {
        $this->initialized['comparisonRange'] = true;
        $this->comparisonRange = $comparisonRange;
        return $this;
    }
    /**
     * The periods it counts in: daily, weekly, monthly, or calendar quarterly or yearly, in the request's time zone; weekly unless given. Stickiness counts in days, weeks or months only.
     *
     * @return string
     */
    public function getGranularity(): string
    {
        return $this->granularity;
    }
    /**
     * The periods it counts in: daily, weekly, monthly, or calendar quarterly or yearly, in the request's time zone; weekly unless given. Stickiness counts in days, weeks or months only.
     *
     * @param string $granularity
     *
     * @return self
     */
    public function setGranularity(string $granularity): self
    {
        $this->initialized['granularity'] = true;
        $this->granularity = $granularity;
        return $this;
    }
    /**
     * Whether releases and other changes are marked on the chart; true unless given.
     *
     * @return bool
     */
    public function getMarkers(): bool
    {
        return $this->markers;
    }
    /**
     * Whether releases and other changes are marked on the chart; true unless given.
     *
     * @param bool $markers
     *
     * @return self
     */
    public function setMarkers(bool $markers): self
    {
        $this->initialized['markers'] = true;
        $this->markers = $markers;
        return $this;
    }
    /**
     * Filters every series takes where they apply, at most 10; none unless given.
     *
     * @return list<ExploreFilter>
     */
    public function getFilters(): array
    {
        return $this->filters;
    }
    /**
     * Filters every series takes where they apply, at most 10; none unless given.
     *
     * @param list<ExploreFilter> $filters
     *
     * @return self
     */
    public function setFilters(array $filters): self
    {
        $this->initialized['filters'] = true;
        $this->filters = $filters;
        return $this;
    }
    /**
     * @return ExploreStoreDimension|ExploreProductDimension|ExploreCountryDimension|ExploreBillingPeriodDimension|ExplorePaywallDimension|ExplorePlacementDimension|ExploreOfferDimension|ExploreAcquisitionSourceDimension|ExplorePlanDimension|ExploreTraitDimension|ExplorePropertyDimension|ExploreCohortDimension|ExploreGroupDimension
     */
    public function getSplit()
    {
        return $this->split;
    }
    /**
     * @param ExploreStoreDimension|ExploreProductDimension|ExploreCountryDimension|ExploreBillingPeriodDimension|ExplorePaywallDimension|ExplorePlacementDimension|ExploreOfferDimension|ExploreAcquisitionSourceDimension|ExplorePlanDimension|ExploreTraitDimension|ExplorePropertyDimension|ExploreCohortDimension|ExploreGroupDimension $split
     *
     * @return self
     */
    public function setSplit($split): self
    {
        $this->initialized['split'] = true;
        $this->split = $split;
        return $this;
    }
    /**
     * Whom a funnel, retention, stickiness or lifecycle counts: `person`, `session` (funnels only), the groups of a `group` type, or the values of an event `property`. People unless given.
     *
     * @return mixed
     */
    public function getActor()
    {
        return $this->actor;
    }
    /**
     * Whom a funnel, retention, stickiness or lifecycle counts: `person`, `session` (funnels only), the groups of a `group` type, or the values of an event `property`. People unless given.
     *
     * @param mixed $actor
     *
     * @return self
     */
    public function setActor($actor): self
    {
        $this->initialized['actor'] = true;
        $this->actor = $actor;
        return $this;
    }
    /**
     * A funnel's rules; defaults unless given.
     *
     * @return InsightInputFunnel
     */
    public function getFunnel(): InsightInputFunnel
    {
        return $this->funnel;
    }
    /**
     * A funnel's rules; defaults unless given.
     *
     * @param InsightInputFunnel $funnel
     *
     * @return self
     */
    public function setFunnel(InsightInputFunnel $funnel): self
    {
        $this->initialized['funnel'] = true;
        $this->funnel = $funnel;
        return $this;
    }
    /**
     * Retention's rules; defaults unless given.
     *
     * @return InsightInputRetention
     */
    public function getRetention(): InsightInputRetention
    {
        return $this->retention;
    }
    /**
     * Retention's rules; defaults unless given.
     *
     * @param InsightInputRetention $retention
     *
     * @return self
     */
    public function setRetention(InsightInputRetention $retention): self
    {
        $this->initialized['retention'] = true;
        $this->retention = $retention;
        return $this;
    }
    /**
     * Which paths are followed; defaults unless given.
     *
     * @return InsightInputPaths
     */
    public function getPaths(): InsightInputPaths
    {
        return $this->paths;
    }
    /**
     * Which paths are followed; defaults unless given.
     *
     * @param InsightInputPaths $paths
     *
     * @return self
     */
    public function setPaths(InsightInputPaths $paths): self
    {
        $this->initialized['paths'] = true;
        $this->paths = $paths;
        return $this;
    }
    /**
     * How stickiness counts; defaults unless given.
     *
     * @return InsightInputStickiness
     */
    public function getStickiness(): InsightInputStickiness
    {
        return $this->stickiness;
    }
    /**
     * How stickiness counts; defaults unless given.
     *
     * @param InsightInputStickiness $stickiness
     *
     * @return self
     */
    public function setStickiness(InsightInputStickiness $stickiness): self
    {
        $this->initialized['stickiness'] = true;
        $this->stickiness = $stickiness;
        return $this;
    }
    /**
     * How lifecycle shows its groups; defaults unless given.
     *
     * @return InsightInputLifecycle
     */
    public function getLifecycle(): InsightInputLifecycle
    {
        return $this->lifecycle;
    }
    /**
     * How lifecycle shows its groups; defaults unless given.
     *
     * @param InsightInputLifecycle $lifecycle
     *
     * @return self
     */
    public function setLifecycle(InsightInputLifecycle $lifecycle): self
    {
        $this->initialized['lifecycle'] = true;
        $this->lifecycle = $lifecycle;
        return $this;
    }
    /**
     * What a trend computes and how it draws; defaults unless given.
     *
     * @return InsightInputTrend
     */
    public function getTrend(): InsightInputTrend
    {
        return $this->trend;
    }
    /**
     * What a trend computes and how it draws; defaults unless given.
     *
     * @param InsightInputTrend $trend
     *
     * @return self
     */
    public function setTrend(InsightInputTrend $trend): self
    {
        $this->initialized['trend'] = true;
        $this->trend = $trend;
        return $this;
    }
}