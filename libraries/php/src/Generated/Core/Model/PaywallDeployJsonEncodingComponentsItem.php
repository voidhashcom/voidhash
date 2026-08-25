<?php

namespace Voidhash\Generated\Core\Model;

class PaywallDeployJsonEncodingComponentsItem
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
    protected $componentId;
    /**
     * @var string
     */
    protected $contentHash;
    /**
     * @var string
     */
    protected $slug;
    /**
     * @var mixed|null
     */
    protected $version;
    /**
     * @return string|null
     */
    public function getComponentId(): ?string
    {
        return $this->componentId;
    }
    /**
     * @param string|null $componentId
     *
     * @return self
     */
    public function setComponentId(?string $componentId): self
    {
        $this->initialized['componentId'] = true;
        $this->componentId = $componentId;
        return $this;
    }
    /**
     * @return string
     */
    public function getContentHash(): string
    {
        return $this->contentHash;
    }
    /**
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
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
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