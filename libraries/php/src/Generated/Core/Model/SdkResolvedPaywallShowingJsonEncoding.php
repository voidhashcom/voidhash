<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallShowingJsonEncoding
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
     * The showing's id; send it as `paywallContext.showingId` with a purchase made on this paywall.
     *
     * @var string
     */
    protected $id;
    /**
     * The paywall shown.
     *
     * @var SdkResolvedPaywallShowingJsonEncodingPaywall|null
     */
    protected $paywall;
    /**
     * The id of the paywall shown.
     *
     * @var string|null
     */
    protected $paywallId;
    /**
     * The paywall release shown.
     *
     * @var SdkResolvedPaywallShowingJsonEncodingPaywallRelease|null
     */
    protected $paywallRelease;
    /**
     * The id of the paywall release shown.
     *
     * @var string|null
     */
    protected $paywallReleaseId;
    /**
     * When the location started showing it, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $startedAt;
    /**
     * How the showing was chosen: always `paywall_release`, also when an experiment picked the release.
     *
     * @var string
     */
    protected $type;
    /**
     * The showing's id; send it as `paywallContext.showingId` with a purchase made on this paywall.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The showing's id; send it as `paywallContext.showingId` with a purchase made on this paywall.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The paywall shown.
     *
     * @return SdkResolvedPaywallShowingJsonEncodingPaywall|null
     */
    public function getPaywall(): ?SdkResolvedPaywallShowingJsonEncodingPaywall
    {
        return $this->paywall;
    }
    /**
     * The paywall shown.
     *
     * @param SdkResolvedPaywallShowingJsonEncodingPaywall|null $paywall
     *
     * @return self
     */
    public function setPaywall(?SdkResolvedPaywallShowingJsonEncodingPaywall $paywall): self
    {
        $this->initialized['paywall'] = true;
        $this->paywall = $paywall;
        return $this;
    }
    /**
     * The id of the paywall shown.
     *
     * @return string|null
     */
    public function getPaywallId(): ?string
    {
        return $this->paywallId;
    }
    /**
     * The id of the paywall shown.
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
     * The paywall release shown.
     *
     * @return SdkResolvedPaywallShowingJsonEncodingPaywallRelease|null
     */
    public function getPaywallRelease(): ?SdkResolvedPaywallShowingJsonEncodingPaywallRelease
    {
        return $this->paywallRelease;
    }
    /**
     * The paywall release shown.
     *
     * @param SdkResolvedPaywallShowingJsonEncodingPaywallRelease|null $paywallRelease
     *
     * @return self
     */
    public function setPaywallRelease(?SdkResolvedPaywallShowingJsonEncodingPaywallRelease $paywallRelease): self
    {
        $this->initialized['paywallRelease'] = true;
        $this->paywallRelease = $paywallRelease;
        return $this;
    }
    /**
     * The id of the paywall release shown.
     *
     * @return string|null
     */
    public function getPaywallReleaseId(): ?string
    {
        return $this->paywallReleaseId;
    }
    /**
     * The id of the paywall release shown.
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
    /**
     * When the location started showing it, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStartedAt(): string
    {
        return $this->startedAt;
    }
    /**
     * When the location started showing it, as an ISO 8601 timestamp.
     *
     * @param string $startedAt
     *
     * @return self
     */
    public function setStartedAt(string $startedAt): self
    {
        $this->initialized['startedAt'] = true;
        $this->startedAt = $startedAt;
        return $this;
    }
    /**
     * How the showing was chosen: always `paywall_release`, also when an experiment picked the release.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * How the showing was chosen: always `paywall_release`, also when an experiment picked the release.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
}