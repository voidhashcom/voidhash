<?php

namespace Voidhash\Generated\Core\Model;

class Objects1
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
     * The value to filter or choose by.
     *
     * @var string
     */
    protected $value;
    /**
     * Its name, such as a product's; null when the value names itself.
     *
     * @var string|null
     */
    protected $label;
    /**
     * The value to filter or choose by.
     *
     * @return string
     */
    public function getValue(): string
    {
        return $this->value;
    }
    /**
     * The value to filter or choose by.
     *
     * @param string $value
     *
     * @return self
     */
    public function setValue(string $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
    /**
     * Its name, such as a product's; null when the value names itself.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * Its name, such as a product's; null when the value names itself.
     *
     * @param string|null $label
     *
     * @return self
     */
    public function setLabel(?string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
}