<?php

namespace Voidhash\Generated\Core\Model;

class UnregisterDeviceBodyJsonEncoding
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
}