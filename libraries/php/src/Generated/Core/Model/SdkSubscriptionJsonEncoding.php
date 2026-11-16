<?php

namespace Voidhash\Generated\Core\Model;

class SdkSubscriptionJsonEncoding
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
     * When the store first failed to charge a renewal, as an ISO 8601 timestamp; null without a billing issue.
     *
     * @var string|null
     */
    protected $billingIssueDetectedAt;
    /**
     * When auto-renew was turned off or the subscription was canceled, as an ISO 8601 timestamp; null while it renews.
     *
     * @var string|null
     */
    protected $canceledAt;
    /**
     * Where the purchase was made: `production`, a store `sandbox`, or `test` for simulated purchases.
     *
     * @var string
     */
    protected $environment;
    /**
     * When the current period ends, as an ISO 8601 timestamp; null when the store reported none.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * When the store's billing grace period ends, as an ISO 8601 timestamp; null outside one. Google Play does not report the end of a grace period, so for Google Play this is the latest it can end; Google ends it sooner by putting the subscription on hold, ending it, or recovering the payment.
     *
     * @var string|null
     */
    protected $gracePeriodExpiresAt;
    /**
     * Whether the person has access through App Store Family Sharing rather than their own purchase.
     *
     * @var bool
     */
    protected $isFamilyShared;
    /**
     * The store's id of the offer the current period was bought with; null without one. Google Play keeps naming the offer a subscription was bought with after its offer phases end.
     *
     * @var string|null
     */
    protected $offerId;
    /**
     * @var SdkSubscriptionPendingPriceJsonEncoding
     */
    protected $pendingPrice;
    /**
     * How the current period is priced: `trial` (free), `intro` (an offer's discounted price) or `regular`.
     *
     * @var string
     */
    protected $periodType;
    /**
     * The id of the subscription's product; null when its store product is not linked to one.
     *
     * @var string|null
     */
    protected $productId;
    /**
     * The slug of the subscription's product; null when its store product is not linked to one.
     *
     * @var string|null
     */
    protected $productSlug;
    /**
     * When the charge of the current period was refunded, as an ISO 8601 timestamp; null when it was not. A Google Play refund alone does not end access.
     *
     * @var string|null
     */
    protected $refundedAt;
    /**
     * The slug of the product the subscription renews into, after a downgrade or crossgrade the store applies at renewal; null when it renews as it is.
     *
     * @var string|null
     */
    protected $renewsToProductSlug;
    /**
     * When a paused subscription resumes on its own, as an ISO 8601 timestamp; null when it is not paused or the store did not say.
     *
     * @var string|null
     */
    protected $resumesAt;
    /**
     * When the store withdrew access before the period ended, as an ISO 8601 timestamp; null when it did not.
     *
     * @var string|null
     */
    protected $revokedAt;
    /**
     * When the current period started, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $startsAt;
    /**
     * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
     *
     * @var string
     */
    protected $status;
    /**
     * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
     *
     * @var string
     */
    protected $store;
    /**
     * The subscription's id.
     *
     * @var string
     */
    protected $subscriptionId;
    /**
     * Whether the store renews the subscription at the end of the current period, into `renewsToProductSlug` when set.
     *
     * @var bool
     */
    protected $willRenew;
    /**
     * When the store first failed to charge a renewal, as an ISO 8601 timestamp; null without a billing issue.
     *
     * @return string|null
     */
    public function getBillingIssueDetectedAt(): ?string
    {
        return $this->billingIssueDetectedAt;
    }
    /**
     * When the store first failed to charge a renewal, as an ISO 8601 timestamp; null without a billing issue.
     *
     * @param string|null $billingIssueDetectedAt
     *
     * @return self
     */
    public function setBillingIssueDetectedAt(?string $billingIssueDetectedAt): self
    {
        $this->initialized['billingIssueDetectedAt'] = true;
        $this->billingIssueDetectedAt = $billingIssueDetectedAt;
        return $this;
    }
    /**
     * When auto-renew was turned off or the subscription was canceled, as an ISO 8601 timestamp; null while it renews.
     *
     * @return string|null
     */
    public function getCanceledAt(): ?string
    {
        return $this->canceledAt;
    }
    /**
     * When auto-renew was turned off or the subscription was canceled, as an ISO 8601 timestamp; null while it renews.
     *
     * @param string|null $canceledAt
     *
     * @return self
     */
    public function setCanceledAt(?string $canceledAt): self
    {
        $this->initialized['canceledAt'] = true;
        $this->canceledAt = $canceledAt;
        return $this;
    }
    /**
     * Where the purchase was made: `production`, a store `sandbox`, or `test` for simulated purchases.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Where the purchase was made: `production`, a store `sandbox`, or `test` for simulated purchases.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * When the current period ends, as an ISO 8601 timestamp; null when the store reported none.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the current period ends, as an ISO 8601 timestamp; null when the store reported none.
     *
     * @param string|null $expiresAt
     *
     * @return self
     */
    public function setExpiresAt(?string $expiresAt): self
    {
        $this->initialized['expiresAt'] = true;
        $this->expiresAt = $expiresAt;
        return $this;
    }
    /**
     * When the store's billing grace period ends, as an ISO 8601 timestamp; null outside one. Google Play does not report the end of a grace period, so for Google Play this is the latest it can end; Google ends it sooner by putting the subscription on hold, ending it, or recovering the payment.
     *
     * @return string|null
     */
    public function getGracePeriodExpiresAt(): ?string
    {
        return $this->gracePeriodExpiresAt;
    }
    /**
     * When the store's billing grace period ends, as an ISO 8601 timestamp; null outside one. Google Play does not report the end of a grace period, so for Google Play this is the latest it can end; Google ends it sooner by putting the subscription on hold, ending it, or recovering the payment.
     *
     * @param string|null $gracePeriodExpiresAt
     *
     * @return self
     */
    public function setGracePeriodExpiresAt(?string $gracePeriodExpiresAt): self
    {
        $this->initialized['gracePeriodExpiresAt'] = true;
        $this->gracePeriodExpiresAt = $gracePeriodExpiresAt;
        return $this;
    }
    /**
     * Whether the person has access through App Store Family Sharing rather than their own purchase.
     *
     * @return bool
     */
    public function getIsFamilyShared(): bool
    {
        return $this->isFamilyShared;
    }
    /**
     * Whether the person has access through App Store Family Sharing rather than their own purchase.
     *
     * @param bool $isFamilyShared
     *
     * @return self
     */
    public function setIsFamilyShared(bool $isFamilyShared): self
    {
        $this->initialized['isFamilyShared'] = true;
        $this->isFamilyShared = $isFamilyShared;
        return $this;
    }
    /**
     * The store's id of the offer the current period was bought with; null without one. Google Play keeps naming the offer a subscription was bought with after its offer phases end.
     *
     * @return string|null
     */
    public function getOfferId(): ?string
    {
        return $this->offerId;
    }
    /**
     * The store's id of the offer the current period was bought with; null without one. Google Play keeps naming the offer a subscription was bought with after its offer phases end.
     *
     * @param string|null $offerId
     *
     * @return self
     */
    public function setOfferId(?string $offerId): self
    {
        $this->initialized['offerId'] = true;
        $this->offerId = $offerId;
        return $this;
    }
    /**
     * @return SdkSubscriptionPendingPriceJsonEncoding
     */
    public function getPendingPrice(): SdkSubscriptionPendingPriceJsonEncoding
    {
        return $this->pendingPrice;
    }
    /**
     * @param SdkSubscriptionPendingPriceJsonEncoding $pendingPrice
     *
     * @return self
     */
    public function setPendingPrice(SdkSubscriptionPendingPriceJsonEncoding $pendingPrice): self
    {
        $this->initialized['pendingPrice'] = true;
        $this->pendingPrice = $pendingPrice;
        return $this;
    }
    /**
     * How the current period is priced: `trial` (free), `intro` (an offer's discounted price) or `regular`.
     *
     * @return string
     */
    public function getPeriodType(): string
    {
        return $this->periodType;
    }
    /**
     * How the current period is priced: `trial` (free), `intro` (an offer's discounted price) or `regular`.
     *
     * @param string $periodType
     *
     * @return self
     */
    public function setPeriodType(string $periodType): self
    {
        $this->initialized['periodType'] = true;
        $this->periodType = $periodType;
        return $this;
    }
    /**
     * The id of the subscription's product; null when its store product is not linked to one.
     *
     * @return string|null
     */
    public function getProductId(): ?string
    {
        return $this->productId;
    }
    /**
     * The id of the subscription's product; null when its store product is not linked to one.
     *
     * @param string|null $productId
     *
     * @return self
     */
    public function setProductId(?string $productId): self
    {
        $this->initialized['productId'] = true;
        $this->productId = $productId;
        return $this;
    }
    /**
     * The slug of the subscription's product; null when its store product is not linked to one.
     *
     * @return string|null
     */
    public function getProductSlug(): ?string
    {
        return $this->productSlug;
    }
    /**
     * The slug of the subscription's product; null when its store product is not linked to one.
     *
     * @param string|null $productSlug
     *
     * @return self
     */
    public function setProductSlug(?string $productSlug): self
    {
        $this->initialized['productSlug'] = true;
        $this->productSlug = $productSlug;
        return $this;
    }
    /**
     * When the charge of the current period was refunded, as an ISO 8601 timestamp; null when it was not. A Google Play refund alone does not end access.
     *
     * @return string|null
     */
    public function getRefundedAt(): ?string
    {
        return $this->refundedAt;
    }
    /**
     * When the charge of the current period was refunded, as an ISO 8601 timestamp; null when it was not. A Google Play refund alone does not end access.
     *
     * @param string|null $refundedAt
     *
     * @return self
     */
    public function setRefundedAt(?string $refundedAt): self
    {
        $this->initialized['refundedAt'] = true;
        $this->refundedAt = $refundedAt;
        return $this;
    }
    /**
     * The slug of the product the subscription renews into, after a downgrade or crossgrade the store applies at renewal; null when it renews as it is.
     *
     * @return string|null
     */
    public function getRenewsToProductSlug(): ?string
    {
        return $this->renewsToProductSlug;
    }
    /**
     * The slug of the product the subscription renews into, after a downgrade or crossgrade the store applies at renewal; null when it renews as it is.
     *
     * @param string|null $renewsToProductSlug
     *
     * @return self
     */
    public function setRenewsToProductSlug(?string $renewsToProductSlug): self
    {
        $this->initialized['renewsToProductSlug'] = true;
        $this->renewsToProductSlug = $renewsToProductSlug;
        return $this;
    }
    /**
     * When a paused subscription resumes on its own, as an ISO 8601 timestamp; null when it is not paused or the store did not say.
     *
     * @return string|null
     */
    public function getResumesAt(): ?string
    {
        return $this->resumesAt;
    }
    /**
     * When a paused subscription resumes on its own, as an ISO 8601 timestamp; null when it is not paused or the store did not say.
     *
     * @param string|null $resumesAt
     *
     * @return self
     */
    public function setResumesAt(?string $resumesAt): self
    {
        $this->initialized['resumesAt'] = true;
        $this->resumesAt = $resumesAt;
        return $this;
    }
    /**
     * When the store withdrew access before the period ended, as an ISO 8601 timestamp; null when it did not.
     *
     * @return string|null
     */
    public function getRevokedAt(): ?string
    {
        return $this->revokedAt;
    }
    /**
     * When the store withdrew access before the period ended, as an ISO 8601 timestamp; null when it did not.
     *
     * @param string|null $revokedAt
     *
     * @return self
     */
    public function setRevokedAt(?string $revokedAt): self
    {
        $this->initialized['revokedAt'] = true;
        $this->revokedAt = $revokedAt;
        return $this;
    }
    /**
     * When the current period started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartsAt(): string
    {
        return $this->startsAt;
    }
    /**
     * When the current period started, as an ISO 8601 timestamp.
     *
     * @param string $startsAt
     *
     * @return self
     */
    public function setStartsAt(string $startsAt): self
    {
        $this->initialized['startsAt'] = true;
        $this->startsAt = $startsAt;
        return $this;
    }
    /**
     * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * Where the subscription stands: `active`, `trialing` in a free trial, `in_grace_period` while the store retries a failed payment and access continues, `in_billing_retry` while it retries without access, `on_hold` while Google Play holds it after a failed payment, `paused` while Google Play pauses it, `expired` once it ended, or `revoked` once the store withdrew access, as for a refund. Access comes from `entitlements`, never from this.
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
     * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
     *
     * @return string
     */
    public function getStore(): string
    {
        return $this->store;
    }
    /**
     * Where the subscription was bought: `app_store`, `google_play`, `stripe`, or `other` for any other payment source.
     *
     * @param string $store
     *
     * @return self
     */
    public function setStore(string $store): self
    {
        $this->initialized['store'] = true;
        $this->store = $store;
        return $this;
    }
    /**
     * The subscription's id.
     *
     * @return string
     */
    public function getSubscriptionId(): string
    {
        return $this->subscriptionId;
    }
    /**
     * The subscription's id.
     *
     * @param string $subscriptionId
     *
     * @return self
     */
    public function setSubscriptionId(string $subscriptionId): self
    {
        $this->initialized['subscriptionId'] = true;
        $this->subscriptionId = $subscriptionId;
        return $this;
    }
    /**
     * Whether the store renews the subscription at the end of the current period, into `renewsToProductSlug` when set.
     *
     * @return bool
     */
    public function getWillRenew(): bool
    {
        return $this->willRenew;
    }
    /**
     * Whether the store renews the subscription at the end of the current period, into `renewsToProductSlug` when set.
     *
     * @param bool $willRenew
     *
     * @return self
     */
    public function setWillRenew(bool $willRenew): self
    {
        $this->initialized['willRenew'] = true;
        $this->willRenew = $willRenew;
        return $this;
    }
}