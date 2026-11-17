<?php

namespace Voidhash\Generated\Core\Model;

class SdkResolvedPaywallJsonEncodingLocation
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
     * The location's id.
     *
     * @var string
     */
    protected $id;
    /**
     * @var mixed
     */
    protected $interfaceRevision;
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
     * The location's id.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The location's id.
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
     * @return mixed
     */
    public function getInterfaceRevision()
    {
        return $this->interfaceRevision;
    }
    /**
     * @param mixed $interfaceRevision
     *
     * @return self
     */
    public function setInterfaceRevision($interfaceRevision): self
    {
        $this->initialized['interfaceRevision'] = true;
        $this->interfaceRevision = $interfaceRevision;
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