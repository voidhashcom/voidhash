<?php

namespace Voidhash\Generated\Core\Model;

class CreateProductBodyJsonEncoding
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
     * The product's name.
     *
     * @var string
     */
    protected $name;
    /**
     * How SDKs and paywalls name the product, unique in the project, such as `pro_monthly`.
     *
     * @var string
     */
    protected $slug;
    /**
     * What buying the product gives: `subscription` renews every billing period, `one_time` is kept for good, and `one_time_consumable` is used up, such as a pack of credits.
     *
     * @var string
     */
    protected $type;
    /**
     * How often a subscription renews.
     *
     * @var string
     */
    protected $billingPeriod;
    /**
     * The product's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The product's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * How SDKs and paywalls name the product, unique in the project, such as `pro_monthly`.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * How SDKs and paywalls name the product, unique in the project, such as `pro_monthly`.
     *
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * What buying the product gives: `subscription` renews every billing period, `one_time` is kept for good, and `one_time_consumable` is used up, such as a pack of credits.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * What buying the product gives: `subscription` renews every billing period, `one_time` is kept for good, and `one_time_consumable` is used up, such as a pack of credits.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * How often a subscription renews.
     *
     * @return string
     */
    public function getBillingPeriod(): string
    {
        return $this->billingPeriod;
    }
    /**
     * How often a subscription renews.
     *
     * @param string $billingPeriod
     *
     * @return self
     */
    public function setBillingPeriod(string $billingPeriod): self
    {
        $this->initialized['billingPeriod'] = true;
        $this->billingPeriod = $billingPeriod;
        return $this;
    }
}