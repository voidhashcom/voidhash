<?php

namespace Voidhash\Generated\Core\Model;

class InsightInputTrendGoalsItem
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
     * What the goal line is labelled.
     *
     * @var string
     */
    protected $label;
    /**
     * The value the goal line is drawn at.
     *
     * @var float
     */
    protected $value;
    /**
     * What the goal line is labelled.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * What the goal line is labelled.
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
     * The value the goal line is drawn at.
     *
     * @return float
     */
    public function getValue(): float
    {
        return $this->value;
    }
    /**
     * The value the goal line is drawn at.
     *
     * @param float $value
     *
     * @return self
     */
    public function setValue(float $value): self
    {
        $this->initialized['value'] = true;
        $this->value = $value;
        return $this;
    }
}