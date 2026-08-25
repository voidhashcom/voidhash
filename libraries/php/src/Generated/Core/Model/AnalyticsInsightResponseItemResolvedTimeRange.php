<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsInsightResponseItemResolvedTimeRange
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
    protected $end;
    /**
     * @var string
     */
    protected $start;
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
}