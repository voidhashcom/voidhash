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
     * The location the paywall is shown at.
     *
     * @var SdkResolvedPaywallJsonEncodingLocation
     */
    protected $location;
    /**
     * What the location shows the person now.
     *
     * @var SdkResolvedPaywallShowingJsonEncoding
     */
    protected $showing;
    /**
     * The location the paywall is shown at.
     *
     * @return SdkResolvedPaywallJsonEncodingLocation
     */
    public function getLocation(): SdkResolvedPaywallJsonEncodingLocation
    {
        return $this->location;
    }
    /**
     * The location the paywall is shown at.
     *
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
     * What the location shows the person now.
     *
     * @return SdkResolvedPaywallShowingJsonEncoding
     */
    public function getShowing(): SdkResolvedPaywallShowingJsonEncoding
    {
        return $this->showing;
    }
    /**
     * What the location shows the person now.
     *
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