<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsMetricResultSeriesItem
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
     * The group's value, `$unknown` for rows without one, or `$other` for groups summed together: past the limit, or of fewer than five people.
     *
     * @var string
     */
    protected $key;
    /**
     * A name for the key, such as a product's name; null when the key is its name.
     *
     * @var string|null
     */
    protected $label;
    /**
     * @var list<float>
     */
    protected $values;
    /**
     * The group's values over the `comparison` period or the `comparisonRange`, lined up as `previousTotal` and as long as it; only with one of them, and empty for a group that period did not show on its own.
     *
     * @var list<float>|null
     */
    protected $previousValues;
    /**
     * The group's value, `$unknown` for rows without one, or `$other` for groups summed together: past the limit, or of fewer than five people.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The group's value, `$unknown` for rows without one, or `$other` for groups summed together: past the limit, or of fewer than five people.
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
     * A name for the key, such as a product's name; null when the key is its name.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * A name for the key, such as a product's name; null when the key is its name.
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
     * @return list<float>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
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
     * The group's values over the `comparison` period or the `comparisonRange`, lined up as `previousTotal` and as long as it; only with one of them, and empty for a group that period did not show on its own.
     *
     * @return list<float>|null
     */
    public function getPreviousValues(): ?array
    {
        return $this->previousValues;
    }
    /**
     * The group's values over the `comparison` period or the `comparisonRange`, lined up as `previousTotal` and as long as it; only with one of them, and empty for a group that period did not show on its own.
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