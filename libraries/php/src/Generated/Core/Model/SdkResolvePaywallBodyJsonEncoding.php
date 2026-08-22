<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvePaywallBodyJsonEncoding
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
    protected $locationSlug;
    /**
     * @return string
     */
    public function getLocationSlug(): string
    {
        return $this->locationSlug;
    }
    /**
     * @param string $locationSlug
     *
     * @return self
     */
    public function setLocationSlug(string $locationSlug): self
    {
        $this->initialized['locationSlug'] = true;
        $this->locationSlug = $locationSlug;
        return $this;
    }
}