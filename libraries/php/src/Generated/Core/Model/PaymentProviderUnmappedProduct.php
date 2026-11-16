<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderUnmappedProduct
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
     * The store's id for the product.
     *
     * @var string
     */
    protected $providerProductKey;
    /**
     * Imported purchase events that apply once the store product is mapped.
     *
     * @var int
     */
    protected $eventCount;
    /**
     * The store's id for the product.
     *
     * @return string
     */
    public function getProviderProductKey(): string
    {
        return $this->providerProductKey;
    }
    /**
     * The store's id for the product.
     *
     * @param string $providerProductKey
     *
     * @return self
     */
    public function setProviderProductKey(string $providerProductKey): self
    {
        $this->initialized['providerProductKey'] = true;
        $this->providerProductKey = $providerProductKey;
        return $this;
    }
    /**
     * Imported purchase events that apply once the store product is mapped.
     *
     * @return int
     */
    public function getEventCount(): int
    {
        return $this->eventCount;
    }
    /**
     * Imported purchase events that apply once the store product is mapped.
     *
     * @param int $eventCount
     *
     * @return self
     */
    public function setEventCount(int $eventCount): self
    {
        $this->initialized['eventCount'] = true;
        $this->eventCount = $eventCount;
        return $this;
    }
}