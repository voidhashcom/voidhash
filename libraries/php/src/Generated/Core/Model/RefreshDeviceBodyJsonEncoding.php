<?php

namespace Voidhash\Generated\Core\Model;

class RefreshDeviceBodyJsonEncoding
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
     * The device-token id registration returned; it must belong to the calling person.
     *
     * @var string
     */
    protected $pushDeviceTokenId;
    /**
     * The device's new push credential, which replaces the registered one.
     *
     * @var string
     */
    protected $platformToken;
    /**
     * The device-token id registration returned; it must belong to the calling person.
     *
     * @return string
     */
    public function getPushDeviceTokenId(): string
    {
        return $this->pushDeviceTokenId;
    }
    /**
     * The device-token id registration returned; it must belong to the calling person.
     *
     * @param string $pushDeviceTokenId
     *
     * @return self
     */
    public function setPushDeviceTokenId(string $pushDeviceTokenId): self
    {
        $this->initialized['pushDeviceTokenId'] = true;
        $this->pushDeviceTokenId = $pushDeviceTokenId;
        return $this;
    }
    /**
     * The device's new push credential, which replaces the registered one.
     *
     * @return string
     */
    public function getPlatformToken(): string
    {
        return $this->platformToken;
    }
    /**
     * The device's new push credential, which replaces the registered one.
     *
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
}