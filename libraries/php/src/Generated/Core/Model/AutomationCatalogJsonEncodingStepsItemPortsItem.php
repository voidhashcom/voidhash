<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncodingStepsItemPortsItem
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
     * The exit's key in a node's `next`.
     *
     * @var string
     */
    protected $key;
    /**
     * The exit's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * The exit's key in a node's `next`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The exit's key in a node's `next`.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * The exit's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The exit's name, as Studio shows it.
     *
     * @param string $label
     *
     * @return self
     */
    public function setLabel(string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
}