<?php

namespace Voidhash\Generated\Core\Model;

class DuplicatePaywallBodyJsonEncoding
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
     * The copy's name; by default the paywall's name followed by "copy".
     *
     * @var string|null
     */
    protected $name;
    /**
     * The copy's slug, unique in the project; by default the paywall's slug followed by `-copy`, numbered when that is taken.
     *
     * @var string|null
     */
    protected $slug;
    /**
     * The copy's name; by default the paywall's name followed by "copy".
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The copy's name; by default the paywall's name followed by "copy".
     *
     * @param string|null $name
     *
     * @return self
     */
    public function setName(?string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * The copy's slug, unique in the project; by default the paywall's slug followed by `-copy`, numbered when that is taken.
     *
     * @return string|null
     */
    public function getSlug(): ?string
    {
        return $this->slug;
    }
    /**
     * The copy's slug, unique in the project; by default the paywall's slug followed by `-copy`, numbered when that is taken.
     *
     * @param string|null $slug
     *
     * @return self
     */
    public function setSlug(?string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
}