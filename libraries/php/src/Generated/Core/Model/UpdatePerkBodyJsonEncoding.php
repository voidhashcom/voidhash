<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePerkBodyJsonEncoding
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
     * The new name.
     *
     * @var string|null
     */
    protected $name;
    /**
     * The new slug, unique in the project. Apps that check access by the old slug stop finding the perk.
     *
     * @var string|null
     */
    protected $slug;
    /**
     * The new name.
     *
     * @return string|null
     */
    public function getName(): ?string
    {
        return $this->name;
    }
    /**
     * The new name.
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
     * The new slug, unique in the project. Apps that check access by the old slug stop finding the perk.
     *
     * @return string|null
     */
    public function getSlug(): ?string
    {
        return $this->slug;
    }
    /**
     * The new slug, unique in the project. Apps that check access by the old slug stop finding the perk.
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