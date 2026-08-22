<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallJsonEncoding
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
     * @var SdkResolvedPaywallJsonEncodingLocation
     */
    protected $location;
    /**
     * @var SdkResolvedPaywallShowingJsonEncoding
     */
    protected $showing;
    /**
     * @return SdkResolvedPaywallJsonEncodingLocation
     */
    public function getLocation(): SdkResolvedPaywallJsonEncodingLocation
    {
        return $this->location;
    }
    /**
     * @param SdkResolvedPaywallJsonEncodingLocation $location
     *
     * @return self
     */
    public function setLocation(SdkResolvedPaywallJsonEncodingLocation $location): self
    {
        $this->initialized['location'] = true;
        $this->location = $location;
        return $this;
    }
    /**
     * @return SdkResolvedPaywallShowingJsonEncoding
     */
    public function getShowing(): SdkResolvedPaywallShowingJsonEncoding
    {
        return $this->showing;
    }
    /**
     * @param SdkResolvedPaywallShowingJsonEncoding $showing
     *
     * @return self
     */
    public function setShowing(SdkResolvedPaywallShowingJsonEncoding $showing): self
    {
        $this->initialized['showing'] = true;
        $this->showing = $showing;
        return $this;
    }
}