<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartFunnelResultStepsItem
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
     * The step's key, such as `viewed`.
     *
     * @var string
     */
    protected $key;
    /**
     * A name for a key that is not in the catalog, such as a product's name; null when the key names itself or the catalog names it.
     *
     * @var string|null
     */
    protected $label;
    /**
     * How many people reached the step.
     *
     * @var float
     */
    protected $count;
    /**
     * The step's key, such as `viewed`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The step's key, such as `viewed`.
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
     * A name for a key that is not in the catalog, such as a product's name; null when the key names itself or the catalog names it.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * A name for a key that is not in the catalog, such as a product's name; null when the key names itself or the catalog names it.
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
     * How many people reached the step.
     *
     * @return float
     */
    public function getCount(): float
    {
        return $this->count;
    }
    /**
     * How many people reached the step.
     *
     * @param float $count
     *
     * @return self
     */
    public function setCount(float $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
}