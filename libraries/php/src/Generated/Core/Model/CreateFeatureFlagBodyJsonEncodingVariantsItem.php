<?php

namespace Voidhash\Generated\Core\Model;

class CreateFeatureFlagBodyJsonEncodingVariantsItem
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
     * A name for the variant shown in the dashboard; not allowed for a `json` flag.
     *
     * @var string|null
     */
    protected $label;
    /**
     * What the flag evaluates to in this variant: a string for a `string` flag, a number for a `number` flag, any JSON for a `json` flag.
     *
     * @var mixed
     */
    protected $value;
    /**
     * A name for the variant shown in the dashboard; not allowed for a `json` flag.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * A name for the variant shown in the dashboard; not allowed for a `json` flag.
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
    /**
     * What the flag evaluates to in this variant: a string for a `string` flag, a number for a `number` flag, any JSON for a `json` flag.
     *
     * @return mixed
     */
    public function getValue()
    {
        return $this->value;
    }
    /**
     * What the flag evaluates to in this variant: a string for a `string` flag, a number for a `number` flag, any JSON for a `json` flag.
     *
     * @param mixed $value
     *
     * @return self
     */
    public function setValue($value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
}