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
     * The arm, `exp_var_...`.
     *
     * @var string
     */
    protected $variantId;
    /**
     * How many end users were shown the arm.
     *
     * @var int
     */
    protected $exposures;
    /**
     * How many of them then sent the primary metric event.
     *
     * @var int
     */
    protected $conversions;
    /**
     * `conversions / exposures`, from 0 to 1; 0 while nobody was shown the arm.
     *
     * @var float
     */
    protected $conversionRate;
    /**
     * Revenue from exposed end users after their exposure, in minor units of `currency` (cents).
     *
     * @var int
     */
    protected $revenue;
    /**
     * The ISO 4217 currency of `revenue`, always `USD`.
     *
     * @var string
     */
    protected $currency;
    /**
     * The arm, `exp_var_...`.
     *
     * @return string
     */
    public function getVariantId(): string
    {
        return $this->variantId;
    }
    /**
     * The arm, `exp_var_...`.
     *
     * @param string $variantId
     *
     * @return self
     */
    public function setVariantId(string $variantId): self
    {
        $this->initialized['variantId'] = true;
        $this->variantId = $variantId;
        return $this;
    }
    /**
     * How many end users were shown the arm.
     *
     * @return int
     */
    public function getExposures(): int
    {
        return $this->exposures;
    }
    /**
     * How many end users were shown the arm.
     *
     * @param int $exposures
     *
     * @return self
     */
    public function setExposures(int $exposures): self
    {
        $this->initialized['exposures'] = true;
        $this->exposures = $exposures;
        return $this;
    }
    /**
     * How many of them then sent the primary metric event.
     *
     * @return int
     */
    public function getConversions(): int
    {
        return $this->conversions;
    }
    /**
     * How many of them then sent the primary metric event.
     *
     * @param int $conversions
     *
     * @return self
     */
    public function setConversions(int $conversions): self
    {
        $this->initialized['conversions'] = true;
        $this->conversions = $conversions;
        return $this;
    }
    /**
     * `conversions / exposures`, from 0 to 1; 0 while nobody was shown the arm.
     *
     * @return float
     */
    public function getConversionRate(): float
    {
        return $this->conversionRate;
    }
    /**
     * `conversions / exposures`, from 0 to 1; 0 while nobody was shown the arm.
     *
     * @param float $conversionRate
     *
     * @return self
     */
    public function setConversionRate(float $conversionRate): self
    {
        $this->initialized['conversionRate'] = true;
        $this->conversionRate = $conversionRate;
        return $this;
    }
    /**
     * Revenue from exposed end users after their exposure, in minor units of `currency` (cents).
     *
     * @return int
     */
    public function getRevenue(): int
    {
        return $this->revenue;
    }
    /**
     * Revenue from exposed end users after their exposure, in minor units of `currency` (cents).
     *
     * @param int $revenue
     *
     * @return self
     */
    public function setRevenue(int $revenue): self
    {
        $this->initialized['revenue'] = true;
        $this->revenue = $revenue;
        return $this;
    }
    /**
     * The ISO 4217 currency of `revenue`, always `USD`.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * The ISO 4217 currency of `revenue`, always `USD`.
     *
     * @param string $currency
     *
     * @return self
     */
    public function setCurrency(string $currency): self
    {
        $this->initialized['currency'] = true;
        $this->currency = $currency;
        return $this;
    }
}