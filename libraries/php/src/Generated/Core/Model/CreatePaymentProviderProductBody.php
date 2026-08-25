<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaymentProviderProductBody
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
     * @var string
     */
    protected $paymentProviderConfigurationId;
    /**
     * @var string
     */
    protected $productId;
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
}