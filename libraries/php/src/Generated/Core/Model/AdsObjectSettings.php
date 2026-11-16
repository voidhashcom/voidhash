<?php

namespace Voidhash\Generated\Core\Model;

class AdsObjectSettings
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
     * What the advertiser set on the platform: `on`, `paused` or `removed`.
     *
     * @var string
     */
    protected $status;
    /**
     * The object's own budget; null when it has none. Left out when the decision did not change it.
     *
     * @var AdsObjectSettingsBudget|null
     */
    protected $budget;
    /**
     * How the platform bids: `lowest_cost`, `cost_cap`, `bid_cap`, `min_roas`, `manual` or `other`; null when it sets none. Left out when the decision did not change it.
     *
     * @var string|null
     */
    protected $bidStrategy;
    /**
     * What the advertiser set on the platform: `on`, `paused` or `removed`.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * What the advertiser set on the platform: `on`, `paused` or `removed`.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * The object's own budget; null when it has none. Left out when the decision did not change it.
     *
     * @return AdsObjectSettingsBudget|null
     */
    public function getBudget(): ?AdsObjectSettingsBudget
    {
        return $this->budget;
    }
    /**
     * The object's own budget; null when it has none. Left out when the decision did not change it.
     *
     * @param AdsObjectSettingsBudget|null $budget
     *
     * @return self
     */
    public function setBudget(?AdsObjectSettingsBudget $budget): self
    {
        $this->initialized['budget'] = true;
        $this->budget = $budget;
        return $this;
    }
    /**
     * How the platform bids: `lowest_cost`, `cost_cap`, `bid_cap`, `min_roas`, `manual` or `other`; null when it sets none. Left out when the decision did not change it.
     *
     * @return string|null
     */
    public function getBidStrategy(): ?string
    {
        return $this->bidStrategy;
    }
    /**
     * How the platform bids: `lowest_cost`, `cost_cap`, `bid_cap`, `min_roas`, `manual` or `other`; null when it sets none. Left out when the decision did not change it.
     *
     * @param string|null $bidStrategy
     *
     * @return self
     */
    public function setBidStrategy(?string $bidStrategy): self
    {
        $this->initialized['bidStrategy'] = true;
        $this->bidStrategy = $bidStrategy;
        return $this;
    }
}