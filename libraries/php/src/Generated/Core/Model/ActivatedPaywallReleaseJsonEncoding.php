<?php

namespace Voidhash\Generated\Core\Model;

class ActivatedPaywallReleaseJsonEncoding
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
    protected $releaseId;
    /**
     * @var mixed
     */
    protected $version;
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