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
     * The end of the range, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $end;
    /**
     * The start of the range, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $start;
    /**
     * The end of the range, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The end of the range, as an ISO 8601 timestamp.
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
    /**
     * The start of the range, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The start of the range, as an ISO 8601 timestamp.
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
}