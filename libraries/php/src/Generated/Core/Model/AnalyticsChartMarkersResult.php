<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartMarkersResult
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
     * Always `markers`.
     *
     * @var string
     */
    protected $shape;
    /**
     * The changes, oldest first; up to 20 of each kind.
     *
     * @var list<AnalyticsChartMarkersResultMarkersItem>
     */
    protected $markers;
    /**
     * Always `markers`.
     *
     * @return string
     */
    public function getShape(): string
    {
        return $this->shape;
    }
    /**
     * Always `markers`.
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
     * The changes, oldest first; up to 20 of each kind.
     *
     * @return list<AnalyticsChartMarkersResultMarkersItem>
     */
    public function getMarkers(): array
    {
        return $this->markers;
    }
    /**
     * The changes, oldest first; up to 20 of each kind.
     *
     * @param list<AnalyticsChartMarkersResultMarkersItem> $markers
     *
     * @return self
     */
    public function setMarkers(array $markers): self
    {
        $this->initialized['markers'] = true;
        $this->markers = $markers;
        return $this;
    }
}