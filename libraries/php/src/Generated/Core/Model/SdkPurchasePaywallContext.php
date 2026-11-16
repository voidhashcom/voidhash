<?php

namespace Voidhash\Generated\Core\Model;

class SdkPurchasePaywallContext
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
     * The id of the showing `POST /sdk/resolve-paywall` returned, which credits the purchase to the paywall that sold it.
     *
     * @var string
     */
    protected $showingId;
    /**
     * The slug of the location the paywall was shown at; informational.
     *
     * @var string|null
     */
    protected $placement;
    /**
     * The id of the paywall shown; informational.
     *
     * @var string|null
     */
    protected $paywallId;
    /**
     * The id of the paywall release shown; informational.
     *
     * @var string|null
     */
    protected $paywallReleaseId;
    /**
     * The id of the showing `POST /sdk/resolve-paywall` returned, which credits the purchase to the paywall that sold it.
     *
     * @return string
     */
    public function getShowingId(): string
    {
        return $this->showingId;
    }
    /**
     * The id of the showing `POST /sdk/resolve-paywall` returned, which credits the purchase to the paywall that sold it.
     *
     * @param string $showingId
     *
     * @return self
     */
    public function setShowingId(string $showingId): self
    {
        $this->initialized['showingId'] = true;
        $this->showingId = $showingId;
        return $this;
    }
    /**
     * The slug of the location the paywall was shown at; informational.
     *
     * @return string|null
     */
    public function getPlacement(): ?string
    {
        return $this->placement;
    }
    /**
     * The slug of the location the paywall was shown at; informational.
     *
     * @param string|null $placement
     *
     * @return self
     */
    public function setPlacement(?string $placement): self
    {
        $this->initialized['placement'] = true;
        $this->placement = $placement;
        return $this;
    }
    /**
     * The id of the paywall shown; informational.
     *
     * @return string|null
     */
    public function getPaywallId(): ?string
    {
        return $this->paywallId;
    }
    /**
     * The id of the paywall shown; informational.
     *
     * @param string|null $paywallId
     *
     * @return self
     */
    public function setPaywallId(?string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
        return $this;
    }
    /**
     * The id of the paywall release shown; informational.
     *
     * @return string|null
     */
    public function getPaywallReleaseId(): ?string
    {
        return $this->paywallReleaseId;
    }
    /**
     * The id of the paywall release shown; informational.
     *
     * @param string|null $paywallReleaseId
     *
     * @return self
     */
    public function setPaywallReleaseId(?string $paywallReleaseId): self
    {
        $this->initialized['paywallReleaseId'] = true;
        $this->paywallReleaseId = $paywallReleaseId;
        return $this;
    }
}