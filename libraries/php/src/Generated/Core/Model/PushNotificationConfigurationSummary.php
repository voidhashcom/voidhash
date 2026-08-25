<?php

namespace Voidhash\Generated\Core\Model;

class PushNotificationConfigurationSummary
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
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $deletedAt;
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
    protected $projectId;
    /**
     * @var string
     */
    protected $providerId;
    /**
     * @var string
     */
    protected $pushProviderKey;
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
     * @return string|null
     */
    public function getDeletedAt(): ?string
    {
        return $this->deletedAt;
    }
    /**
     * @param string|null $deletedAt
     *
     * @return self
     */
    public function setDeletedAt(?string $deletedAt): self
    {
        $this->initialized['deletedAt'] = true;
        $this->deletedAt = $deletedAt;
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
     * @return string
     */
    public function getPushProviderKey(): string
    {
        return $this->pushProviderKey;
    }
    /**
     * @param string $pushProviderKey
     *
     * @return self
     */
    public function setPushProviderKey(string $pushProviderKey): self
    {
        $this->initialized['pushProviderKey'] = true;
        $this->pushProviderKey = $pushProviderKey;
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