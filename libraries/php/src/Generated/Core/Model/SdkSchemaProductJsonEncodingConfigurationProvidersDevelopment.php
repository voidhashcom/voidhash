<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaProductJsonEncodingConfigurationProvidersDevelopment
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
     * @var string
     */
    protected $currencyCode;
    /**
     * @var string|null
     */
    protected $duration;
    /**
     * @var string
     */
    protected $period;
    /**
     * @var mixed
     */
    protected $periodCount;
    /**
     * @var mixed
     */
    protected $price;
    /**
     * @var mixed
     */
    protected $priceInMinorUnits;
    /**
     * @var string
     */
    protected $productId;
    /**
     * @var string|null
     */
    protected $warning;
    /**
     * @return string
     */
    public function getCurrencyCode(): string
    {
        return $this->currencyCode;
    }
    /**
     * @param string $currencyCode
     *
     * @return self
     */
    public function setCurrencyCode(string $currencyCode): self
    {
        $this->initialized['currencyCode'] = true;
        $this->currencyCode = $currencyCode;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getDuration(): ?string
    {
        return $this->duration;
    }
    /**
     * @param string|null $duration
     *
     * @return self
     */
    public function setDuration(?string $duration): self
    {
        $this->initialized['duration'] = true;
        $this->duration = $duration;
        return $this;
    }
    /**
     * @return string
     */
    public function getPeriod(): string
    {
        return $this->period;
    }
    /**
     * @param string $period
     *
     * @return self
     */
    public function setPeriod(string $period): self
    {
        $this->initialized['period'] = true;
        $this->period = $period;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getPeriodCount()
    {
        return $this->periodCount;
    }
    /**
     * @param mixed $periodCount
     *
     * @return self
     */
    public function setPeriodCount($periodCount): self
    {
        $this->initialized['periodCount'] = true;
        $this->periodCount = $periodCount;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getPrice()
    {
        return $this->price;
    }
    /**
     * @param mixed $price
     *
     * @return self
     */
    public function setPrice($price): self
    {
        $this->initialized['price'] = true;
        $this->price = $price;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getPriceInMinorUnits()
    {
        return $this->priceInMinorUnits;
    }
    /**
     * @param mixed $priceInMinorUnits
     *
     * @return self
     */
    public function setPriceInMinorUnits($priceInMinorUnits): self
    {
        $this->initialized['priceInMinorUnits'] = true;
        $this->priceInMinorUnits = $priceInMinorUnits;
        return $this;
    }
    /**
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * @param string $productId
     *
     * @return self
     */
    public function setProductId(string $productId): self
    {
        $this->initialized['productId'] = true;
        $this->productId = $productId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getWarning(): ?string
    {
        return $this->warning;
    }
    /**
     * @param string|null $warning
     *
     * @return self
     */
    public function setWarning(?string $warning): self
    {
        $this->initialized['warning'] = true;
        $this->warning = $warning;
        return $this;
    }
}