<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartCurvesResultSeriesItem
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
     * The series' key, such as a store id or `$other` for the rest summed together.
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
     * How many it started from.
     *
     * @var float
     */
    protected $size;
    /**
     * One value per offset; null where it is not reached yet.
     *
     * @var list<float>
     */
    protected $values;
    /**
     * The series' key, such as a store id or `$other` for the rest summed together.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The series' key, such as a store id or `$other` for the rest summed together.
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
     * How many it started from.
     *
     * @return float
     */
    public function getSize(): float
    {
        return $this->size;
    }
    /**
     * How many it started from.
     *
     * @param float $size
     *
     * @return self
     */
    public function setSize(float $size): self
    {
        $this->initialized['size'] = true;
        $this->size = $size;
        return $this;
    }
    /**
     * One value per offset; null where it is not reached yet.
     *
     * @return list<float>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * One value per offset; null where it is not reached yet.
     *
     * @param list<float> $values
     *
     * @return self
     */
    public function setValues(array $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
}