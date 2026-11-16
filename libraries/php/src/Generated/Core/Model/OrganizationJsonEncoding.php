<?php

namespace Voidhash\Generated\Core\Model;

class OrganizationJsonEncoding
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
     * The organization's id, `org_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization's name.
     *
     * @var string
     */
    protected $name;
    /**
     * Unique across Voidhash, derived from the name when the organization is created and never changed.
     *
     * @var string
     */
    protected $slug;
    /**
     * The URL of the organization's logo; null when it has none.
     *
     * @var string|null
     */
    protected $logoUrl;
    /**
     * The organization's id, `org_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The organization's id, `org_...`.
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
     * The organization's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The organization's name.
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
     * Unique across Voidhash, derived from the name when the organization is created and never changed.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * Unique across Voidhash, derived from the name when the organization is created and never changed.
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
     * The URL of the organization's logo; null when it has none.
     *
     * @return string|null
     */
    public function getLogoUrl(): ?string
    {
        return $this->logoUrl;
    }
    /**
     * The URL of the organization's logo; null when it has none.
     *
     * @param string|null $logoUrl
     *
     * @return self
     */
    public function setLogoUrl(?string $logoUrl): self
    {
        $this->initialized['logoUrl'] = true;
        $this->logoUrl = $logoUrl;
        return $this;
    }
}