<?php

namespace Voidhash\Generated\Core\Model;

class UpdateProjectSettingsBodyJsonEncodingAds
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
     * The conversion ad cost is reported against: `signup`, `trial` or `payer`.
     *
     * @var string
     */
    protected $keyConversion;
    /**
     * Days before a signup an ad touch may come and still be credited with it, from 1 to 90.
     *
     * @var int|null
     */
    protected $attributionWindowDays;
    /**
     * The conversion ad cost is reported against: `signup`, `trial` or `payer`.
     *
     * @return string
     */
    public function getKeyConversion(): string
    {
        return $this->keyConversion;
    }
    /**
     * The conversion ad cost is reported against: `signup`, `trial` or `payer`.
     *
     * @param string $keyConversion
     *
     * @return self
     */
    public function setKeyConversion(string $keyConversion): self
    {
        $this->initialized['keyConversion'] = true;
        $this->keyConversion = $keyConversion;
        return $this;
    }
    /**
     * Days before a signup an ad touch may come and still be credited with it, from 1 to 90.
     *
     * @return int|null
     */
    public function getAttributionWindowDays(): ?int
    {
        return $this->attributionWindowDays;
    }
    /**
     * Days before a signup an ad touch may come and still be credited with it, from 1 to 90.
     *
     * @param int|null $attributionWindowDays
     *
     * @return self
     */
    public function setAttributionWindowDays(?int $attributionWindowDays): self
    {
        $this->initialized['attributionWindowDays'] = true;
        $this->attributionWindowDays = $attributionWindowDays;
        return $this;
    }
}