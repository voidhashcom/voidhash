<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartFlowResultLinksItem
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
     * The key of the node it leaves.
     *
     * @var string
     */
    protected $source;
    /**
     * The key of the node it reaches.
     *
     * @var string
     */
    protected $target;
    /**
     * How many moved along it.
     *
     * @var float
     */
    protected $value;
    /**
     * The key of the node it leaves.
     *
     * @return string
     */
    public function getSource(): string
    {
        return $this->source;
    }
    /**
     * The key of the node it leaves.
     *
     * @param string $source
     *
     * @return self
     */
    public function setSource(string $source): self
    {
        $this->initialized['source'] = true;
        $this->source = $source;
        return $this;
    }
    /**
     * The key of the node it reaches.
     *
     * @return string
     */
    public function getTarget(): string
    {
        return $this->target;
    }
    /**
     * The key of the node it reaches.
     *
     * @param string $target
     *
     * @return self
     */
    public function setTarget(string $target): self
    {
        $this->initialized['target'] = true;
        $this->target = $target;
        return $this;
    }
    /**
     * How many moved along it.
     *
     * @return float
     */
    public function getValue(): float
    {
        return $this->value;
    }
    /**
     * How many moved along it.
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