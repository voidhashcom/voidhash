<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsSummary
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
     * The ISO 4217 code of the organization's reporting currency, on monetary insights only.
     *
     * @var string|null
     */
    protected $currency;
    /**
     * The insight over the whole range: the last bucket for MRR, ARR, active subscriptions, active trials and persons; the change over the range for MRR growth rate; the average of the buckets for other rates; else the total. In the units of the sparkline.
     *
     * @var float
     */
    protected $value;
    /**
     * The ISO 4217 code of the organization's reporting currency, on monetary insights only.
     *
     * @return string|null
     */
    public function getCurrency(): ?string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 code of the organization's reporting currency, on monetary insights only.
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
     * The insight over the whole range: the last bucket for MRR, ARR, active subscriptions, active trials and persons; the change over the range for MRR growth rate; the average of the buckets for other rates; else the total. In the units of the sparkline.
     *
     * @return float
     */
    public function getValue(): float
    {
        return $this->value;
    }
    /**
     * The insight over the whole range: the last bucket for MRR, ARR, active subscriptions, active trials and persons; the change over the range for MRR growth rate; the average of the buckets for other rates; else the total. In the units of the sparkline.
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