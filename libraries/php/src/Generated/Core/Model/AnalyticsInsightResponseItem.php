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
     * @var string
     */
    protected $insightId;
    /**
     * @var string
     */
    protected $key;
    /**
     * @var AnalyticsInsightResponseItemResolvedTimeRange
     */
    protected $resolvedTimeRange;
    /**
     * @var mixed
     */
    protected $result;
    /**
     * @return string
     */
    public function getInsightId(): string
    {
        return $this->insightId;
    }
    /**
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
     * @return AnalyticsInsightResponseItemResolvedTimeRange
     */
    public function getResolvedTimeRange(): AnalyticsInsightResponseItemResolvedTimeRange
    {
        return $this->resolvedTimeRange;
    }
    /**
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
     * @return mixed
     */
    public function getResult()
    {
        return $this->result;
    }
    /**
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