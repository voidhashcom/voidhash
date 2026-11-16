<?php

namespace Voidhash\Generated\Core\Model;

class SandboxPurchaseJsonEncoding
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
     * The purchase's id, `pur_...`; the `targetId` of a sandbox action on it.
     *
     * @var string
     */
    protected $id;
    /**
     * The product bought.
     *
     * @var string
     */
    protected $productId;
    /**
     * When the purchase was made, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the purchase was refunded, as an ISO 8601 timestamp; null when it was not.
     *
     * @var string|null
     */
    protected $refundedAt;
    /**
     * When the purchase was revoked, as an ISO 8601 timestamp; null when it was not.
     *
     * @var string|null
     */
    protected $revokedAt;
    /**
     * The purchase's id, `pur_...`; the `targetId` of a sandbox action on it.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The purchase's id, `pur_...`; the `targetId` of a sandbox action on it.
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
     * The product bought.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The product bought.
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
     * When the purchase was made, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the purchase was made, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
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
     * When the purchase was revoked, as an ISO 8601 timestamp; null when it was not.
     *
     * @return string|null
     */
    public function getRevokedAt(): ?string
    {
        return $this->revokedAt;
    }
    /**
     * When the purchase was revoked, as an ISO 8601 timestamp; null when it was not.
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
}