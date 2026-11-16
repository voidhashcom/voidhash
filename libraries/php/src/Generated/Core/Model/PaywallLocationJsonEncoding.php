<?php

namespace Voidhash\Generated\Core\Model;

class PaywallLocationJsonEncoding
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
     * The location's id, `pw_loc_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the location belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The location's name, shown in the dashboard.
     *
     * @var string
     */
    protected $name;
    /**
     * The location's slug, unique in the project and fixed once created; apps ask for the location by it.
     *
     * @var string
     */
    protected $slug;
    /**
     * A note on where the location appears in the app; null when it has none.
     *
     * @var string|null
     */
    protected $description;
    /**
     * Whether the location is archived; an archived location shows nothing.
     *
     * @var bool
     */
    protected $isArchived;
    /**
     * When the location was archived, as an ISO 8601 timestamp; null when it is not.
     *
     * @var string|null
     */
    protected $archivedAt;
    /**
     * @var PaywallLocationShowingJsonEncoding
     */
    protected $showing;
    /**
     * @var PaywallLocationShowingJsonEncoding
     */
    protected $testShowing;
    /**
     * When the location was created, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the location was last changed, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * The location's id, `pw_loc_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The location's id, `pw_loc_...`.
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
     * The project the location belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the location belongs to.
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
     * The location's slug, unique in the project and fixed once created; apps ask for the location by it.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The location's slug, unique in the project and fixed once created; apps ask for the location by it.
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
     * A note on where the location appears in the app; null when it has none.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * A note on where the location appears in the app; null when it has none.
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
     * Whether the location is archived; an archived location shows nothing.
     *
     * @return bool
     */
    public function getIsArchived(): bool
    {
        return $this->isArchived;
    }
    /**
     * Whether the location is archived; an archived location shows nothing.
     *
     * @param bool $isArchived
     *
     * @return self
     */
    public function setIsArchived(bool $isArchived): self
    {
        $this->initialized['isArchived'] = true;
        $this->isArchived = $isArchived;
        return $this;
    }
    /**
     * When the location was archived, as an ISO 8601 timestamp; null when it is not.
     *
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * When the location was archived, as an ISO 8601 timestamp; null when it is not.
     *
     * @param string|null $archivedAt
     *
     * @return self
     */
    public function setArchivedAt(?string $archivedAt): self
    {
        $this->initialized['archivedAt'] = true;
        $this->archivedAt = $archivedAt;
        return $this;
    }
    /**
     * @return PaywallLocationShowingJsonEncoding
     */
    public function getShowing(): PaywallLocationShowingJsonEncoding
    {
        return $this->showing;
    }
    /**
     * @param PaywallLocationShowingJsonEncoding $showing
     *
     * @return self
     */
    public function setShowing(PaywallLocationShowingJsonEncoding $showing): self
    {
        $this->initialized['showing'] = true;
        $this->showing = $showing;
        return $this;
    }
    /**
     * @return PaywallLocationShowingJsonEncoding
     */
    public function getTestShowing(): PaywallLocationShowingJsonEncoding
    {
        return $this->testShowing;
    }
    /**
     * @param PaywallLocationShowingJsonEncoding $testShowing
     *
     * @return self
     */
    public function setTestShowing(PaywallLocationShowingJsonEncoding $testShowing): self
    {
        $this->initialized['testShowing'] = true;
        $this->testShowing = $testShowing;
        return $this;
    }
    /**
     * When the location was created, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the location was created, as an ISO 8601 timestamp.
     *
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the location was last changed, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the location was last changed, as an ISO 8601 timestamp.
     *
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}