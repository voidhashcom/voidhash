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
     * The slug of the location to show a paywall at.
     *
     * @var string
     */
    protected $locationSlug;
    /**
     * The slug of the location to show a paywall at.
     *
     * @return string
     */
    public function getLocationSlug(): string
    {
        return $this->locationSlug;
    }
    /**
     * The slug of the location to show a paywall at.
     *
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