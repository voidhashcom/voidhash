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
     * @var string
     */
    protected $htmlUrl;
    /**
     * @var string|null
     */
    protected $publishedAt;
    /**
     * @var string
     */
    protected $releaseId;
    /**
     * @var SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime|null
     */
    protected $runtime;
    /**
     * @var mixed
     */
    protected $version;
    /**
     * @return string
     */
    public function getHtmlUrl(): string
    {
        return $this->htmlUrl;
    }
    /**
     * @param string $htmlUrl
     *
     * @return self
     */
    public function setHtmlUrl(string $htmlUrl): self
    {
        $this->initialized['htmlUrl'] = true;
        $this->htmlUrl = $htmlUrl;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getPublishedAt(): ?string
    {
        return $this->publishedAt;
    }
    /**
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
     * @return string
     */
    public function getReleaseId(): string
    {
        return $this->releaseId;
    }
    /**
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
     * @return SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime|null
     */
    public function getRuntime(): ?SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime
    {
        return $this->runtime;
    }
    /**
     * @param SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime|null $runtime
     *
     * @return self
     */
    public function setRuntime(?SdkResolvedPaywallShowingJsonEncodingPaywallReleaseRuntime $runtime): self
    {
        $this->initialized['runtime'] = true;
        $this->runtime = $runtime;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getVersion()
    {
        return $this->version;
    }
    /**
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