<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentJsonEncoding
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
     * The registry component's id, `cmp_pkg_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The organization (team) whose registry lists the component. Voidhash's own components (`voidhash/<name>`) are listed in every organization's.
     *
     * @var string
     */
    protected $organizationId;
    /**
     * The component's full name, `<publisher>/<name>`; placed instances name it by it.
     *
     * @var string
     */
    protected $slug;
    /**
     * The publisher's namespace, the first part of `slug`.
     *
     * @var string
     */
    protected $publisher;
    /**
     * The component's name in the namespace, the second part of `slug`.
     *
     * @var string
     */
    protected $name;
    /**
     * The name people see, from the newest version's definition.
     *
     * @var string
     */
    protected $title;
    /**
     * What the component does, from the newest version's definition.
     *
     * @var string
     */
    protected $description;
    /**
     * The group the editor lists the component in; empty when none.
     *
     * @var string
     */
    protected $category;
    /**
     * Words people can search for the component by.
     *
     * @var list<string>
     */
    protected $keywords;
    /**
     * Whether the whole component is deprecated: it cannot be newly installed or inserted.
     *
     * @var bool
     */
    protected $isDeprecated;
    /**
     * When the component was deprecated, as an ISO 8601 timestamp; null when it is not.
     *
     * @var string|null
     */
    protected $deprecatedAt;
    /**
     * Why the component was deprecated, for installers; null when none was given.
     *
     * @var string|null
     */
    protected $deprecationMessage;
    /**
     * The project that owns the component and may publish, deprecate and yank its versions; null when none is known, and for Voidhash's own components, which only Voidhash publishes.
     *
     * @var string|null
     */
    protected $ownerProjectId;
    /**
     * The id of the newest ready version, or of the newest version when none is ready; null before any is published.
     *
     * @var string|null
     */
    protected $latestVersionId;
    /**
     * The semantic version of `latestVersionId`.
     *
     * @var string|null
     */
    protected $latestVersion;
    /**
     * How many versions were published.
     *
     * @var int
     */
    protected $versionCount;
    /**
     * The id of this project's install of the component; null when not installed.
     *
     * @var string|null
     */
    protected $installId;
    /**
     * When the component's first version was published, as an ISO 8601 timestamp.
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
     * The registry component's id, `cmp_pkg_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The registry component's id, `cmp_pkg_...`.
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
     * The organization (team) whose registry lists the component. Voidhash's own components (`voidhash/<name>`) are listed in every organization's.
     *
     * @return string
     */
    public function getOrganizationId(): string
    {
        return $this->organizationId;
    }
    /**
     * The organization (team) whose registry lists the component. Voidhash's own components (`voidhash/<name>`) are listed in every organization's.
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
     * The component's full name, `<publisher>/<name>`; placed instances name it by it.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The component's full name, `<publisher>/<name>`; placed instances name it by it.
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
     * The publisher's namespace, the first part of `slug`.
     *
     * @return string
     */
    public function getPublisher(): string
    {
        return $this->publisher;
    }
    /**
     * The publisher's namespace, the first part of `slug`.
     *
     * @param string $publisher
     *
     * @return self
     */
    public function setPublisher(string $publisher): self
    {
        $this->initialized['publisher'] = true;
        $this->publisher = $publisher;
        return $this;
    }
    /**
     * The component's name in the namespace, the second part of `slug`.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The component's name in the namespace, the second part of `slug`.
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
     * The name people see, from the newest version's definition.
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    /**
     * The name people see, from the newest version's definition.
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
     * What the component does, from the newest version's definition.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the component does, from the newest version's definition.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * The group the editor lists the component in; empty when none.
     *
     * @return string
     */
    public function getCategory(): string
    {
        return $this->category;
    }
    /**
     * The group the editor lists the component in; empty when none.
     *
     * @param string $category
     *
     * @return self
     */
    public function setCategory(string $category): self
    {
        $this->initialized['category'] = true;
        $this->category = $category;
        return $this;
    }
    /**
     * Words people can search for the component by.
     *
     * @return list<string>
     */
    public function getKeywords(): array
    {
        return $this->keywords;
    }
    /**
     * Words people can search for the component by.
     *
     * @param list<string> $keywords
     *
     * @return self
     */
    public function setKeywords(array $keywords): self
    {
        $this->initialized['keywords'] = true;
        $this->keywords = $keywords;
        return $this;
    }
    /**
     * Whether the whole component is deprecated: it cannot be newly installed or inserted.
     *
     * @return bool
     */
    public function getIsDeprecated(): bool
    {
        return $this->isDeprecated;
    }
    /**
     * Whether the whole component is deprecated: it cannot be newly installed or inserted.
     *
     * @param bool $isDeprecated
     *
     * @return self
     */
    public function setIsDeprecated(bool $isDeprecated): self
    {
        $this->initialized['isDeprecated'] = true;
        $this->isDeprecated = $isDeprecated;
        return $this;
    }
    /**
     * When the component was deprecated, as an ISO 8601 timestamp; null when it is not.
     *
     * @return string|null
     */
    public function getDeprecatedAt(): ?string
    {
        return $this->deprecatedAt;
    }
    /**
     * When the component was deprecated, as an ISO 8601 timestamp; null when it is not.
     *
     * @param string|null $deprecatedAt
     *
     * @return self
     */
    public function setDeprecatedAt(?string $deprecatedAt): self
    {
        $this->initialized['deprecatedAt'] = true;
        $this->deprecatedAt = $deprecatedAt;
        return $this;
    }
    /**
     * Why the component was deprecated, for installers; null when none was given.
     *
     * @return string|null
     */
    public function getDeprecationMessage(): ?string
    {
        return $this->deprecationMessage;
    }
    /**
     * Why the component was deprecated, for installers; null when none was given.
     *
     * @param string|null $deprecationMessage
     *
     * @return self
     */
    public function setDeprecationMessage(?string $deprecationMessage): self
    {
        $this->initialized['deprecationMessage'] = true;
        $this->deprecationMessage = $deprecationMessage;
        return $this;
    }
    /**
     * The project that owns the component and may publish, deprecate and yank its versions; null when none is known, and for Voidhash's own components, which only Voidhash publishes.
     *
     * @return string|null
     */
    public function getOwnerProjectId(): ?string
    {
        return $this->ownerProjectId;
    }
    /**
     * The project that owns the component and may publish, deprecate and yank its versions; null when none is known, and for Voidhash's own components, which only Voidhash publishes.
     *
     * @param string|null $ownerProjectId
     *
     * @return self
     */
    public function setOwnerProjectId(?string $ownerProjectId): self
    {
        $this->initialized['ownerProjectId'] = true;
        $this->ownerProjectId = $ownerProjectId;
        return $this;
    }
    /**
     * The id of the newest ready version, or of the newest version when none is ready; null before any is published.
     *
     * @return string|null
     */
    public function getLatestVersionId(): ?string
    {
        return $this->latestVersionId;
    }
    /**
     * The id of the newest ready version, or of the newest version when none is ready; null before any is published.
     *
     * @param string|null $latestVersionId
     *
     * @return self
     */
    public function setLatestVersionId(?string $latestVersionId): self
    {
        $this->initialized['latestVersionId'] = true;
        $this->latestVersionId = $latestVersionId;
        return $this;
    }
    /**
     * The semantic version of `latestVersionId`.
     *
     * @return string|null
     */
    public function getLatestVersion(): ?string
    {
        return $this->latestVersion;
    }
    /**
     * The semantic version of `latestVersionId`.
     *
     * @param string|null $latestVersion
     *
     * @return self
     */
    public function setLatestVersion(?string $latestVersion): self
    {
        $this->initialized['latestVersion'] = true;
        $this->latestVersion = $latestVersion;
        return $this;
    }
    /**
     * How many versions were published.
     *
     * @return int
     */
    public function getVersionCount(): int
    {
        return $this->versionCount;
    }
    /**
     * How many versions were published.
     *
     * @param int $versionCount
     *
     * @return self
     */
    public function setVersionCount(int $versionCount): self
    {
        $this->initialized['versionCount'] = true;
        $this->versionCount = $versionCount;
        return $this;
    }
    /**
     * The id of this project's install of the component; null when not installed.
     *
     * @return string|null
     */
    public function getInstallId(): ?string
    {
        return $this->installId;
    }
    /**
     * The id of this project's install of the component; null when not installed.
     *
     * @param string|null $installId
     *
     * @return self
     */
    public function setInstallId(?string $installId): self
    {
        $this->initialized['installId'] = true;
        $this->installId = $installId;
        return $this;
    }
    /**
     * When the component's first version was published, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the component's first version was published, as an ISO 8601 timestamp.
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