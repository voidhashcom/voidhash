<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentChange
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
     * What changed.
     *
     * @var string
     */
    protected $kind;
    /**
     * The name of the capability, prop or event that changed.
     *
     * @var string
     */
    protected $name;
    /**
     * What changed.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What changed.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The name of the capability, prop or event that changed.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The name of the capability, prop or event that changed.
     *
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
}