<?php

namespace Voidhash\Generated\Core\Model;

class AdsObjectSettingsBudget
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
     * `daily` for a budget per day, `lifetime` for one over the whole schedule.
     *
     * @var string
     */
    protected $period;
    /**
     * The budget, in minor units of the change's `currency`.
     *
     * @var int
     */
    protected $amount;
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
     * The budget, in minor units of the change's `currency`.
     *
     * @return int
     */
    public function getAmount(): int
    {
        return $this->amount;
    }
    /**
     * The budget, in minor units of the change's `currency`.
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
}