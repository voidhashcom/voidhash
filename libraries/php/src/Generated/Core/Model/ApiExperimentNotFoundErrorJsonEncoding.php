<?php

namespace Voidhash\Generated\Core\Model;

class ApiExperimentNotFoundErrorJsonEncoding
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
    protected $tag;
    /**
     * @var string
     */
    protected $experimentId;
    /**
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * @param string $tag
     *
     * @return self
     */
    public function setTag(string $tag): self
    {
        $this->initialized['tag'] = true;
        $this->tag = $tag;
        return $this;
    }
    /**
     * @return string
     */
    public function getExperimentId(): string
    {
        return $this->experimentId;
    }
    /**
     * @param string $experimentId
     *
     * @return self
     */
    public function setExperimentId(string $experimentId): self
    {
        $this->initialized['experimentId'] = true;
        $this->experimentId = $experimentId;
        return $this;
    }
}