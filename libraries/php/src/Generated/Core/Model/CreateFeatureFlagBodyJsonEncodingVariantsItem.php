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
     * @var string|null
     */
    protected $label;
    /**
     * @var mixed
     */
    protected $value;
    /**
     * @var mixed|null
     */
    protected $weightBps;
    /**
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
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
     * @return mixed
     */
    public function getValue()
    {
        return $this->value;
    }
    /**
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
    /**
     * @return mixed
     */
    public function getWeightBps()
    {
        return $this->weightBps;
    }
    /**
     * @param mixed $weightBps
     *
     * @return self
     */
    public function setWeightBps($weightBps): self
    {
        $this->initialized['weightBps'] = true;
        $this->weightBps = $weightBps;
        return $this;
    }
}