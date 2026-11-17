<?php

namespace Voidhash\Generated\Core\Model;

class SchemaLocationJsonEncoding
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
     * What the location is for; null when not set.
     *
     * @var string|null
     */
    protected $description;
    /**
     * What an app provides at the location: the inputs it passes to a flow, the outputs and outcomes it reads back and the app actions it handles, with the `revision` it is at. A paywall can be shown at the location only when its deployed flow asks for nothing the interface lacks, and code generated for an app is built from it.
     *
     * @var LocationInterface
     */
    protected $interface;
    /**
     * The location's display name.
     *
     * @var string
     */
    protected $name;
    /**
     * The location's slug, which the app shows paywalls by.
     *
     * @var string
     */
    protected $slug;
    /**
     * What the location is for; null when not set.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the location is for; null when not set.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * What an app provides at the location: the inputs it passes to a flow, the outputs and outcomes it reads back and the app actions it handles, with the `revision` it is at. A paywall can be shown at the location only when its deployed flow asks for nothing the interface lacks, and code generated for an app is built from it.
     *
     * @return LocationInterface
     */
    public function getInterface(): LocationInterface
    {
        return $this->interface;
    }
    /**
     * What an app provides at the location: the inputs it passes to a flow, the outputs and outcomes it reads back and the app actions it handles, with the `revision` it is at. A paywall can be shown at the location only when its deployed flow asks for nothing the interface lacks, and code generated for an app is built from it.
     *
     * @param LocationInterface $interface
     *
     * @return self
     */
    public function setInterface(LocationInterface $interface): self
    {
        $this->initialized['interface'] = true;
        $this->interface = $interface;
        return $this;
    }
    /**
     * The location's display name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The location's display name.
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
     * The location's slug, which the app shows paywalls by.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The location's slug, which the app shows paywalls by.
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
}