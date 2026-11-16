<?php

namespace Voidhash\Generated\Core\Model;

class SdkPurchaseHistoryEntryJsonEncoding
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
     * When the purchase was recorded, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * The id of the product bought; null when its store product is not linked to one.
     *
     * @var string|null
     */
    protected $productId;
    /**
     * The slug of the product bought; null when its store product is not linked to one.
     *
     * @var string|null
     */
    protected $productSlug;
    /**
     * The store's id for the transaction, such as an App Store transaction id.
     *
     * @var string
     */
    protected $providerKey;
    /**
     * The purchase's id.
     *
     * @var string
     */
    protected $purchaseId;
    /**
     * When the purchase was refunded, as an ISO 8601 timestamp; null when it was not.
     *
     * @var string|null
     */
    protected $refundedAt;
    /**
     * When the store withdrew the purchase without a refund, as for Family Sharing, as an ISO 8601 timestamp; null when it did not.
     *
     * @var string|null
     */
    protected $revokedAt;
    /**
     * The id of the person who owns it: the calling person, a person merged into them, or one who shares it with them.
     *
     * @var string
     */
    protected $sourcePersonId;
    /**
     * `one_time` for a one-time product, `consumable` for a consumable one, `subscription` for a subscription's purchase.
     *
     * @var string
     */
    protected $type;
    /**
     * When the purchase was recorded, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the purchase was recorded, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * The id of the product bought; null when its store product is not linked to one.
     *
     * @return string|null
     */
    public function getProductId(): ?string
    {
        return $this->productId;
    }
    /**
     * The id of the product bought; null when its store product is not linked to one.
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
     * The slug of the product bought; null when its store product is not linked to one.
     *
     * @return string|null
     */
    public function getProductSlug(): ?string
    {
        return $this->productSlug;
    }
    /**
     * The slug of the product bought; null when its store product is not linked to one.
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
     * The store's id for the transaction, such as an App Store transaction id.
     *
     * @return string
     */
    public function getProviderKey(): string
    {
        return $this->providerKey;
    }
    /**
     * The store's id for the transaction, such as an App Store transaction id.
     *
     * @param string $providerKey
     *
     * @return self
     */
    public function setProviderKey(string $providerKey): self
    {
        $this->initialized['providerKey'] = true;
        $this->providerKey = $providerKey;
        return $this;
    }
    /**
     * The purchase's id.
     *
     * @return string
     */
    public function getPurchaseId(): string
    {
        return $this->purchaseId;
    }
    /**
     * The purchase's id.
     *
     * @param string $purchaseId
     *
     * @return self
     */
    public function setPurchaseId(string $purchaseId): self
    {
        $this->initialized['purchaseId'] = true;
        $this->purchaseId = $purchaseId;
        return $this;
    }
    /**
     * When the purchase was refunded, as an ISO 8601 timestamp; null when it was not.
     *
     * @return string|null
     */
    public function getRefundedAt(): ?string
    {
        return $this->refundedAt;
    }
    /**
     * When the purchase was refunded, as an ISO 8601 timestamp; null when it was not.
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
     * When the store withdrew the purchase without a refund, as for Family Sharing, as an ISO 8601 timestamp; null when it did not.
     *
     * @return string|null
     */
    public function getRevokedAt(): ?string
    {
        return $this->revokedAt;
    }
    /**
     * When the store withdrew the purchase without a refund, as for Family Sharing, as an ISO 8601 timestamp; null when it did not.
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
     * `one_time` for a one-time product, `consumable` for a consumable one, `subscription` for a subscription's purchase.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * `one_time` for a one-time product, `consumable` for a consumable one, `subscription` for a subscription's purchase.
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
}