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
     * @var mixed
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
     * @return mixed
     */
    public function getPlatformToken()
    {
        return $this->platformToken;
    }
    /**
     * @param mixed $platformToken
     *
     * @return self
     */
    public function setPlatformToken($platformToken): self
    {
        $this->initialized['platformToken'] = true;
        $this->platformToken = $platformToken;
        return $this;
    }
}