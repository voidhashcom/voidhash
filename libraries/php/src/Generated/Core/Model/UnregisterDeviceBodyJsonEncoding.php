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
     * The device-token id registration returned; it must belong to the calling person.
     *
     * @var string
     */
    protected $pushDeviceTokenId;
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
}