<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartSeriesResultSeriesItem
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
     * One value per bucket; null where there is nothing to measure.
     *
     * @var list<float>
     */
    protected $values;
    /**
     * The same buckets of the period just before the range; only when `hasComparison` was set.
     *
     * @var list<float>|null
     */
    protected $previousValues;
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
     * One value per bucket; null where there is nothing to measure.
     *
     * @return list<float>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * One value per bucket; null where there is nothing to measure.
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
    /**
     * The same buckets of the period just before the range; only when `hasComparison` was set.
     *
     * @return list<float>|null
     */
    public function getPreviousValues(): ?array
    {
        return $this->previousValues;
    }
    /**
     * The same buckets of the period just before the range; only when `hasComparison` was set.
     *
     * @param list<float>|null $previousValues
     *
     * @return self
     */
    public function setPreviousValues(?array $previousValues): self
    {
        $this->initialized['previousValues'] = true;
        $this->previousValues = $previousValues;
        return $this;
    }
}