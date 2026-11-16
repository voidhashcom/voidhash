<?php

namespace Voidhash\Generated\Core\Model;

class SandboxSubscriptionJsonEncoding
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
     * The subscription's id, `sub_...`; the `targetId` of a sandbox action on it.
     *
     * @var string
     */
    protected $id;
    /**
     * The subscription product.
     *
     * @var string
     */
    protected $productId;
    /**
     * `active` until the subscription ends; `canceled` once it expired or was revoked.
     *
     * @var string
     */
    protected $status;
    /**
     * When the subscription started, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $startsAt;
    /**
     * When the paid period ends, as an ISO 8601 timestamp; `renew` extends it by one billing period.
     *
     * @var string|null
     */
    protected $expiresAt;
    /**
     * When the subscription was canceled, as an ISO 8601 timestamp; null when it was not.
     *
     * @var string|null
     */
    protected $canceledAt;
    /**
     * When a grace period after a failed renewal ends, as an ISO 8601 timestamp; null outside one. Access lasts until then.
     *
     * @var string|null
     */
    protected $gracePeriodExpiresAt;
    /**
     * The subscription's id, `sub_...`; the `targetId` of a sandbox action on it.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The subscription's id, `sub_...`; the `targetId` of a sandbox action on it.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The subscription product.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The subscription product.
     *
     * @param string $productId
     *
     * @return self
     */
    public function setProductId(string $productId): self
    {
        $this->initialized['productId'] = true;
        $this->productId = $productId;
        return $this;
    }
    /**
     * `active` until the subscription ends; `canceled` once it expired or was revoked.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `active` until the subscription ends; `canceled` once it expired or was revoked.
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
     * When the subscription started, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartsAt(): string
    {
        return $this->startsAt;
    }
    /**
     * When the subscription started, as an ISO 8601 timestamp.
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
     * When the paid period ends, as an ISO 8601 timestamp; `renew` extends it by one billing period.
     *
     * @return string|null
     */
    public function getExpiresAt(): ?string
    {
        return $this->expiresAt;
    }
    /**
     * When the paid period ends, as an ISO 8601 timestamp; `renew` extends it by one billing period.
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
     * When a grace period after a failed renewal ends, as an ISO 8601 timestamp; null outside one. Access lasts until then.
     *
     * @return string|null
     */
    public function getGracePeriodExpiresAt(): ?string
    {
        return $this->gracePeriodExpiresAt;
    }
    /**
     * When a grace period after a failed renewal ends, as an ISO 8601 timestamp; null outside one. Access lasts until then.
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
}