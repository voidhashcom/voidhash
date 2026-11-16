<?php

namespace Voidhash\Generated\Core\Model;

class ProjectSettingsJsonEncoding
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
     * How a purchase reported by another account is handled, for `production` and for store `sandbox` purchases. A change applies to purchases reported from then on.
     *
     * @var ProjectSettingsJsonEncodingPaidAccessSharing
     */
    protected $paidAccessSharing;
    /**
     * Purchases made in a store's sandbox, such as TestFlight, Google Play test tracks and App Review.
     *
     * @var ProjectSettingsJsonEncodingStoreSandbox
     */
    protected $storeSandbox;
    /**
     * How the project's ad spend is measured.
     *
     * @var ProjectSettingsJsonEncodingAds
     */
    protected $ads;
    /**
     * How a purchase reported by another account is handled, for `production` and for store `sandbox` purchases. A change applies to purchases reported from then on.
     *
     * @return ProjectSettingsJsonEncodingPaidAccessSharing
     */
    public function getPaidAccessSharing(): ProjectSettingsJsonEncodingPaidAccessSharing
    {
        return $this->paidAccessSharing;
    }
    /**
     * How a purchase reported by another account is handled, for `production` and for store `sandbox` purchases. A change applies to purchases reported from then on.
     *
     * @param ProjectSettingsJsonEncodingPaidAccessSharing $paidAccessSharing
     *
     * @return self
     */
    public function setPaidAccessSharing(ProjectSettingsJsonEncodingPaidAccessSharing $paidAccessSharing): self
    {
        $this->initialized['paidAccessSharing'] = true;
        $this->paidAccessSharing = $paidAccessSharing;
        return $this;
    }
    /**
     * Purchases made in a store's sandbox, such as TestFlight, Google Play test tracks and App Review.
     *
     * @return ProjectSettingsJsonEncodingStoreSandbox
     */
    public function getStoreSandbox(): ProjectSettingsJsonEncodingStoreSandbox
    {
        return $this->storeSandbox;
    }
    /**
     * Purchases made in a store's sandbox, such as TestFlight, Google Play test tracks and App Review.
     *
     * @param ProjectSettingsJsonEncodingStoreSandbox $storeSandbox
     *
     * @return self
     */
    public function setStoreSandbox(ProjectSettingsJsonEncodingStoreSandbox $storeSandbox): self
    {
        $this->initialized['storeSandbox'] = true;
        $this->storeSandbox = $storeSandbox;
        return $this;
    }
    /**
     * How the project's ad spend is measured.
     *
     * @return ProjectSettingsJsonEncodingAds
     */
    public function getAds(): ProjectSettingsJsonEncodingAds
    {
        return $this->ads;
    }
    /**
     * How the project's ad spend is measured.
     *
     * @param ProjectSettingsJsonEncodingAds $ads
     *
     * @return self
     */
    public function setAds(ProjectSettingsJsonEncodingAds $ads): self
    {
        $this->initialized['ads'] = true;
        $this->ads = $ads;
        return $this;
    }
}