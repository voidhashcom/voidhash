<?php

namespace Voidhash\Generated\Core\Model;

class MovePaymentProviderProductMappingBodyJsonEncoding
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
     * The product to move the store product to: another product of the project, of the same type and, for a subscription, renewing over the same period.
     *
     * @var string
     */
    protected $productId;
    /**
     * The product to move the store product to: another product of the project, of the same type and, for a subscription, renewing over the same period.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The product to move the store product to: another product of the project, of the same type and, for a subscription, renewing over the same period.
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
}