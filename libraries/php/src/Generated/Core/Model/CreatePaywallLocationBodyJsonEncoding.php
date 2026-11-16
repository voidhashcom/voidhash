<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaywallLocationBodyJsonEncoding
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
     * The location's name, shown in the dashboard.
     *
     * @var string
     */
    protected $name;
    /**
     * The location's slug, unique in the project; apps ask for the location by it, and it cannot change afterwards.
     *
     * @var string
     */
    protected $slug;
    /**
     * A note on where the location appears in the app.
     *
     * @var string|null
     */
    protected $description;
    /**
     * The location's name, shown in the dashboard.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The location's name, shown in the dashboard.
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
     * The location's slug, unique in the project; apps ask for the location by it, and it cannot change afterwards.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The location's slug, unique in the project; apps ask for the location by it, and it cannot change afterwards.
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
     * A note on where the location appears in the app.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * A note on where the location appears in the app.
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
}