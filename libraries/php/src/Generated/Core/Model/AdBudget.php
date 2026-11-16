<?php

namespace Voidhash\Generated\Core\Model;

class AdBudget
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
     * The budget, in minor units of `currency`.
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
     * `daily` for a budget per day, `lifetime` for one over the whole schedule.
     *
     * @var string
     */
    protected $period;
    /**
     * Where the budget is set: on the `campaign` or the `ad_group`.
     *
     * @var string
     */
    protected $level;
    /**
     * The budget, in minor units of `currency`.
     *
     * @return int
     */
    public function getAmount(): int
    {
        return $this->amount;
    }
    /**
     * The budget, in minor units of `currency`.
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
    /**
     * `daily` for a budget per day, `lifetime` for one over the whole schedule.
     *
     * @return string
     */
    public function getPeriod(): string
    {
        return $this->period;
    }
    /**
     * `daily` for a budget per day, `lifetime` for one over the whole schedule.
     *
     * @param string $period
     *
     * @return self
     */
    public function setPeriod(string $period): self
    {
        $this->initialized['period'] = true;
        $this->period = $period;
        return $this;
    }
    /**
     * Where the budget is set: on the `campaign` or the `ad_group`.
     *
     * @return string
     */
    public function getLevel(): string
    {
        return $this->level;
    }
    /**
     * Where the budget is set: on the `campaign` or the `ad_group`.
     *
     * @param string $level
     *
     * @return self
     */
    public function setLevel(string $level): self
    {
        $this->initialized['level'] = true;
        $this->level = $level;
        return $this;
    }
}