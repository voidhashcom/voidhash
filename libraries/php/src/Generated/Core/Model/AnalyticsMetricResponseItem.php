<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricResponseItem
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
    protected $key;
    /**
     * @var AnalyticsMetricResponseItemResolvedTimeRange
     */
    protected $resolvedTimeRange;
    /**
     * The ISO 4217 code money is in; null for counts.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * @var AnalyticsMetricResult
     */
    protected $result;
    /**
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * @return AnalyticsMetricResponseItemResolvedTimeRange
     */
    public function getResolvedTimeRange(): AnalyticsMetricResponseItemResolvedTimeRange
    {
        return $this->resolvedTimeRange;
    }
    /**
     * @param AnalyticsMetricResponseItemResolvedTimeRange $resolvedTimeRange
     *
     * @return self
     */
    public function setResolvedTimeRange(AnalyticsMetricResponseItemResolvedTimeRange $resolvedTimeRange): self
    {
        $this->initialized['resolvedTimeRange'] = true;
        $this->resolvedTimeRange = $resolvedTimeRange;
        return $this;
    }
    /**
     * The ISO 4217 code money is in; null for counts.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code money is in; null for counts.
     *
     * @param string|null $currency
     *
     * @return self
     */
    public function setCurrency(?string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
    /**
     * @return AnalyticsMetricResult
     */
    public function getResult(): AnalyticsMetricResult
    {
        return $this->result;
    }
    /**
     * @param AnalyticsMetricResult $result
     *
     * @return self
     */
    public function setResult(AnalyticsMetricResult $result): self
    {
        $this->initialized['result'] = true;
        $this->result = $result;
        return $this;
    }
}