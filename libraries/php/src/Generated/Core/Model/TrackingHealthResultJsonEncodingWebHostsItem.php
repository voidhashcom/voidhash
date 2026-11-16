<?php

namespace Voidhash\Generated\Core\Model;

class TrackingHealthResultJsonEncodingWebHostsItem
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
     * The host name of the pages.
     *
     * @var string
     */
    protected $host;
    /**
     * Page views on the host.
     *
     * @var int
     */
    protected $pageviews;
    /**
     * When the host last had a page view, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $lastPageviewAt;
    /**
     * The host name of the pages.
     *
     * @return string
     */
    public function getHost(): string
    {
        return $this->host;
    }
    /**
     * The host name of the pages.
     *
     * @param string $host
     *
     * @return self
     */
    public function setHost(string $host): self
    {
        $this->initialized['host'] = true;
        $this->host = $host;
        return $this;
    }
    /**
     * Page views on the host.
     *
     * @return int
     */
    public function getPageviews(): int
    {
        return $this->pageviews;
    }
    /**
     * Page views on the host.
     *
     * @param int $pageviews
     *
     * @return self
     */
    public function setPageviews(int $pageviews): self
    {
        $this->initialized['pageviews'] = true;
        $this->pageviews = $pageviews;
        return $this;
    }
    /**
     * When the host last had a page view, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getLastPageviewAt(): string
    {
        return $this->lastPageviewAt;
    }
    /**
     * When the host last had a page view, as an ISO 8601 timestamp.
     *
     * @param string $lastPageviewAt
     *
     * @return self
     */
    public function setLastPageviewAt(string $lastPageviewAt): self
    {
        $this->initialized['lastPageviewAt'] = true;
        $this->lastPageviewAt = $lastPageviewAt;
        return $this;
    }
}