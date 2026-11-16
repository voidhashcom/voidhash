<?php

namespace Voidhash\Generated\Core\Model;

class FeatureFlagServeJsonEncoding
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
     * The share of matching end users who get the flag, from 0 to 100 in steps of 0.01; the rest get it off. The share is stable: raising it keeps those who already had the flag.
     *
     * @var float
     */
    protected $rolloutPercentage;
    /**
     * The `key` of the variant they get; null splits them across the flag's variants by weight, and is the only choice for a `boolean` flag.
     *
     * @var string|null
     */
    protected $variantKey;
    /**
     * The share of matching end users who get the flag, from 0 to 100 in steps of 0.01; the rest get it off. The share is stable: raising it keeps those who already had the flag.
     *
     * @return float
     */
    public function getRolloutPercentage(): float
    {
        return $this->rolloutPercentage;
    }
    /**
     * The share of matching end users who get the flag, from 0 to 100 in steps of 0.01; the rest get it off. The share is stable: raising it keeps those who already had the flag.
     *
     * @param float $rolloutPercentage
     *
     * @return self
     */
    public function setRolloutPercentage(float $rolloutPercentage): self
    {
        $this->initialized['rolloutPercentage'] = true;
        $this->rolloutPercentage = $rolloutPercentage;
        return $this;
    }
    /**
     * The `key` of the variant they get; null splits them across the flag's variants by weight, and is the only choice for a `boolean` flag.
     *
     * @return string|null
     */
    public function getVariantKey(): ?string
    {
        return $this->variantKey;
    }
    /**
     * The `key` of the variant they get; null splits them across the flag's variants by weight, and is the only choice for a `boolean` flag.
     *
     * @param string|null $variantKey
     *
     * @return self
     */
    public function setVariantKey(?string $variantKey): self
    {
        $this->initialized['variantKey'] = true;
        $this->variantKey = $variantKey;
        return $this;
    }
}