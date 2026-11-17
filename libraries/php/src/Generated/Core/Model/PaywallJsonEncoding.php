<?php

namespace Voidhash\Generated\Core\Model;

class PaywallJsonEncoding
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
     * The paywall's id, `pw_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the paywall belongs to.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The paywall's name, shown in the dashboard.
     *
     * @var string
     */
    protected $name;
    /**
     * The paywall's slug, unique in the project and fixed once created; analytics refer to the paywall by it.
     *
     * @var string
     */
    protected $slug;
    /**
     * What the flow is for: `paywall`, `onboarding`, `feedback`, `reactivation` or `custom`. It labels and groups flows, and decides nothing a flow may do.
     *
     * @var string
     */
    protected $kind;
    /**
     * Whether the paywall is archived.
     *
     * @var bool
     */
    protected $isArchived;
    /**
     * When the paywall was archived, as an ISO 8601 timestamp; null when it is not.
     *
     * @var string|null
     */
    protected $archivedAt;
    /**
     * Whether what the paywall may exchange with apps follows the locations it is made for, so a paywall made for none exchanges nothing. False only for a paywall made before paywalls were made for locations that has had none since: it keeps the interface its design declares until its first location is added.
     *
     * @var bool
     */
    protected $isMadeForLocations;
    /**
     * The URL of the latest preview image the studio rendered; null until it rendered one.
     *
     * @var string|null
     */
    protected $thumbnailUrl;
    /**
     * When the paywall was created, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $createdAt;
    /**
     * When the paywall was last changed, as an ISO 8601 timestamp.
     *
     * @var string|null
     */
    protected $updatedAt;
    /**
     * The paywall's id, `pw_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The paywall's id, `pw_...`.
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
     * The project the paywall belongs to.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the paywall belongs to.
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
     * The paywall's name, shown in the dashboard.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The paywall's name, shown in the dashboard.
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
     * The paywall's slug, unique in the project and fixed once created; analytics refer to the paywall by it.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The paywall's slug, unique in the project and fixed once created; analytics refer to the paywall by it.
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
     * What the flow is for: `paywall`, `onboarding`, `feedback`, `reactivation` or `custom`. It labels and groups flows, and decides nothing a flow may do.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What the flow is for: `paywall`, `onboarding`, `feedback`, `reactivation` or `custom`. It labels and groups flows, and decides nothing a flow may do.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * Whether the paywall is archived.
     *
     * @return bool
     */
    public function getIsArchived(): bool
    {
        return $this->isArchived;
    }
    /**
     * Whether the paywall is archived.
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
     * When the paywall was archived, as an ISO 8601 timestamp; null when it is not.
     *
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * When the paywall was archived, as an ISO 8601 timestamp; null when it is not.
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
     * Whether what the paywall may exchange with apps follows the locations it is made for, so a paywall made for none exchanges nothing. False only for a paywall made before paywalls were made for locations that has had none since: it keeps the interface its design declares until its first location is added.
     *
     * @return bool
     */
    public function getIsMadeForLocations(): bool
    {
        return $this->isMadeForLocations;
    }
    /**
     * Whether what the paywall may exchange with apps follows the locations it is made for, so a paywall made for none exchanges nothing. False only for a paywall made before paywalls were made for locations that has had none since: it keeps the interface its design declares until its first location is added.
     *
     * @param bool $isMadeForLocations
     *
     * @return self
     */
    public function setIsMadeForLocations(bool $isMadeForLocations): self
    {
        $this->initialized['isMadeForLocations'] = true;
        $this->isMadeForLocations = $isMadeForLocations;
        return $this;
    }
    /**
     * The URL of the latest preview image the studio rendered; null until it rendered one.
     *
     * @return string|null
     */
    public function getThumbnailUrl(): ?string
    {
        return $this->thumbnailUrl;
    }
    /**
     * The URL of the latest preview image the studio rendered; null until it rendered one.
     *
     * @param string|null $thumbnailUrl
     *
     * @return self
     */
    public function setThumbnailUrl(?string $thumbnailUrl): self
    {
        $this->initialized['thumbnailUrl'] = true;
        $this->thumbnailUrl = $thumbnailUrl;
        return $this;
    }
    /**
     * When the paywall was created, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * When the paywall was created, as an ISO 8601 timestamp.
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
     * When the paywall was last changed, as an ISO 8601 timestamp.
     *
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * When the paywall was last changed, as an ISO 8601 timestamp.
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