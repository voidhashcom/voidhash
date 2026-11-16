<?php

namespace Voidhash\Generated\Core\Model;

class RegisterDeviceResponseJsonEncoding
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
     * The device's id, `push_tok_…`. Registering the same credential again returns the same id.
     *
     * @var string
     */
    protected $pushDeviceTokenId;
    /**
     * The device's id, `push_tok_…`. Registering the same credential again returns the same id.
     *
     * @return string
     */
    public function getPushDeviceTokenId(): string
    {
        return $this->pushDeviceTokenId;
    }
    /**
     * The device's id, `push_tok_…`. Registering the same credential again returns the same id.
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