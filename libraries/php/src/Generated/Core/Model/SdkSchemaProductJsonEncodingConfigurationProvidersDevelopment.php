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
     * The currency of the development price, always `USD`.
     *
     * @var string
     */
    protected $currencyCode;
    /**
     * How often the subscription renews: `weekly`, `monthly`, `quarterly`, `semi-annual` or `annual`; null for one-time products.
     *
     * @var string|null
     */
    protected $duration;
    /**
     * The unit of the billing period; `lifetime` for one-time products.
     *
     * @var string
     */
    protected $period;
    /**
     * How many `period` units one billing period lasts, such as 3 for quarterly.
     *
     * @var mixed
     */
    protected $periodCount;
    /**
     * The development price in dollars, such as `9.99`.
     *
     * @var mixed
     */
    protected $price;
    /**
     * The development price in cents, such as `999`.
     *
     * @var mixed
     */
    protected $priceInMinorUnits;
    /**
     * The product's slug, which simulated purchases name the product by.
     *
     * @var string
     */
    protected $productId;
    /**
     * A note about how purchases are simulated, such as a subscription without a duration billed monthly; null when there is none.
     *
     * @var string|null
     */
    protected $warning;
    /**
     * The currency of the development price, always `USD`.
     *
     * @return string
     */
    public function getCurrencyCode(): string
    {
        return $this->currencyCode;
    }
    /**
     * The currency of the development price, always `USD`.
     *
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
     * How often the subscription renews: `weekly`, `monthly`, `quarterly`, `semi-annual` or `annual`; null for one-time products.
     *
     * @return string|null
     */
    public function getDuration(): ?string
    {
        return $this->duration;
    }
    /**
     * How often the subscription renews: `weekly`, `monthly`, `quarterly`, `semi-annual` or `annual`; null for one-time products.
     *
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
     * The unit of the billing period; `lifetime` for one-time products.
     *
     * @return string
     */
    public function getPeriod(): string
    {
        return $this->period;
    }
    /**
     * The unit of the billing period; `lifetime` for one-time products.
     *
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
     * How many `period` units one billing period lasts, such as 3 for quarterly.
     *
     * @return mixed
     */
    public function getPeriodCount()
    {
        return $this->periodCount;
    }
    /**
     * How many `period` units one billing period lasts, such as 3 for quarterly.
     *
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
     * The development price in dollars, such as `9.99`.
     *
     * @return mixed
     */
    public function getPrice()
    {
        return $this->price;
    }
    /**
     * The development price in dollars, such as `9.99`.
     *
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
     * The development price in cents, such as `999`.
     *
     * @return mixed
     */
    public function getPriceInMinorUnits()
    {
        return $this->priceInMinorUnits;
    }
    /**
     * The development price in cents, such as `999`.
     *
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
     * The product's slug, which simulated purchases name the product by.
     *
     * @return string
     */
    public function getProductId(): string
    {
        return $this->productId;
    }
    /**
     * The product's slug, which simulated purchases name the product by.
     *
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
     * A note about how purchases are simulated, such as a subscription without a duration billed monthly; null when there is none.
     *
     * @return string|null
     */
    public function getWarning(): ?string
    {
        return $this->warning;
    }
    /**
     * A note about how purchases are simulated, such as a subscription without a duration billed monthly; null when there is none.
     *
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