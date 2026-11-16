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
     * One entry per evaluated flag.
     *
     * @var list<SdkFeatureFlagResultJsonEncoding>
     */
    protected $flags;
    /**
     * One entry per evaluated flag.
     *
     * @return list<SdkFeatureFlagResultJsonEncoding>
     */
    public function getFlags(): array
    {
        return $this->flags;
    }
    /**
     * One entry per evaluated flag.
     *
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