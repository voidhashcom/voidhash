<?php

namespace Voidhash\Generated\Core\Model;

class UpdateProjectSettingsBodyJsonEncoding
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
     * How a purchase reported by another account is handled, per store environment.
     *
     * @var UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing|null
     */
    protected $paidAccessSharing;
    /**
     * Purchases made in a store's sandbox.
     *
     * @var UpdateProjectSettingsBodyJsonEncodingStoreSandbox|null
     */
    protected $storeSandbox;
    /**
     * How the project's ad spend is measured.
     *
     * @var UpdateProjectSettingsBodyJsonEncodingAds|null
     */
    protected $ads;
    /**
     * How a purchase reported by another account is handled, per store environment.
     *
     * @return UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing|null
     */
    public function getPaidAccessSharing(): ?UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing
    {
        return $this->paidAccessSharing;
    }
    /**
     * How a purchase reported by another account is handled, per store environment.
     *
     * @param UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing|null $paidAccessSharing
     *
     * @return self
     */
    public function setPaidAccessSharing(?UpdateProjectSettingsBodyJsonEncodingPaidAccessSharing $paidAccessSharing): self
    {
        $this->initialized['paidAccessSharing'] = true;
        $this->paidAccessSharing = $paidAccessSharing;
        return $this;
    }
    /**
     * Purchases made in a store's sandbox.
     *
     * @return UpdateProjectSettingsBodyJsonEncodingStoreSandbox|null
     */
    public function getStoreSandbox(): ?UpdateProjectSettingsBodyJsonEncodingStoreSandbox
    {
        return $this->storeSandbox;
    }
    /**
     * Purchases made in a store's sandbox.
     *
     * @param UpdateProjectSettingsBodyJsonEncodingStoreSandbox|null $storeSandbox
     *
     * @return self
     */
    public function setStoreSandbox(?UpdateProjectSettingsBodyJsonEncodingStoreSandbox $storeSandbox): self
    {
        $this->initialized['storeSandbox'] = true;
        $this->storeSandbox = $storeSandbox;
        return $this;
    }
    /**
     * How the project's ad spend is measured.
     *
     * @return UpdateProjectSettingsBodyJsonEncodingAds|null
     */
    public function getAds(): ?UpdateProjectSettingsBodyJsonEncodingAds
    {
        return $this->ads;
    }
    /**
     * How the project's ad spend is measured.
     *
     * @param UpdateProjectSettingsBodyJsonEncodingAds|null $ads
     *
     * @return self
     */
    public function setAds(?UpdateProjectSettingsBodyJsonEncodingAds $ads): self
    {
        $this->initialized['ads'] = true;
        $this->ads = $ads;
        return $this;
    }
}