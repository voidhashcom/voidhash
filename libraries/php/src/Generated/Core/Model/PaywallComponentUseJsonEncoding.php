<?php

namespace Voidhash\Generated\Core\Model;

class PaywallComponentUseJsonEncoding
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
     * Where the component comes from: `project` for one of the project's own components, `registry` for an installed registry component.
     *
     * @var string
     */
    protected $source;
    /**
     * How placed instances name the component: its project slug, or `<publisher>/<name>` for a registry component.
     *
     * @var string
     */
    protected $slug;
    /**
     * The embedded version's number, counted from 1.
     *
     * @var int
     */
    protected $version;
    /**
     * The SHA-256 of the embedded module, in hex.
     *
     * @var string
     */
    protected $contentHash;
    /**
     * How many of the project's published paywalls embed this version.
     *
     * @var int
     */
    protected $publishedPaywallCount;
    /**
     * Where the component comes from: `project` for one of the project's own components, `registry` for an installed registry component.
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * Where the component comes from: `project` for one of the project's own components, `registry` for an installed registry component.
     *
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * How placed instances name the component: its project slug, or `<publisher>/<name>` for a registry component.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * How placed instances name the component: its project slug, or `<publisher>/<name>` for a registry component.
     *
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * The embedded version's number, counted from 1.
     *
     * @return int
     */
    public function getVersion(): int
    {
        return $this->version;
    }
    /**
     * The embedded version's number, counted from 1.
     *
     * @param int $version
     *
     * @return self
     */
    public function setVersion(int $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * The SHA-256 of the embedded module, in hex.
     *
     * @return string
     */
    public function getContentHash(): string
    {
        return $this->contentHash;
    }
    /**
     * The SHA-256 of the embedded module, in hex.
     *
     * @param string $contentHash
     *
     * @return self
     */
    public function setContentHash(string $contentHash): self
    {
        $this->initialized['contentHash'] = true;
        $this->contentHash = $contentHash;
        return $this;
    }
    /**
     * How many of the project's published paywalls embed this version.
     *
     * @return int
     */
    public function getPublishedPaywallCount(): int
    {
        return $this->publishedPaywallCount;
    }
    /**
     * How many of the project's published paywalls embed this version.
     *
     * @param int $publishedPaywallCount
     *
     * @return self
     */
    public function setPublishedPaywallCount(int $publishedPaywallCount): self
    {
        $this->initialized['publishedPaywallCount'] = true;
        $this->publishedPaywallCount = $publishedPaywallCount;
        return $this;
    }
}