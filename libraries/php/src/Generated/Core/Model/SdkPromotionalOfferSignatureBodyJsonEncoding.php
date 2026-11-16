<?php

namespace Voidhash\Generated\Core\Model;

class SdkPromotionalOfferSignatureBodyJsonEncoding
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
     * The App Store product identifier the offer belongs to.
     *
     * @var string
     */
    protected $productId;
    /**
     * The promotional offer's identifier, as the product's App Store mapping names it.
     *
     * @var string
     */
    protected $offerId;
    /**
     * The id of any App Store transaction of the customer, such as their `appTransactionID`, which binds `signatureJws` to them. Apple recommends it; without it the JWS names no customer. Leave it out rather than sending an empty string.
     *
     * @var string
     */
    protected $transactionId;
    /**
     * The App Store product identifier the offer belongs to.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The App Store product identifier the offer belongs to.
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
     * The promotional offer's identifier, as the product's App Store mapping names it.
     *
     * @return string
     */
    public function getOfferId(): string
    {
        return $this->offerId;
    }
    /**
     * The promotional offer's identifier, as the product's App Store mapping names it.
     *
     * @param string $offerId
     *
     * @return self
     */
    public function setOfferId(string $offerId): self
    {
        $this->initialized['offerId'] = true;
        $this->offerId = $offerId;
        return $this;
    }
    /**
     * The id of any App Store transaction of the customer, such as their `appTransactionID`, which binds `signatureJws` to them. Apple recommends it; without it the JWS names no customer. Leave it out rather than sending an empty string.
     *
     * @return string
     */
    public function getTransactionId(): string
    {
        return $this->transactionId;
    }
    /**
     * The id of any App Store transaction of the customer, such as their `appTransactionID`, which binds `signatureJws` to them. Apple recommends it; without it the JWS names no customer. Leave it out rather than sending an empty string.
     *
     * @param string $transactionId
     *
     * @return self
     */
    public function setTransactionId(string $transactionId): self
    {
        $this->initialized['transactionId'] = true;
        $this->transactionId = $transactionId;
        return $this;
    }
}