<?php

namespace Voidhash\Generated\Core\Model;

class PaymentSourceTransaction
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
     * The source's id for the transaction, the `externalId` it was recorded under.
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
     * `charge` for a payment, `refund` for money returned on a charge.
     *
     * @var string
     */
    protected $type;
    /**
     * `applied` once recorded on a purchase; `pending` while it waits (see `pendingReason`).
     *
     * @var string
     */
    protected $status;
    /**
     * Why a pending transaction waits: `product_not_mapped` until its `productKey` is mapped to a product, `charge_not_recorded` until the refunded charge is recorded; null once applied.
     *
     * @var string|null
     */
    protected $pendingReason;
    /**
     * The one-time purchase the transaction belongs to, `pur_...`; null until it is applied, and for a subscription's charges.
     *
     * @var string|null
     */
    protected $purchaseId;
    /**
     * What the transaction booked, in minor units; null until it is applied. A refund books less than its `amount` when other refunds recorded at the same time left less of the charge.
     *
     * @var int|null
     */
    protected $bookedAmount;
    /**
     * The source's id for the transaction, the `externalId` it was recorded under.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The source's id for the transaction, the `externalId` it was recorded under.
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
     * `charge` for a payment, `refund` for money returned on a charge.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * `charge` for a payment, `refund` for money returned on a charge.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * `applied` once recorded on a purchase; `pending` while it waits (see `pendingReason`).
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * `applied` once recorded on a purchase; `pending` while it waits (see `pendingReason`).
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
     * Why a pending transaction waits: `product_not_mapped` until its `productKey` is mapped to a product, `charge_not_recorded` until the refunded charge is recorded; null once applied.
     *
     * @return string|null
     */
    public function getPendingReason(): ?string
    {
        return $this->pendingReason;
    }
    /**
     * Why a pending transaction waits: `product_not_mapped` until its `productKey` is mapped to a product, `charge_not_recorded` until the refunded charge is recorded; null once applied.
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
     * The one-time purchase the transaction belongs to, `pur_...`; null until it is applied, and for a subscription's charges.
     *
     * @return string|null
     */
    public function getPurchaseId(): ?string
    {
        return $this->purchaseId;
    }
    /**
     * The one-time purchase the transaction belongs to, `pur_...`; null until it is applied, and for a subscription's charges.
     *
     * @param string|null $purchaseId
     *
     * @return self
     */
    public function setPurchaseId(?string $purchaseId): self
    {
        $this->initialized['purchaseId'] = true;
        $this->purchaseId = $purchaseId;
        return $this;
    }
    /**
     * What the transaction booked, in minor units; null until it is applied. A refund books less than its `amount` when other refunds recorded at the same time left less of the charge.
     *
     * @return int|null
     */
    public function getBookedAmount(): ?int
    {
        return $this->bookedAmount;
    }
    /**
     * What the transaction booked, in minor units; null until it is applied. A refund books less than its `amount` when other refunds recorded at the same time left less of the charge.
     *
     * @param int|null $bookedAmount
     *
     * @return self
     */
    public function setBookedAmount(?int $bookedAmount): self
    {
        $this->initialized['bookedAmount'] = true;
        $this->bookedAmount = $bookedAmount;
        return $this;
    }
}