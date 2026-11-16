<?php

namespace Voidhash\Generated\Core\Model;

class PaymentSourceSubscription
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
     * The source's id for the subscription, the `externalId` it was recorded under.
     *
     * @var string
     */
    protected $id;
    /**
     * The payment source that reported it.
     *
     * @var string
     */
    protected $paymentProviderId;
    /**
     * `applied` once the state is recorded; `pending` while it waits (see `pendingReason`); `superseded` when a newer `updatedAt` was already recorded, so this state changed nothing.
     *
     * @var string
     */
    protected $status;
    /**
     * Why a pending state waits: `product_not_mapped` until its `productKey` is mapped to a product, `charge_not_recorded` until a charge opens the subscription's first paid period; null otherwise.
     *
     * @var string|null
     */
    protected $pendingReason;
    /**
     * The Voidhash subscription, `sub_...`; null until one exists.
     *
     * @var string|null
     */
    protected $subscriptionId;
    /**
     * The source's id for the subscription, the `externalId` it was recorded under.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The source's id for the subscription, the `externalId` it was recorded under.
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
     * The payment source that reported it.
     *
     * @return string
     */
    public function getPaymentProviderId(): string
    {
        return $this->paymentProviderId;
    }
    /**
     * The payment source that reported it.
     *
     * @param string $paymentProviderId
     *
     * @return self
     */
    public function setPaymentProviderId(string $paymentProviderId): self
    {
        $this->initialized['paymentProviderId'] = true;
        $this->paymentProviderId = $paymentProviderId;
        return $this;
    }
    /**
     * `applied` once the state is recorded; `pending` while it waits (see `pendingReason`); `superseded` when a newer `updatedAt` was already recorded, so this state changed nothing.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `applied` once the state is recorded; `pending` while it waits (see `pendingReason`); `superseded` when a newer `updatedAt` was already recorded, so this state changed nothing.
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
     * Why a pending state waits: `product_not_mapped` until its `productKey` is mapped to a product, `charge_not_recorded` until a charge opens the subscription's first paid period; null otherwise.
     *
     * @return string|null
     */
    public function getPendingReason(): ?string
    {
        return $this->pendingReason;
    }
    /**
     * Why a pending state waits: `product_not_mapped` until its `productKey` is mapped to a product, `charge_not_recorded` until a charge opens the subscription's first paid period; null otherwise.
     *
     * @param string|null $pendingReason
     *
     * @return self
     */
    public function setPendingReason(?string $pendingReason): self
    {
        $this->initialized['pendingReason'] = true;
        $this->pendingReason = $pendingReason;
        return $this;
    }
    /**
     * The Voidhash subscription, `sub_...`; null until one exists.
     *
     * @return string|null
     */
    public function getSubscriptionId(): ?string
    {
        return $this->subscriptionId;
    }
    /**
     * The Voidhash subscription, `sub_...`; null until one exists.
     *
     * @param string|null $subscriptionId
     *
     * @return self
     */
    public function setSubscriptionId(?string $subscriptionId): self
    {
        $this->initialized['subscriptionId'] = true;
        $this->subscriptionId = $subscriptionId;
        return $this;
    }
}