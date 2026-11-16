<?php

namespace Voidhash\Generated\Core\Model;

class AdAmount
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
     * The amount, in minor units of `currency`.
     *
     * @var int
     */
    protected $amount;
    /**
     * ISO 4217 code of the amount, the ad account's.
     *
     * @var string
     */
    protected $currency;
    /**
     * The amount, in minor units of `currency`.
     *
     * @return int
     */
    public function getAmount(): int
    {
        return $this->amount;
    }
    /**
     * The amount, in minor units of `currency`.
     *
     * @param int $amount
     *
     * @return self
     */
    public function setAmount(int $amount): self
    {
        $this->initialized['amount'] = true;
        $this->amount = $amount;
        return $this;
    }
    /**
     * ISO 4217 code of the amount, the ad account's.
     *
     * @return string
     */
    public function getCurrency(): string
    {
        return $this->currency;
    }
    /**
     * ISO 4217 code of the amount, the ad account's.
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