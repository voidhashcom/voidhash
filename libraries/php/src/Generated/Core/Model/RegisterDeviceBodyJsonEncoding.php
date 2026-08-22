<?php

namespace Voidhash\Generated\Core\Model;

class RegisterDeviceBodyJsonEncoding
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
     * @var string
     */
    protected $platform;
    /**
     * @var string
     */
    protected $provider;
    /**
     * @var string
     */
    protected $platformToken;
    /**
     * @var string|null
     */
    protected $bundleId;
    /**
     * @var string|null
     */
    protected $environment;
    /**
     * @var string|null
     */
    protected $previousPushDeviceTokenId;
    /**
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * @return string
     */
    public function getProvider(): string
    {
        return $this->provider;
    }
    /**
     * @param string $provider
     *
     * @return self
     */
    public function setProvider(string $provider): self
    {
        $this->initialized['provider'] = true;
        $this->provider = $provider;
        return $this;
    }
    /**
     * @return string
     */
    public function getPlatformToken(): string
    {
        return $this->platformToken;
    }
    /**
     * @param string $platformToken
     *
     * @return self
     */
    public function setPlatformToken(string $platformToken): self
    {
        $this->initialized['platformToken'] = true;
        $this->platformToken = $platformToken;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getBundleId(): ?string
    {
        return $this->bundleId;
    }
    /**
     * @param string|null $bundleId
     *
     * @return self
     */
    public function setBundleId(?string $bundleId): self
    {
        $this->initialized['bundleId'] = true;
        $this->bundleId = $bundleId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getEnvironment(): ?string
    {
        return $this->environment;
    }
    /**
     * @param string|null $environment
     *
     * @return self
     */
    public function setEnvironment(?string $environment): self
    {
        $this->initialized['environment'] = true;
        $this->environment = $environment;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPreviousPushDeviceTokenId(): ?string
    {
        return $this->previousPushDeviceTokenId;
    }
    /**
     * @param string|null $previousPushDeviceTokenId
     *
     * @return self
     */
    public function setPreviousPushDeviceTokenId(?string $previousPushDeviceTokenId): self
    {
        $this->initialized['previousPushDeviceTokenId'] = true;
        $this->previousPushDeviceTokenId = $previousPushDeviceTokenId;
        return $this;
    }
}