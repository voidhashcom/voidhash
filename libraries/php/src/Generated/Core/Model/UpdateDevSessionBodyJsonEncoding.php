<?php

namespace Voidhash\Generated\Core\Model;

class UpdateDevSessionBodyJsonEncoding
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
     * The components the run serves now, at most 64.
     *
     * @var list<DevSessionComponentJsonEncoding>
     */
    protected $components;
    /**
     * The components the run serves now, at most 64.
     *
     * @return list<DevSessionComponentJsonEncoding>
     */
    public function getComponents(): array
    {
        return $this->components;
    }
    /**
     * The components the run serves now, at most 64.
     *
     * @param list<DevSessionComponentJsonEncoding> $components
     *
     * @return self
     */
    public function setComponents(array $components): self
    {
        $this->initialized['components'] = true;
        $this->components = $components;
        return $this;
    }
}