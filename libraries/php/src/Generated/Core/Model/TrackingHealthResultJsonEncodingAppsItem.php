<?php

namespace Voidhash\Generated\Core\Model;

class TrackingHealthResultJsonEncodingAppsItem
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
     * The app platform: `ios` or `android`.
     *
     * @var string
     */
    protected $platform;
    /**
     * Events the platform's SDK reported.
     *
     * @var int
     */
    protected $events;
    /**
     * When the platform's SDK last reported an event, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $lastEventAt;
    /**
     * The platform's SDK versions that reported events.
     *
     * @var list<SdkVersionSeen>
     */
    protected $sdkVersions;
    /**
     * The app platform: `ios` or `android`.
     *
     * @return string
     */
    public function getPlatform(): string
    {
        return $this->platform;
    }
    /**
     * The app platform: `ios` or `android`.
     *
     * @param string $platform
     *
     * @return self
     */
    public function setPlatform(string $platform): self
    {
        $this->initialized['platform'] = true;
        $this->platform = $platform;
        return $this;
    }
    /**
     * Events the platform's SDK reported.
     *
     * @return int
     */
    public function getEvents(): int
    {
        return $this->events;
    }
    /**
     * Events the platform's SDK reported.
     *
     * @param int $events
     *
     * @return self
     */
    public function setEvents(int $events): self
    {
        $this->initialized['events'] = true;
        $this->events = $events;
        return $this;
    }
    /**
     * When the platform's SDK last reported an event, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getLastEventAt(): string
    {
        return $this->lastEventAt;
    }
    /**
     * When the platform's SDK last reported an event, as an ISO 8601 timestamp.
     *
     * @param string $lastEventAt
     *
     * @return self
     */
    public function setLastEventAt(string $lastEventAt): self
    {
        $this->initialized['lastEventAt'] = true;
        $this->lastEventAt = $lastEventAt;
        return $this;
    }
    /**
     * The platform's SDK versions that reported events.
     *
     * @return list<SdkVersionSeen>
     */
    public function getSdkVersions(): array
    {
        return $this->sdkVersions;
    }
    /**
     * The platform's SDK versions that reported events.
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
}