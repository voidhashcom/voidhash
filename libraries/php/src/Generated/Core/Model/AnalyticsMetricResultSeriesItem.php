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
     * The group's value per bucket, a number in every bucket: of a cell too, since a query split two ways withholds nothing.
     *
     * @var list<float>
     */
    protected $values;
    /**
     * The group's values over the `comparison` period or the `comparisonRange`, measured by the same query with that period's own groups, lined up as `previousTotal` and as long as it; only with one of them. A group is matched by `key`, a cell of a `secondSplit` by `key` and `secondKey`, a margin's group by `key` within its dimension. Empty for a group that period did not show on its own, for `$other`, which sums different groups in each period, and for a cell with `$other` on either side.
     *
     * @var list<float>|null
     */
    protected $previousValues;
    /**
     * With a `secondSplit`, the cell's group of it, `$unknown` or `$other` as `key` is of `split`; `key` and `label` are then the cell's group of `split`. Only with a `secondSplit`.
     *
     * @var string|null
     */
    protected $secondKey;
    /**
     * A name for `secondKey`, such as a country's name; null when the key is its name. Only with a `secondSplit`.
     *
     * @var string|null
     */
    protected $secondLabel;
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
     * The group's value per bucket, a number in every bucket: of a cell too, since a query split two ways withholds nothing.
     *
     * @return list<float>
     */
    public function getValues(): array
    {
        return $this->values;
    }
    /**
     * The group's value per bucket, a number in every bucket: of a cell too, since a query split two ways withholds nothing.
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
     * The group's values over the `comparison` period or the `comparisonRange`, measured by the same query with that period's own groups, lined up as `previousTotal` and as long as it; only with one of them. A group is matched by `key`, a cell of a `secondSplit` by `key` and `secondKey`, a margin's group by `key` within its dimension. Empty for a group that period did not show on its own, for `$other`, which sums different groups in each period, and for a cell with `$other` on either side.
     *
     * @return list<float>|null
     */
    public function getPreviousValues(): ?array
    {
        return $this->previousValues;
    }
    /**
     * The group's values over the `comparison` period or the `comparisonRange`, measured by the same query with that period's own groups, lined up as `previousTotal` and as long as it; only with one of them. A group is matched by `key`, a cell of a `secondSplit` by `key` and `secondKey`, a margin's group by `key` within its dimension. Empty for a group that period did not show on its own, for `$other`, which sums different groups in each period, and for a cell with `$other` on either side.
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
    /**
     * With a `secondSplit`, the cell's group of it, `$unknown` or `$other` as `key` is of `split`; `key` and `label` are then the cell's group of `split`. Only with a `secondSplit`.
     *
     * @return string|null
     */
    public function getSecondKey(): ?string
    {
        return $this->secondKey;
    }
    /**
     * With a `secondSplit`, the cell's group of it, `$unknown` or `$other` as `key` is of `split`; `key` and `label` are then the cell's group of `split`. Only with a `secondSplit`.
     *
     * @param string|null $secondKey
     *
     * @return self
     */
    public function setSecondKey(?string $secondKey): self
    {
        $this->initialized['secondKey'] = true;
        $this->secondKey = $secondKey;
        return $this;
    }
    /**
     * A name for `secondKey`, such as a country's name; null when the key is its name. Only with a `secondSplit`.
     *
     * @return string|null
     */
    public function getSecondLabel(): ?string
    {
        return $this->secondLabel;
    }
    /**
     * A name for `secondKey`, such as a country's name; null when the key is its name. Only with a `secondSplit`.
     *
     * @param string|null $secondLabel
     *
     * @return self
     */
    public function setSecondLabel(?string $secondLabel): self
    {
        $this->initialized['secondLabel'] = true;
        $this->secondLabel = $secondLabel;
        return $this;
    }
}