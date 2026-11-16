<?php

namespace Voidhash\Generated\Core\Model;

class PaymentSourceCustomer
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
     * The source's id for the customer, stable across its payments.
     *
     * @var string
     */
    protected $externalId;
    /**
     * The source's id for the customer, stable across its payments.
     *
     * @return string
     */
    public function getExternalId(): string
    {
        return $this->externalId;
    }
    /**
     * The source's id for the customer, stable across its payments.
     *
     * @param string $externalId
     *
     * @return self
     */
    public function setExternalId(string $externalId): self
    {
        $this->initialized['externalId'] = true;
        $this->externalId = $externalId;
        return $this;
    }
}