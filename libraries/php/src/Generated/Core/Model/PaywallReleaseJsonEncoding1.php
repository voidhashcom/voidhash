<?php

namespace Voidhash\Generated\Core\Model;

class PaywallReleaseJsonEncoding1
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
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $paywallId;
    /**
     * @var string|null
     */
    protected $publishedAt;
    /**
     * @var string
     */
    protected $releaseId;
    /**
     * @var string
     */
    protected $status;
    /**
     * @var string
     */
    protected $url;
    /**
     * @var mixed
     */
    protected $version;
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getPaywallId(): string
    {
        return $this->paywallId;
    }
    /**
     * @param string $paywallId
     *
     * @return self
     */
    public function setPaywallId(string $paywallId): self
    {
        $this->initialized['paywallId'] = true;
        $this->paywallId = $paywallId;
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
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
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