<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricResponseItemResolvedTimeRange
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
     * @var string
     */
    protected $start;
    /**
     * @var string
     */
    protected $end;
    /**
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
}