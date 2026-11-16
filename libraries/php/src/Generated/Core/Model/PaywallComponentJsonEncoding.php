<?php

namespace Voidhash\Generated\Core\Model;

class PaywallComponentJsonEncoding
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
     * The component's id, `cmp_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the component belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The component's slug, unique in the project: lowercase letters, digits and dashes, at most 63 characters. Placed instances name the component `project/<slug>`.
     *
     * @var string
     */
    protected $slug;
    /**
     * The name the editor shows.
     *
     * @var string
     */
    protected $title;
    /**
     * The group the editor lists the component in; null for the project's default group.
     *
     * @var string|null
     */
    protected $category;
    /**
     * @var PaywallComponentVersionJsonEncoding
     */
    protected $latestVersion;
    /**
     * @var PaywallComponentVersionJsonEncoding
     */
    protected $latestReadyVersion;
    /**
     * When the component was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the component last changed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $updatedAt;
    /**
     * The component's id, `cmp_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The component's id, `cmp_...`.
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
     * The project the component belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the component belongs to.
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
     * The component's slug, unique in the project: lowercase letters, digits and dashes, at most 63 characters. Placed instances name the component `project/<slug>`.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The component's slug, unique in the project: lowercase letters, digits and dashes, at most 63 characters. Placed instances name the component `project/<slug>`.
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
     * The name the editor shows.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The name the editor shows.
     *
     * @param string $title
     *
     * @return self
     */
    public function setTitle(string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * The group the editor lists the component in; null for the project's default group.
     *
     * @return string|null
     */
    public function getCategory(): ?string
    {
        return $this->category;
    }
    /**
     * The group the editor lists the component in; null for the project's default group.
     *
     * @param string|null $category
     *
     * @return self
     */
    public function setCategory(?string $category): self
    {
        $this->initialized['category'] = true;
        $this->category = $category;
        return $this;
    }
    /**
     * @return PaywallComponentVersionJsonEncoding
     */
    public function getLatestVersion(): PaywallComponentVersionJsonEncoding
    {
        return $this->latestVersion;
    }
    /**
     * @param PaywallComponentVersionJsonEncoding $latestVersion
     *
     * @return self
     */
    public function setLatestVersion(PaywallComponentVersionJsonEncoding $latestVersion): self
    {
        $this->initialized['latestVersion'] = true;
        $this->latestVersion = $latestVersion;
        return $this;
    }
    /**
     * @return PaywallComponentVersionJsonEncoding
     */
    public function getLatestReadyVersion(): PaywallComponentVersionJsonEncoding
    {
        return $this->latestReadyVersion;
    }
    /**
     * @param PaywallComponentVersionJsonEncoding $latestReadyVersion
     *
     * @return self
     */
    public function setLatestReadyVersion(PaywallComponentVersionJsonEncoding $latestReadyVersion): self
    {
        $this->initialized['latestReadyVersion'] = true;
        $this->latestReadyVersion = $latestReadyVersion;
        return $this;
    }
    /**
     * When the component was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the component was created, as an ISO 8601 timestamp.
     *
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * When the component last changed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When the component last changed, as an ISO 8601 timestamp.
     *
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}