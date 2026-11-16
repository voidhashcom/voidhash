<?php

namespace Voidhash\Generated\Core\Model;

class SdkSchemaProductJsonEncoding
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
     * The perks the product unlocks and how it is sold.
     *
     * @var SdkSchemaProductJsonEncodingConfiguration
     */
    protected $configuration;
    /**
     * The product's display properties.
     *
     * @var SdkSchemaProductJsonEncodingProperties
     */
    protected $properties;
    /**
     * The product's id.
     *
     * @var string
     */
    protected $id;
    /**
     * How often the subscription renews: `weekly`, `monthly`, `quarterly`, `semi-annual` or `annual`; null for one-time products.
     *
     * @var string|null
     */
    protected $duration;
    /**
     * The product's slug.
     *
     * @var string
     */
    protected $slug;
    /**
     * What kind of product it is: a `subscription`, a `one-time` purchase bought once, or a `one-time-consumable` bought again and again.
     *
     * @var string
     */
    protected $type;
    /**
     * The perks the product unlocks and how it is sold.
     *
     * @return SdkSchemaProductJsonEncodingConfiguration
     */
    public function getConfiguration(): SdkSchemaProductJsonEncodingConfiguration
    {
        return $this->configuration;
    }
    /**
     * The perks the product unlocks and how it is sold.
     *
     * @param SdkSchemaProductJsonEncodingConfiguration $configuration
     *
     * @return self
     */
    public function setConfiguration(SdkSchemaProductJsonEncodingConfiguration $configuration): self
    {
        $this->initialized['configuration'] = true;
        $this->configuration = $configuration;
        return $this;
    }
    /**
     * The product's display properties.
     *
     * @return SdkSchemaProductJsonEncodingProperties
     */
    public function getProperties(): SdkSchemaProductJsonEncodingProperties
    {
        return $this->properties;
    }
    /**
     * The product's display properties.
     *
     * @param SdkSchemaProductJsonEncodingProperties $properties
     *
     * @return self
     */
    public function setProperties(SdkSchemaProductJsonEncodingProperties $properties): self
    {
        $this->initialized['properties'] = true;
        $this->properties = $properties;
        return $this;
    }
    /**
     * The product's id.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The product's id.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
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
     * The product's slug.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The product's slug.
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
     * What kind of product it is: a `subscription`, a `one-time` purchase bought once, or a `one-time-consumable` bought again and again.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * What kind of product it is: a `subscription`, a `one-time` purchase bought once, or a `one-time-consumable` bought again and again.
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
}