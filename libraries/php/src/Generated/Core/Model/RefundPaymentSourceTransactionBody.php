<?php

namespace Voidhash\Generated\Core\Model;

class RefundPaymentSourceTransactionBody
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
     * The amount to refund, in the charge's minor units; everything left of the charge when left out.
     *
     * @var int|null
     */
    protected $amount;
    /**
     * Why the charge is refunded, passed to the source's endpoint.
     *
     * @var string|null
     */
    protected $reason;
    /**
     * The amount to refund, in the charge's minor units; everything left of the charge when left out.
     *
     * @return int|null
     */
    public function getAmount(): ?int
    {
        return $this->amount;
    }
    /**
     * The amount to refund, in the charge's minor units; everything left of the charge when left out.
     *
     * @param int|null $amount
     *
     * @return self
     */
    public function setAmount(?int $amount): self
    {
        $this->initialized['amount'] = true;
        $this->amount = $amount;
        return $this;
    }
    /**
     * Why the charge is refunded, passed to the source's endpoint.
     *
     * @return string|null
     */
    public function getReason(): ?string
    {
        return $this->reason;
    }
    /**
     * Why the charge is refunded, passed to the source's endpoint.
     *
     * @param string|null $reason
     *
     * @return self
     */
    public function setReason(?string $reason): self
    {
        $this->initialized['reason'] = true;
        $this->reason = $reason;
        return $this;
    }
}