<?php

namespace Voidhash\Generated\Core\Model;

class SchemaProductProviderJsonEncoding
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
    protected $providerId;
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
}