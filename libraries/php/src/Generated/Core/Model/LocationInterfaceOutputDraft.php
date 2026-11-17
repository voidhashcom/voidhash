<?php

namespace Voidhash\Generated\Core\Model;

class LocationInterfaceOutputDraft
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
     * @var string
     */
    protected $type;
    /**
     * @var mixed
     */
    protected $default;
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
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getDefault()
    {
        return $this->default;
    }
    /**
     * @param mixed $default
     *
     * @return self
     */
    public function setDefault($default): self
    {
        $this->initialized['default'] = true;
        $this->default = $default;
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