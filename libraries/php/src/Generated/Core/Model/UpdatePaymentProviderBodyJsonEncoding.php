<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePaymentProviderBodyJsonEncoding
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
     * The new display name.
     *
     * @var string|null
     */
    protected $name;
    /**
     * Whether the provider's purchases are processed. Enabling validates the settings and credentials with the store.
     *
     * @var bool|null
     */
    protected $isEnabled;
    /**
     * Replaces the stored settings. A credential sent as `"<stored secret>"` keeps the stored one.
     *
     * @var array<string, mixed>|null
     */
    protected $configuration;
    /**
     * The new display name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new display name.
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * Whether the provider's purchases are processed. Enabling validates the settings and credentials with the store.
     *
     * @return bool|null
     */
    public function getIsEnabled(): ?bool
    {
        return $this->isEnabled;
    }
    /**
     * Whether the provider's purchases are processed. Enabling validates the settings and credentials with the store.
     *
     * @param bool|null $isEnabled
     *
     * @return self
     */
    public function setIsEnabled(?bool $isEnabled): self
    {
        $this->initialized['isEnabled'] = true;
        $this->isEnabled = $isEnabled;
        return $this;
    }
    /**
     * Replaces the stored settings. A credential sent as `"<stored secret>"` keeps the stored one.
     *
     * @return array<string, mixed>|null
     */
    public function getConfiguration(): ?iterable
    {
        return $this->configuration;
    }
    /**
     * Replaces the stored settings. A credential sent as `"<stored secret>"` keeps the stored one.
     *
     * @param array<string, mixed>|null $configuration
     *
     * @return self
     */
    public function setConfiguration(?iterable $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
}