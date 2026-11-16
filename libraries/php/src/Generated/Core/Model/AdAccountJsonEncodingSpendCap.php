<?php

namespace Voidhash\Generated\Core\Model;

class AdAccountJsonEncodingSpendCap
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
     * The limit, in minor units of the account's `currency`.
     *
     * @var int
     */
    protected $amount;
    /**
     * What counts toward the limit so far, in minor units of `currency`.
     *
     * @var int
     */
    protected $spent;
    /**
     * `spent / amount`, rounded to four decimals, such as `0.4215`.
     *
     * @var float
     */
    protected $usedRatio;
    /**
     * The limit, in minor units of the account's `currency`.
     *
     * @return int
     */
    public function getAmount(): int
    {
        return $this->amount;
    }
    /**
     * The limit, in minor units of the account's `currency`.
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
     * What counts toward the limit so far, in minor units of `currency`.
     *
     * @return int
     */
    public function getSpent(): int
    {
        return $this->spent;
    }
    /**
     * What counts toward the limit so far, in minor units of `currency`.
     *
     * @param int $spent
     *
     * @return self
     */
    public function setSpent(int $spent): self
    {
        $this->initialized['spent'] = true;
        $this->spent = $spent;
        return $this;
    }
    /**
     * `spent / amount`, rounded to four decimals, such as `0.4215`.
     *
     * @return float
     */
    public function getUsedRatio(): float
    {
        return $this->usedRatio;
    }
    /**
     * `spent / amount`, rounded to four decimals, such as `0.4215`.
     *
     * @param float $usedRatio
     *
     * @return self
     */
    public function setUsedRatio(float $usedRatio): self
    {
        $this->initialized['usedRatio'] = true;
        $this->usedRatio = $usedRatio;
        return $this;
    }
}