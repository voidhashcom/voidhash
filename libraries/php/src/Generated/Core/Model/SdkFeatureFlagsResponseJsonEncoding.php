<?php

namespace Voidhash\Generated\Core\Model;

class SdkFeatureFlagsResponseJsonEncoding
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
     * @var list<SdkFeatureFlagResultJsonEncoding>
     */
    protected $flags;
    /**
     * @return list<SdkFeatureFlagResultJsonEncoding>
     */
    public function getFlags(): array
    {
        return $this->flags;
    }
    /**
     * @param list<SdkFeatureFlagResultJsonEncoding> $flags
     *
     * @return self
     */
    public function setFlags(array $flags): self
    {
        $this->initialized['flags'] = true;
        $this->flags = $flags;
        return $this;
    }
}