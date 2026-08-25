<?php

namespace Voidhash\Generated\Core\Model;

class ApiFeatureFlagOverrideNotFoundErrorJsonEncoding
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
    protected $overrideId;
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
    public function getOverrideId(): string
    {
        return $this->overrideId;
    }
    /**
     * @param string $overrideId
     *
     * @return self
     */
    public function setOverrideId(string $overrideId): self
    {
        $this->initialized['overrideId'] = true;
        $this->overrideId = $overrideId;
        return $this;
    }
}