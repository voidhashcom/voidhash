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
     * The SHA-256 hashes, as hex, of flow packages withdrawn as bad that the app may hold for this location: never show one of them, not even as the package last shown here when the served one cannot be downloaded. At most 20, the most recently withdrawn of the flows read here; never the served package's hash. Left out when none is, as most answers are, and by servers that predate withdrawals.
     *
     * @var list<string>|null
     */
    protected $withdrawnPackages;
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
    /**
     * The SHA-256 hashes, as hex, of flow packages withdrawn as bad that the app may hold for this location: never show one of them, not even as the package last shown here when the served one cannot be downloaded. At most 20, the most recently withdrawn of the flows read here; never the served package's hash. Left out when none is, as most answers are, and by servers that predate withdrawals.
     *
     * @return list<string>|null
     */
    public function getWithdrawnPackages(): ?array
    {
        return $this->withdrawnPackages;
    }
    /**
     * The SHA-256 hashes, as hex, of flow packages withdrawn as bad that the app may hold for this location: never show one of them, not even as the package last shown here when the served one cannot be downloaded. At most 20, the most recently withdrawn of the flows read here; never the served package's hash. Left out when none is, as most answers are, and by servers that predate withdrawals.
     *
     * @param list<string>|null $withdrawnPackages
     *
     * @return self
     */
    public function setWithdrawnPackages(?array $withdrawnPackages): self
    {
        $this->initialized['withdrawnPackages'] = true;
        $this->withdrawnPackages = $withdrawnPackages;
        return $this;
    }
}