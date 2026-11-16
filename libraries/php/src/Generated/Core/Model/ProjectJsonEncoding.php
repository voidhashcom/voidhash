<?php

namespace Voidhash\Generated\Core\Model;

class ProjectJsonEncoding
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
     * The project's id, `proj_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization the project belongs to, `org_...`.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * The project's name.
     *
     * @var string
     */
    protected $name;
    /**
     * Unique within the organization, derived from the name when the project is created and never changed.
     *
     * @var string
     */
    protected $slug;
    /**
     * The URL of the project's logo; null when it has none.
     *
     * @var string|null
     */
    protected $logoUrl;
    /**
     * The project's id, `proj_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The project's id, `proj_...`.
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
     * The organization the project belongs to, `org_...`.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization the project belongs to, `org_...`.
     *
     * @param string $organizationId
     *
     * @return self
     */
    public function setOrganizationId(string $organizationId): self
    {
        $this->initialized['organizationId'] = true;
        $this->organizationId = $organizationId;
        return $this;
    }
    /**
     * The project's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The project's name.
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
     * Unique within the organization, derived from the name when the project is created and never changed.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * Unique within the organization, derived from the name when the project is created and never changed.
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
     * The URL of the project's logo; null when it has none.
     *
     * @return string|null
     */
    public function getLogoUrl(): ?string
    {
        return $this->logoUrl;
    }
    /**
     * The URL of the project's logo; null when it has none.
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