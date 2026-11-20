<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderProductMoveExplanationJsonEncoding
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
     * Why moving the store product to the product would be refused.
     *
     * @var PaymentProviderProductMoveRefusal
     */
    protected $refusal;
    /**
     * Subscriptions recorded under the store product, which move with it.
     *
     * @var int
     */
    protected $subscriptionCount;
    /**
     * How many of those subscriptions are active.
     *
     * @var int
     */
    protected $activeSubscriptionCount;
    /**
     * One-time purchases recorded under the store product, which move with it.
     *
     * @var int
     */
    protected $purchaseCount;
    /**
     * Slugs of the perks its buyers would gain: those the target product grants and the current one does not.
     *
     * @var list<string>
     */
    protected $perksGained;
    /**
     * Slugs of the perks its buyers would lose: those the current product grants and the target does not.
     *
     * @var list<string>
     */
    protected $perksLost;
    /**
     * Whether the target product would be sold as this store product; `false` when it is already sold as another store product of this provider.
     *
     * @var bool
     */
    protected $isSoldOnTarget;
    /**
     * The mapping the current product would be sold as instead, when it is sold as this one and has another active store product of this provider; `null` otherwise.
     *
     * @var string|null
     */
    protected $promotedMappingId;
    /**
     * Why moving the store product to the product would be refused.
     *
     * @return PaymentProviderProductMoveRefusal
     */
    public function getRefusal(): PaymentProviderProductMoveRefusal
    {
        return $this->refusal;
    }
    /**
     * Why moving the store product to the product would be refused.
     *
     * @param PaymentProviderProductMoveRefusal $refusal
     *
     * @return self
     */
    public function setRefusal(PaymentProviderProductMoveRefusal $refusal): self
    {
        $this->initialized['refusal'] = true;
        $this->refusal = $refusal;
        return $this;
    }
    /**
     * Subscriptions recorded under the store product, which move with it.
     *
     * @return int
     */
    public function getSubscriptionCount(): int
    {
        return $this->subscriptionCount;
    }
    /**
     * Subscriptions recorded under the store product, which move with it.
     *
     * @param int $subscriptionCount
     *
     * @return self
     */
    public function setSubscriptionCount(int $subscriptionCount): self
    {
        $this->initialized['subscriptionCount'] = true;
        $this->subscriptionCount = $subscriptionCount;
        return $this;
    }
    /**
     * How many of those subscriptions are active.
     *
     * @return int
     */
    public function getActiveSubscriptionCount(): int
    {
        return $this->activeSubscriptionCount;
    }
    /**
     * How many of those subscriptions are active.
     *
     * @param int $activeSubscriptionCount
     *
     * @return self
     */
    public function setActiveSubscriptionCount(int $activeSubscriptionCount): self
    {
        $this->initialized['activeSubscriptionCount'] = true;
        $this->activeSubscriptionCount = $activeSubscriptionCount;
        return $this;
    }
    /**
     * One-time purchases recorded under the store product, which move with it.
     *
     * @return int
     */
    public function getPurchaseCount(): int
    {
        return $this->purchaseCount;
    }
    /**
     * One-time purchases recorded under the store product, which move with it.
     *
     * @param int $purchaseCount
     *
     * @return self
     */
    public function setPurchaseCount(int $purchaseCount): self
    {
        $this->initialized['purchaseCount'] = true;
        $this->purchaseCount = $purchaseCount;
        return $this;
    }
    /**
     * Slugs of the perks its buyers would gain: those the target product grants and the current one does not.
     *
     * @return list<string>
     */
    public function getPerksGained(): array
    {
        return $this->perksGained;
    }
    /**
     * Slugs of the perks its buyers would gain: those the target product grants and the current one does not.
     *
     * @param list<string> $perksGained
     *
     * @return self
     */
    public function setPerksGained(array $perksGained): self
    {
        $this->initialized['perksGained'] = true;
        $this->perksGained = $perksGained;
        return $this;
    }
    /**
     * Slugs of the perks its buyers would lose: those the current product grants and the target does not.
     *
     * @return list<string>
     */
    public function getPerksLost(): array
    {
        return $this->perksLost;
    }
    /**
     * Slugs of the perks its buyers would lose: those the current product grants and the target does not.
     *
     * @param list<string> $perksLost
     *
     * @return self
     */
    public function setPerksLost(array $perksLost): self
    {
        $this->initialized['perksLost'] = true;
        $this->perksLost = $perksLost;
        return $this;
    }
    /**
     * Whether the target product would be sold as this store product; `false` when it is already sold as another store product of this provider.
     *
     * @return bool
     */
    public function getIsSoldOnTarget(): bool
    {
        return $this->isSoldOnTarget;
    }
    /**
     * Whether the target product would be sold as this store product; `false` when it is already sold as another store product of this provider.
     *
     * @param bool $isSoldOnTarget
     *
     * @return self
     */
    public function setIsSoldOnTarget(bool $isSoldOnTarget): self
    {
        $this->initialized['isSoldOnTarget'] = true;
        $this->isSoldOnTarget = $isSoldOnTarget;
        return $this;
    }
    /**
     * The mapping the current product would be sold as instead, when it is sold as this one and has another active store product of this provider; `null` otherwise.
     *
     * @return string|null
     */
    public function getPromotedMappingId(): ?string
    {
        return $this->promotedMappingId;
    }
    /**
     * The mapping the current product would be sold as instead, when it is sold as this one and has another active store product of this provider; `null` otherwise.
     *
     * @param string|null $promotedMappingId
     *
     * @return self
     */
    public function setPromotedMappingId(?string $promotedMappingId): self
    {
        $this->initialized['promotedMappingId'] = true;
        $this->promotedMappingId = $promotedMappingId;
        return $this;
    }
}