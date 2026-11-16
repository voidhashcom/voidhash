<?php

namespace Voidhash\Generated\Core\Model;

class PerkJsonEncoding
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
     * The perk's id, `perk_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the perk belongs to.
     *
     * @var string
     */
    protected $projectId;
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
     * The perk's id, `perk_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The perk's id, `perk_...`.
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
     * The project the perk belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the perk belongs to.
     *
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
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