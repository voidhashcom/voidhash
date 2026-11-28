<?php

namespace Voidhash\Generated\Core\Model;

class PaymentProviderJsonEncoding
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
     * The payment provider's id, `pp_conf_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the provider belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * Where the project takes payments: `app_store`, `google_play` or `stripe`, or a `payment_source` that reports its own purchases through the API, such as bank transfers or vouchers.
     *
     * @var string
     */
    protected $type;
    /**
     * The provider's display name: the store's name, or a payment source's own.
     *
     * @var string
     */
    protected $name;
    /**
     * The app or account the provider is set up for: the App Store bundle id, the Google Play package name, the Stripe account id, or the payment source's slug; null until a store is first enabled.
     *
     * @var string|null
     */
    protected $key;
    /**
     * Whether the provider's purchases are processed; a store is enabled once its credentials validate.
     *
     * @var bool
     */
    protected $isEnabled;
    /**
     * The provider's settings, which depend on its `type`; each stored credential reads as `"<stored secret>"`.
     *
     * @var array<string, mixed>
     */
    protected $configuration;
    /**
     * When the provider was added, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the provider last changed, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * The last check of a store's credentials with the store.
     *
     * @var PaymentProviderConnectionCheck
     */
    protected $connectionCheck;
    /**
     * The payment provider's id, `pp_conf_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The payment provider's id, `pp_conf_...`.
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
     * The project the provider belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the provider belongs to.
     *
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
     * Where the project takes payments: `app_store`, `google_play` or `stripe`, or a `payment_source` that reports its own purchases through the API, such as bank transfers or vouchers.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Where the project takes payments: `app_store`, `google_play` or `stripe`, or a `payment_source` that reports its own purchases through the API, such as bank transfers or vouchers.
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
    /**
     * The provider's display name: the store's name, or a payment source's own.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The provider's display name: the store's name, or a payment source's own.
     *
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
     * The app or account the provider is set up for: the App Store bundle id, the Google Play package name, the Stripe account id, or the payment source's slug; null until a store is first enabled.
     *
     * @return string|null
     */
    public function getKey(): ?string
    {
        return $this->key;
    }
    /**
     * The app or account the provider is set up for: the App Store bundle id, the Google Play package name, the Stripe account id, or the payment source's slug; null until a store is first enabled.
     *
     * @param string|null $key
     *
     * @return self
     */
    public function setKey(?string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * Whether the provider's purchases are processed; a store is enabled once its credentials validate.
     *
     * @return bool
     */
    public function getIsEnabled(): bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the provider's purchases are processed; a store is enabled once its credentials validate.
     *
     * @param bool $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * The provider's settings, which depend on its `type`; each stored credential reads as `"<stored secret>"`.
     *
     * @return array<string, mixed>
     */
    public function getConfiguration(): iterable
    {
        return $this->configuration;
    }
    /**
     * The provider's settings, which depend on its `type`; each stored credential reads as `"<stored secret>"`.
     *
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
     * When the provider was added, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the provider was added, as an ISO 8601 timestamp.
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
     * When the provider last changed, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the provider last changed, as an ISO 8601 timestamp.
     *
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
    /**
     * The last check of a store's credentials with the store.
     *
     * @return PaymentProviderConnectionCheck
     */
    public function getConnectionCheck(): PaymentProviderConnectionCheck
    {
        return $this->connectionCheck;
    }
    /**
     * The last check of a store's credentials with the store.
     *
     * @param PaymentProviderConnectionCheck $connectionCheck
     *
     * @return self
     */
    public function setConnectionCheck(PaymentProviderConnectionCheck $connectionCheck): self
    {
        $this->initialized['connectionCheck'] = true;
        $this->connectionCheck = $connectionCheck;
        return $this;
    }
}