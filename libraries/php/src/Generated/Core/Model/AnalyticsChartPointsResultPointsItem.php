<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsChartPointsResultPointsItem
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
     * The place's key.
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
     * The place's latitude, in degrees.
     *
     * @var float
     */
    protected $latitude;
    /**
     * The place's longitude, in degrees.
     *
     * @var float
     */
    protected $longitude;
    /**
     * The value at the place.
     *
     * @var float
     */
    protected $value;
    /**
     * The place's key.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The place's key.
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
     * The place's latitude, in degrees.
     *
     * @return float
     */
    public function getLatitude(): float
    {
        return $this->latitude;
    }
    /**
     * The place's latitude, in degrees.
     *
     * @param float $latitude
     *
     * @return self
     */
    public function setLatitude(float $latitude): self
    {
        $this->initialized['latitude'] = true;
        $this->latitude = $latitude;
        return $this;
    }
    /**
     * The place's longitude, in degrees.
     *
     * @return float
     */
    public function getLongitude(): float
    {
        return $this->longitude;
    }
    /**
     * The place's longitude, in degrees.
     *
     * @param float $longitude
     *
     * @return self
     */
    public function setLongitude(float $longitude): self
    {
        $this->initialized['longitude'] = true;
        $this->longitude = $longitude;
        return $this;
    }
    /**
     * The value at the place.
     *
     * @return float
     */
    public function getValue(): float
    {
        return $this->value;
    }
    /**
     * The value at the place.
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