<?php

namespace Voidhash\Generated\Core\Model;

class TrackingHealthResultJsonEncoding
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
     * The project's id.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The start of the seven days the counts cover, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $start;
    /**
     * The end of the seven days the counts cover, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $end;
    /**
     * What the web SDK reported.
     *
     * @var TrackingHealthResultJsonEncodingWeb
     */
    protected $web;
    /**
     * The iOS and Android SDKs that reported events.
     *
     * @var list<TrackingHealthResultJsonEncodingAppsItem>
     */
    protected $apps;
    /**
     * Identified people an app reported, and how many of them came from the web first.
     *
     * @var TrackingHealthResultJsonEncodingHandoff
     */
    protected $handoff;
    /**
     * The project's id.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project's id.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * The start of the seven days the counts cover, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getStart(): string
    {
        return $this->start;
    }
    /**
     * The start of the seven days the counts cover, as an ISO 8601 timestamp.
     *
     * @param string $start
     *
     * @return self
     */
    public function setStart(string $start): self
    {
        $this->initialized['start'] = true;
        $this->start = $start;
        return $this;
    }
    /**
     * The end of the seven days the counts cover, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getEnd(): string
    {
        return $this->end;
    }
    /**
     * The end of the seven days the counts cover, as an ISO 8601 timestamp.
     *
     * @param string $end
     *
     * @return self
     */
    public function setEnd(string $end): self
    {
        $this->initialized['end'] = true;
        $this->end = $end;
        return $this;
    }
    /**
     * What the web SDK reported.
     *
     * @return TrackingHealthResultJsonEncodingWeb
     */
    public function getWeb(): TrackingHealthResultJsonEncodingWeb
    {
        return $this->web;
    }
    /**
     * What the web SDK reported.
     *
     * @param TrackingHealthResultJsonEncodingWeb $web
     *
     * @return self
     */
    public function setWeb(TrackingHealthResultJsonEncodingWeb $web): self
    {
        $this->initialized['web'] = true;
        $this->web = $web;
        return $this;
    }
    /**
     * The iOS and Android SDKs that reported events.
     *
     * @return list<TrackingHealthResultJsonEncodingAppsItem>
     */
    public function getApps(): array
    {
        return $this->apps;
    }
    /**
     * The iOS and Android SDKs that reported events.
     *
     * @param list<TrackingHealthResultJsonEncodingAppsItem> $apps
     *
     * @return self
     */
    public function setApps(array $apps): self
    {
        $this->initialized['apps'] = true;
        $this->apps = $apps;
        return $this;
    }
    /**
     * Identified people an app reported, and how many of them came from the web first.
     *
     * @return TrackingHealthResultJsonEncodingHandoff
     */
    public function getHandoff(): TrackingHealthResultJsonEncodingHandoff
    {
        return $this->handoff;
    }
    /**
     * Identified people an app reported, and how many of them came from the web first.
     *
     * @param TrackingHealthResultJsonEncodingHandoff $handoff
     *
     * @return self
     */
    public function setHandoff(TrackingHealthResultJsonEncodingHandoff $handoff): self
    {
        $this->initialized['handoff'] = true;
        $this->handoff = $handoff;
        return $this;
    }
}