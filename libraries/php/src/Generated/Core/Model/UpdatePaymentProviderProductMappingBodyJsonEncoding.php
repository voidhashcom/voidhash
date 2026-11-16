<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePaymentProviderProductMappingBodyJsonEncoding
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
     * Replaces the mapping's settings, such as its offers. The store product of a mapping with purchases cannot change.
     *
     * @var array<string, mixed>|null
     */
    protected $configuration;
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
     *
     * @var string
     */
    protected $environment;
    /**
     * Replaces the mapping's settings, such as its offers. The store product of a mapping with purchases cannot change.
     *
     * @return array<string, mixed>|null
     */
    public function getConfiguration(): ?iterable
    {
        return $this->configuration;
    }
    /**
     * Replaces the mapping's settings, such as its offers. The store product of a mapping with purchases cannot change.
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
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
     *
     * @return string
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    /**
     * Which purchases a store product key names: `production`, `test`, or `all` when every environment uses the same key. App Store and Google Play mappings are always `all`; a Stripe price's is read from Stripe.
     *
     * @param string $environment
     *
     * @return self
     */
    public function setEnvironment(string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
}