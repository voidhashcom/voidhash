<?php

namespace Voidhash\Generated\Core\Model;

class FinalizedPaywallDeployComponentJsonEncoding
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
    protected $componentId;
    /**
     * @var string
     */
    protected $contentHash;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var mixed
     */
    protected $version;
    /**
     * @return string
     */
    public function getComponentId(): string
    {
        return $this->componentId;
    }
    /**
     * @param string $componentId
     *
     * @return self
     */
    public function setComponentId(string $componentId): self
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
    public function getId(): string
    {
        return $this->id;
    }
    /**
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