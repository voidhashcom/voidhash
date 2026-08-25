<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1PaymentProviderConfigurationsPostResponse201
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
     * @var string|null
     */
    protected $activeProviderId;
    /**
     * @var array<string, bool>
     */
    protected $configurationPresence;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var bool
     */
    protected $enabled;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var string
     */
    protected $paymentProviderKey;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var string
     */
    protected $providerId;
    /**
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @return string|null
     */
    public function getActiveProviderId(): ?string
    {
        return $this->activeProviderId;
    }
    /**
     * @param string|null $activeProviderId
     *
     * @return self
     */
    public function setActiveProviderId(?string $activeProviderId): self
    {
        $this->initialized['activeProviderId'] = true;
        $this->activeProviderId = $activeProviderId;
        return $this;
    }
    /**
     * @return array<string, bool>
     */
    public function getConfigurationPresence(): iterable
    {
        return $this->configurationPresence;
    }
    /**
     * @param array<string, bool> $configurationPresence
     *
     * @return self
     */
    public function setConfigurationPresence(iterable $configurationPresence): self
    {
        $this->initialized['configurationPresence'] = true;
        $this->configurationPresence = $configurationPresence;
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
     * @return bool
     */
    public function getEnabled(): bool
    {
        return $this->enabled;
    }
    /**
     * @param bool $enabled
     *
     * @return self
     */
    public function setEnabled(bool $enabled): self
    {
        $this->initialized['enabled'] = true;
        $this->enabled = $enabled;
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
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * @return string
     */
    public function getPaymentProviderKey(): string
    {
        return $this->paymentProviderKey;
    }
    /**
     * @param string $paymentProviderKey
     *
     * @return self
     */
    public function setPaymentProviderKey(string $paymentProviderKey): self
    {
        $this->initialized['paymentProviderKey'] = true;
        $this->paymentProviderKey = $paymentProviderKey;
        return $this;
    }
    /**
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * @return string
     */
    public function getProviderId(): string
    {
        return $this->providerId;
    }
    /**
     * @param string $providerId
     *
     * @return self
     */
    public function setProviderId(string $providerId): self
    {
        $this->initialized['providerId'] = true;
        $this->providerId = $providerId;
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