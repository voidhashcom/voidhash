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
     * @var string
     */
    protected $pushDeviceTokenId;
    /**
     * @var string
     */
    protected $platformToken;
    /**
     * @return string
     */
    public function getPushDeviceTokenId(): string
    {
        return $this->pushDeviceTokenId;
    }
    /**
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
}