<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentVariantResultJsonEncoding
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
     * @var mixed
     */
    protected $conversionRate;
    /**
     * @var mixed
     */
    protected $conversions;
    /**
     * @var mixed
     */
    protected $exposures;
    /**
     * @var mixed
     */
    protected $revenueUsd;
    /**
     * @var string
     */
    protected $variantKey;
    /**
     * @return mixed
     */
    public function getConversionRate()
    {
        return $this->conversionRate;
    }
    /**
     * @param mixed $conversionRate
     *
     * @return self
     */
    public function setConversionRate($conversionRate): self
    {
        $this->initialized['conversionRate'] = true;
        $this->conversionRate = $conversionRate;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getConversions()
    {
        return $this->conversions;
    }
    /**
     * @param mixed $conversions
     *
     * @return self
     */
    public function setConversions($conversions): self
    {
        $this->initialized['conversions'] = true;
        $this->conversions = $conversions;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getExposures()
    {
        return $this->exposures;
    }
    /**
     * @param mixed $exposures
     *
     * @return self
     */
    public function setExposures($exposures): self
    {
        $this->initialized['exposures'] = true;
        $this->exposures = $exposures;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getRevenueUsd()
    {
        return $this->revenueUsd;
    }
    /**
     * @param mixed $revenueUsd
     *
     * @return self
     */
    public function setRevenueUsd($revenueUsd): self
    {
        $this->initialized['revenueUsd'] = true;
        $this->revenueUsd = $revenueUsd;
        return $this;
    }
    /**
     * @return string
     */
    public function getVariantKey(): string
    {
        return $this->variantKey;
    }
    /**
     * @param string $variantKey
     *
     * @return self
     */
    public function setVariantKey(string $variantKey): self
    {
        $this->initialized['variantKey'] = true;
        $this->variantKey = $variantKey;
        return $this;
    }
}