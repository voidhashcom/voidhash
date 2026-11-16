<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallShowingJsonEncodingPaywallRelease
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
     * The release's compiled flow package.
     *
     * @var SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage
     */
    protected $flowPackage;
    /**
     * When the release was published, as an ISO 8601 timestamp; null when it was not.
     *
     * @var string|null
     */
    protected $publishedAt;
    /**
     * The release's id.
     *
     * @var string
     */
    protected $releaseId;
    /**
     * The release's version number within its paywall.
     *
     * @var mixed
     */
    protected $version;
    /**
     * The release's compiled flow package.
     *
     * @return SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage
     */
    public function getFlowPackage(): SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage
    {
        return $this->flowPackage;
    }
    /**
     * The release's compiled flow package.
     *
     * @param SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage $flowPackage
     *
     * @return self
     */
    public function setFlowPackage(SdkResolvedPaywallShowingJsonEncodingPaywallReleaseFlowPackage $flowPackage): self
    {
        $this->initialized['flowPackage'] = true;
        $this->flowPackage = $flowPackage;
        return $this;
    }
    /**
     * When the release was published, as an ISO 8601 timestamp; null when it was not.
     *
     * @return string|null
     */
    public function getPublishedAt(): ?string
    {
        return $this->publishedAt;
    }
    /**
     * When the release was published, as an ISO 8601 timestamp; null when it was not.
     *
     * @param string|null $publishedAt
     *
     * @return self
     */
    public function setPublishedAt(?string $publishedAt): self
    {
        $this->initialized['publishedAt'] = true;
        $this->publishedAt = $publishedAt;
        return $this;
    }
    /**
     * The release's id.
     *
     * @return string
     */
    public function getReleaseId(): string
    {
        return $this->releaseId;
    }
    /**
     * The release's id.
     *
     * @param string $releaseId
     *
     * @return self
     */
    public function setReleaseId(string $releaseId): self
    {
        $this->initialized['releaseId'] = true;
        $this->releaseId = $releaseId;
        return $this;
    }
    /**
     * The release's version number within its paywall.
     *
     * @return mixed
     */
    public function getVersion()
    {
        return $this->version;
    }
    /**
     * The release's version number within its paywall.
     *
     * @param mixed $version
     *
     * @return self
     */
    public function setVersion($version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
}