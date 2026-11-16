<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartTableResultRowsItem
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
     * The row's key, such as a product id or an ISO 3166 alpha-2 country code.
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
     * The row's value in each column, by column key; null where there is none.
     *
     * @var array<string, float>
     */
    protected $values;
    /**
     * Text a row carries beside its numbers, such as a country's top language.
     *
     * @var array<string, string>|null
     */
    protected $text;
    /**
     * The row's key, such as a product id or an ISO 3166 alpha-2 country code.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The row's key, such as a product id or an ISO 3166 alpha-2 country code.
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
     * The row's value in each column, by column key; null where there is none.
     *
     * @return array<string, float>
     */
    public function getValues(): iterable
    {
        return $this->values;
    }
    /**
     * The row's value in each column, by column key; null where there is none.
     *
     * @param array<string, float> $values
     *
     * @return self
     */
    public function setValues(iterable $values): self
    {
        $this->initialized['values'] = true;
        $this->values = $values;
        return $this;
    }
    /**
     * Text a row carries beside its numbers, such as a country's top language.
     *
     * @return array<string, string>|null
     */
    public function getText(): ?iterable
    {
        return $this->text;
    }
    /**
     * Text a row carries beside its numbers, such as a country's top language.
     *
     * @param array<string, string>|null $text
     *
     * @return self
     */
    public function setText(?iterable $text): self
    {
        $this->initialized['text'] = true;
        $this->text = $text;
        return $this;
    }
}