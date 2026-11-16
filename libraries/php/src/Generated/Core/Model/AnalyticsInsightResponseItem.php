<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsInsightResponseItem
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
     * The insight computed.
     *
     * @var string
     */
    protected $insightId;
    /**
     * The `key` of the query this result answers.
     *
     * @var string
     */
    protected $key;
    /**
     * The absolute range the query's time range resolved to.
     *
     * @var AnalyticsInsightResponseItemResolvedTimeRange
     */
    protected $resolvedTimeRange;
    /**
     * The computed insight, tagged by `kind`. Built-in insights currently return `metric`.
     *
     * @var mixed
     */
    protected $result;
    /**
     * The insight computed.
     *
     * @return string
     */
    public function getInsightId(): string
    {
        return $this->insightId;
    }
    /**
     * The insight computed.
     *
     * @param string $insightId
     *
     * @return self
     */
    public function setInsightId(string $insightId): self
    {
        $this->initialized['insightId'] = true;
        $this->insightId = $insightId;
        return $this;
    }
    /**
     * The `key` of the query this result answers.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The `key` of the query this result answers.
     *
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
     * The absolute range the query's time range resolved to.
     *
     * @return AnalyticsInsightResponseItemResolvedTimeRange
     */
    public function getResolvedTimeRange(): AnalyticsInsightResponseItemResolvedTimeRange
    {
        return $this->resolvedTimeRange;
    }
    /**
     * The absolute range the query's time range resolved to.
     *
     * @param AnalyticsInsightResponseItemResolvedTimeRange $resolvedTimeRange
     *
     * @return self
     */
    public function setResolvedTimeRange(AnalyticsInsightResponseItemResolvedTimeRange $resolvedTimeRange): self
    {
        $this->initialized['resolvedTimeRange'] = true;
        $this->resolvedTimeRange = $resolvedTimeRange;
        return $this;
    }
    /**
     * The computed insight, tagged by `kind`. Built-in insights currently return `metric`.
     *
     * @return mixed
     */
    public function getResult()
    {
        return $this->result;
    }
    /**
     * The computed insight, tagged by `kind`. Built-in insights currently return `metric`.
     *
     * @param mixed $result
     *
     * @return self
     */
    public function setResult($result): self
    {
        $this->initialized['result'] = true;
        $this->result = $result;
        return $this;
    }
}