<?php

namespace Voidhash\Generated\Core\Model;

class UpsertRegistryPublisherBodyJsonEncoding
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
     * The namespace to claim: lowercase letters, digits and dashes, starting with a letter or digit, at most 39 characters. `core`, `project`, `voidhash` and `vh` are reserved.
     *
     * @var string
     */
    protected $namespace;
    /**
     * The namespace to claim: lowercase letters, digits and dashes, starting with a letter or digit, at most 39 characters. `core`, `project`, `voidhash` and `vh` are reserved.
     *
     * @return string
     */
    public function getNamespace(): string
    {
        return $this->namespace;
    }
    /**
     * The namespace to claim: lowercase letters, digits and dashes, starting with a letter or digit, at most 39 characters. `core`, `project`, `voidhash` and `vh` are reserved.
     *
     * @param string $namespace
     *
     * @return self
     */
    public function setNamespace(string $namespace): self
    {
        $this->initialized['namespace'] = true;
        $this->namespace = $namespace;
        return $this;
    }
}