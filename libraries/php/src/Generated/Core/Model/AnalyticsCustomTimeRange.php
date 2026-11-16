<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCustomTimeRange
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
     * The end of the range, as an ISO 8601 timestamp. Truncated to the second.
     *
     * @var string
     */
    protected $end;
    /**
     * Always `custom`: the range is `start` to `end`.
     *
     * @var string
     */
    protected $preset;
    /**
     * The start of the range, as an ISO 8601 timestamp, no later than `end`. Truncated to the second.
     *
     * @var string
     */
    protected $start;
    /**
     * The end of the range, as an ISO 8601 timestamp. Truncated to the second.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The end of the range, as an ISO 8601 timestamp. Truncated to the second.
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
     * Always `custom`: the range is `start` to `end`.
     *
     * @return string
     */
    public function getPreset(): string
    {
        return $this->preset;
    }
    /**
     * Always `custom`: the range is `start` to `end`.
     *
     * @param string $preset
     *
     * @return self
     */
    public function setPreset(string $preset): self
    {
        $this->initialized['preset'] = true;
        $this->preset = $preset;
        return $this;
    }
    /**
     * The start of the range, as an ISO 8601 timestamp, no later than `end`. Truncated to the second.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The start of the range, as an ISO 8601 timestamp, no later than `end`. Truncated to the second.
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