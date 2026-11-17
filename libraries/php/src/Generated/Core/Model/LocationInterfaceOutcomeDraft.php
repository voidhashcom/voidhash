<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterfaceOutcomeDraft
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
    protected $name;
    /**
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @var bool|null
     */
    protected $isDeprecated;
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @return bool|null
     */
    public function getIsDeprecated(): ?bool
    {
        return $this->isDeprecated;
    }
    /**
     * Kept for app versions built against it, and no longer offered when designing a flow.
     *
     * @param bool|null $isDeprecated
     *
     * @return self
     */
    public function setIsDeprecated(?bool $isDeprecated): self
    {
        $this->initialized['isDeprecated'] = true;
        $this->isDeprecated = $isDeprecated;
        return $this;
    }
}