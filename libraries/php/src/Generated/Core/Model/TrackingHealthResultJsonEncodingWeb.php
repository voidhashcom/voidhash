<?php

namespace Voidhash\Generated\Core\Model;

class TrackingHealthResultJsonEncodingWeb
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
     * Hosts with page views, most first.
     *
     * @var list<TrackingHealthResultJsonEncodingWebHostsItem>
     */
    protected $hosts;
    /**
     * The web SDK versions that reported events.
     *
     * @var list<SdkVersionSeen>
     */
    protected $sdkVersions;
    /**
     * When the web SDK last reported an event; null when it reported none.
     *
     * @var string|null
     */
    protected $lastEventAt;
    /**
     * Hosts with page views, most first.
     *
     * @return list<TrackingHealthResultJsonEncodingWebHostsItem>
     */
    public function getHosts(): array
    {
        return $this->hosts;
    }
    /**
     * Hosts with page views, most first.
     *
     * @param list<TrackingHealthResultJsonEncodingWebHostsItem> $hosts
     *
     * @return self
     */
    public function setHosts(array $hosts): self
    {
        $this->initialized['hosts'] = true;
        $this->hosts = $hosts;
        return $this;
    }
    /**
     * The web SDK versions that reported events.
     *
     * @return list<SdkVersionSeen>
     */
    public function getSdkVersions(): array
    {
        return $this->sdkVersions;
    }
    /**
     * The web SDK versions that reported events.
     *
     * @param list<SdkVersionSeen> $sdkVersions
     *
     * @return self
     */
    public function setSdkVersions(array $sdkVersions): self
    {
        $this->initialized['sdkVersions'] = true;
        $this->sdkVersions = $sdkVersions;
        return $this;
    }
    /**
     * When the web SDK last reported an event; null when it reported none.
     *
     * @return string|null
     */
    public function getLastEventAt(): ?string
    {
        return $this->lastEventAt;
    }
    /**
     * When the web SDK last reported an event; null when it reported none.
     *
     * @param string|null $lastEventAt
     *
     * @return self
     */
    public function setLastEventAt(?string $lastEventAt): self
    {
        $this->initialized['lastEventAt'] = true;
        $this->lastEventAt = $lastEventAt;
        return $this;
    }
}