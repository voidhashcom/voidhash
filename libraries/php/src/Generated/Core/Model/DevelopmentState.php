<?php

namespace Voidhash\Generated\Core\Model;

class DevelopmentState
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
     * @var bool
     */
    protected $developmentPurchasesEnabled;
    /**
     * @var list<DevelopmentStateGrantsItem>
     */
    protected $grants;
    /**
     * @var list<DevelopmentStatePurchasesItem>
     */
    protected $purchases;
    /**
     * @var list<DevelopmentStateSubscriptionsItem>
     */
    protected $subscriptions;
    /**
     * @return bool
     */
    public function getDevelopmentPurchasesEnabled(): bool
    {
        return $this->developmentPurchasesEnabled;
    }
    /**
     * @param bool $developmentPurchasesEnabled
     *
     * @return self
     */
    public function setDevelopmentPurchasesEnabled(bool $developmentPurchasesEnabled): self
    {
        $this->initialized['developmentPurchasesEnabled'] = true;
        $this->developmentPurchasesEnabled = $developmentPurchasesEnabled;
        return $this;
    }
    /**
     * @return list<DevelopmentStateGrantsItem>
     */
    public function getGrants(): array
    {
        return $this->grants;
    }
    /**
     * @param list<DevelopmentStateGrantsItem> $grants
     *
     * @return self
     */
    public function setGrants(array $grants): self
    {
        $this->initialized['grants'] = true;
        $this->grants = $grants;
        return $this;
    }
    /**
     * @return list<DevelopmentStatePurchasesItem>
     */
    public function getPurchases(): array
    {
        return $this->purchases;
    }
    /**
     * @param list<DevelopmentStatePurchasesItem> $purchases
     *
     * @return self
     */
    public function setPurchases(array $purchases): self
    {
        $this->initialized['purchases'] = true;
        $this->purchases = $purchases;
        return $this;
    }
    /**
     * @return list<DevelopmentStateSubscriptionsItem>
     */
    public function getSubscriptions(): array
    {
        return $this->subscriptions;
    }
    /**
     * @param list<DevelopmentStateSubscriptionsItem> $subscriptions
     *
     * @return self
     */
    public function setSubscriptions(array $subscriptions): self
    {
        $this->initialized['subscriptions'] = true;
        $this->subscriptions = $subscriptions;
        return $this;
    }
}