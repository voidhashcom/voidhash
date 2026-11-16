<?php

namespace Voidhash\Generated\Core\Model;

class SchemaProductJsonEncoding
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
     * How often the subscription renews: `weekly`, `monthly`, `quarterly`, `semi-annual` or `annual`; null for one-time products.
     *
     * @var string|null
     */
    protected $duration;
    /**
     * The product's display name.
     *
     * @var string
     */
    protected $name;
    /**
     * The slugs of the perks the product unlocks, in ascending order.
     *
     * @var list<string>
     */
    protected $perks;
    /**
     * How the product is sold in each store, ordered by store.
     *
     * @var list<SchemaProductProviderJsonEncoding>
     */
    protected $providers;
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
     * The product's display name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The product's display name.
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
     * The slugs of the perks the product unlocks, in ascending order.
     *
     * @return list<string>
     */
    public function getPerks(): array
    {
        return $this->perks;
    }
    /**
     * The slugs of the perks the product unlocks, in ascending order.
     *
     * @param list<string> $perks
     *
     * @return self
     */
    public function setPerks(array $perks): self
    {
        $this->initialized['perks'] = true;
        $this->perks = $perks;
        return $this;
    }
    /**
     * How the product is sold in each store, ordered by store.
     *
     * @return list<SchemaProductProviderJsonEncoding>
     */
    public function getProviders(): array
    {
        return $this->providers;
    }
    /**
     * How the product is sold in each store, ordered by store.
     *
     * @param list<SchemaProductProviderJsonEncoding> $providers
     *
     * @return self
     */
    public function setProviders(array $providers): self
    {
        $this->initialized['providers'] = true;
        $this->providers = $providers;
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