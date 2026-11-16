<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsDataPoint
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
     * The start of the point's bucket, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $timestamp;
    /**
     * The insight's value for the bucket: integer minor units of `summary.currency` for money, a percentage such as `12.5` for rates, else a count.
     *
     * @var float
     */
    protected $value;
    /**
     * The start of the point's bucket, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getTimestamp(): string
    {
        return $this->timestamp;
    }
    /**
     * The start of the point's bucket, as an ISO 8601 timestamp.
     *
     * @param string $timestamp
     *
     * @return self
     */
    public function setTimestamp(string $timestamp): self
    {
        $this->initialized['timestamp'] = true;
        $this->timestamp = $timestamp;
        return $this;
    }
    /**
     * The insight's value for the bucket: integer minor units of `summary.currency` for money, a percentage such as `12.5` for rates, else a count.
     *
     * @return float
     */
    public function getValue(): float
    {
        return $this->value;
    }
    /**
     * The insight's value for the bucket: integer minor units of `summary.currency` for money, a percentage such as `12.5` for rates, else a count.
     *
     * @param float $value
     *
     * @return self
     */
    public function setValue(float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
}