<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1PaymentProviderProductsPostResponse201
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
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var bool
     */
    protected $isActive;
    /**
     * @var string
     */
    protected $paymentProviderConfigurationId;
    /**
     * @var string
     */
    protected $productId;
    /**
     * @var string
     */
    protected $providerProductKey;
    /**
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * @param array<string, mixed> $configuration
     *
     * @return self
     */
    public function setConfiguration(iterable $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
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
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return bool
     */
    public function getIsActive(): bool
    {
        return $this->isActive;
    }
    /**
     * @param bool $isActive
     *
     * @return self
     */
    public function setIsActive(bool $isActive): self
    {
        $this->initialized['isActive'] = true;
        $this->isActive = $isActive;
        return $this;
    }
    /**
     * @return string
     */
    public function getPaymentProviderConfigurationId(): string
    {
        return $this->paymentProviderConfigurationId;
    }
    /**
     * @param string $paymentProviderConfigurationId
     *
     * @return self
     */
    public function setPaymentProviderConfigurationId(string $paymentProviderConfigurationId): self
    {
        $this->initialized['paymentProviderConfigurationId'] = true;
        $this->paymentProviderConfigurationId = $paymentProviderConfigurationId;
        return $this;
    }
    /**
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
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
     * @return string
     */
    public function getProviderProductKey(): string
    {
        return $this->providerProductKey;
    }
    /**
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
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}