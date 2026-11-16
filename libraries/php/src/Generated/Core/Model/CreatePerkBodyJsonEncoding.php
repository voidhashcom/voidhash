<?php

namespace Voidhash\Generated\Core\Model;

class CreatePerkBodyJsonEncoding
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
     * The perk's name.
     *
     * @var string
     */
    protected $name;
    /**
     * How SDKs check access to the perk, unique in the project, such as `premium`.
     *
     * @var string
     */
    protected $slug;
    /**
     * The perk's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The perk's name.
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
     * How SDKs check access to the perk, unique in the project, such as `premium`.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * How SDKs check access to the perk, unique in the project, such as `premium`.
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