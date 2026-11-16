<?php

namespace Voidhash\Generated\Core\Model;

class AutomationCatalogJsonEncodingStepsItemOutputsItem
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
     * The output's key.
     *
     * @var string
     */
    protected $key;
    /**
     * The output's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * What the output holds.
     *
     * @var string
     */
    protected $description;
    /**
     * Whether the output takes a name after it, such as a property's key.
     *
     * @var bool
     */
    protected $isOpen;
    /**
     * The output's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The output's key.
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
     * The output's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The output's name, as Studio shows it.
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
    /**
     * What the output holds.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the output holds.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * Whether the output takes a name after it, such as a property's key.
     *
     * @return bool
     */
    public function getIsOpen(): bool
    {
        return $this->isOpen;
    }
    /**
     * Whether the output takes a name after it, such as a property's key.
     *
     * @param bool $isOpen
     *
     * @return self
     */
    public function setIsOpen(bool $isOpen): self
    {
        $this->initialized['isOpen'] = true;
        $this->isOpen = $isOpen;
        return $this;
    }
}