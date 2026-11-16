<?php

namespace Voidhash\Generated\Core\Model;

class SdkSubscriptionHistoryEntryJsonEncoding
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
     * When the subscription was canceled, as an ISO 8601 timestamp; null when it was not.
     *
     * @var string|null
     */
    protected $canceledAt;
    /**
     * When the subscription's period ends or ended, as an ISO 8601 timestamp; null when the store reported none.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * Whether the subscription is in a free trial period.
     *
     * @var bool
     */
    protected $isTrial;
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
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
     *
     * @var string
     */
    protected $sourcePersonId;
    /**
     * When the subscription's current period started, as an ISO 8601 timestamp.
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
     * When the subscription was canceled, as an ISO 8601 timestamp; null when it was not.
     *
     * @return string|null
     */
    public function getCanceledAt(): ?string
    {
        return $this->canceledAt;
    }
    /**
     * When the subscription was canceled, as an ISO 8601 timestamp; null when it was not.
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
     * When the subscription's period ends or ended, as an ISO 8601 timestamp; null when the store reported none.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the subscription's period ends or ended, as an ISO 8601 timestamp; null when the store reported none.
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
     * Whether the subscription is in a free trial period.
     *
     * @return bool
     */
    public function getIsTrial(): bool
    {
        return $this->isTrial;
    }
    /**
     * Whether the subscription is in a free trial period.
     *
     * @param bool $isTrial
     *
     * @return self
     */
    public function setIsTrial(bool $isTrial): self
    {
        $this->initialized['isTrial'] = true;
        $this->isTrial = $isTrial;
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
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
     *
     * @return string
     */
    public function getSourcePersonId(): string
    {
        return $this->sourcePersonId;
    }
    /**
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
     *
     * @param string $sourcePersonId
     *
     * @return self
     */
    public function setSourcePersonId(string $sourcePersonId): self
    {
        $this->initialized['sourcePersonId'] = true;
        $this->sourcePersonId = $sourcePersonId;
        return $this;
    }
    /**
     * When the subscription's current period started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartsAt(): string
    {
        return $this->startsAt;
    }
    /**
     * When the subscription's current period started, as an ISO 8601 timestamp.
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
}