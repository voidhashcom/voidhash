<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricComparisonRange
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
     * The start of the compared range, as an ISO 8601 timestamp, no later than `end`. Truncated to the second.
     *
     * @var string
     */
    protected $start;
    /**
     * The end of the compared range, as an ISO 8601 timestamp. Truncated to the second.
     *
     * @var string
     */
    protected $end;
    /**
     * The start of the compared range, as an ISO 8601 timestamp, no later than `end`. Truncated to the second.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The start of the compared range, as an ISO 8601 timestamp, no later than `end`. Truncated to the second.
     *
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
     * The end of the compared range, as an ISO 8601 timestamp. Truncated to the second.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The end of the compared range, as an ISO 8601 timestamp. Truncated to the second.
     *
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