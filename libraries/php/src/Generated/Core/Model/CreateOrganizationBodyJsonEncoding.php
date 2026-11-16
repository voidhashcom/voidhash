<?php

namespace Voidhash\Generated\Core\Model;

class CreateOrganizationBodyJsonEncoding
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
     * The organization's name; its slug is derived from it.
     *
     * @var string
     */
    protected $name;
    /**
     * The organization's name; its slug is derived from it.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The organization's name; its slug is derived from it.
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