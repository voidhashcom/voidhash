<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentInstallJsonEncoding
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
     * The install's id, `cmp_inst_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project the component is installed in.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The id of the installed registry component, `cmp_pkg_...`.
     *
     * @var string
     */
    protected $registryComponentId;
    /**
     * The component's full name, `<publisher>/<name>`.
     *
     * @var string
     */
    protected $slug;
    /**
     * The versions the install follows: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version).
     *
     * @var string
     */
    protected $versionRange;
    /**
     * The id of the version the install is pinned to, `cmp_pkg_ver_...`.
     *
     * @var string
     */
    protected $versionId;
    /**
     * The semantic version of `versionId`.
     *
     * @var string
     */
    protected $version;
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @var string
     */
    protected $versionStatus;
    /**
     * The capabilities the project accepted for the component.
     *
     * @var list<string>
     */
    protected $consentedCapabilities;
    /**
     * The semantic version updating would move to, the newest ready one in the range; null when the install is current.
     *
     * @var string|null
     */
    protected $availableUpdate;
    /**
     * Who last installed or updated it: the id of the signed-in person, or the name of the API key.
     *
     * @var string
     */
    protected $installedBy;
    /**
     * When the component was installed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the install last changed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $updatedAt;
    /**
     * The install's id, `cmp_inst_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The install's id, `cmp_inst_...`.
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
     * The project the component is installed in.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project the component is installed in.
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
     * The id of the installed registry component, `cmp_pkg_...`.
     *
     * @return string
     */
    public function getRegistryComponentId(): string
    {
        return $this->registryComponentId;
    }
    /**
     * The id of the installed registry component, `cmp_pkg_...`.
     *
     * @param string $registryComponentId
     *
     * @return self
     */
    public function setRegistryComponentId(string $registryComponentId): self
    {
        $this->initialized['registryComponentId'] = true;
        $this->registryComponentId = $registryComponentId;
        return $this;
    }
    /**
     * The component's full name, `<publisher>/<name>`.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The component's full name, `<publisher>/<name>`.
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
     * The versions the install follows: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version).
     *
     * @return string
     */
    public function getVersionRange(): string
    {
        return $this->versionRange;
    }
    /**
     * The versions the install follows: `*`, an exact version such as `1.2.0`, `^1.2.0` (same major version) or `~1.2.0` (same minor version).
     *
     * @param string $versionRange
     *
     * @return self
     */
    public function setVersionRange(string $versionRange): self
    {
        $this->initialized['versionRange'] = true;
        $this->versionRange = $versionRange;
        return $this;
    }
    /**
     * The id of the version the install is pinned to, `cmp_pkg_ver_...`.
     *
     * @return string
     */
    public function getVersionId(): string
    {
        return $this->versionId;
    }
    /**
     * The id of the version the install is pinned to, `cmp_pkg_ver_...`.
     *
     * @param string $versionId
     *
     * @return self
     */
    public function setVersionId(string $versionId): self
    {
        $this->initialized['versionId'] = true;
        $this->versionId = $versionId;
        return $this;
    }
    /**
     * The semantic version of `versionId`.
     *
     * @return string
     */
    public function getVersion(): string
    {
        return $this->version;
    }
    /**
     * The semantic version of `versionId`.
     *
     * @param string $version
     *
     * @return self
     */
    public function setVersion(string $version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @return string
     */
    public function getVersionStatus(): string
    {
        return $this->versionStatus;
    }
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @param string $versionStatus
     *
     * @return self
     */
    public function setVersionStatus(string $versionStatus): self
    {
        $this->initialized['versionStatus'] = true;
        $this->versionStatus = $versionStatus;
        return $this;
    }
    /**
     * The capabilities the project accepted for the component.
     *
     * @return list<string>
     */
    public function getConsentedCapabilities(): array
    {
        return $this->consentedCapabilities;
    }
    /**
     * The capabilities the project accepted for the component.
     *
     * @param list<string> $consentedCapabilities
     *
     * @return self
     */
    public function setConsentedCapabilities(array $consentedCapabilities): self
    {
        $this->initialized['consentedCapabilities'] = true;
        $this->consentedCapabilities = $consentedCapabilities;
        return $this;
    }
    /**
     * The semantic version updating would move to, the newest ready one in the range; null when the install is current.
     *
     * @return string|null
     */
    public function getAvailableUpdate(): ?string
    {
        return $this->availableUpdate;
    }
    /**
     * The semantic version updating would move to, the newest ready one in the range; null when the install is current.
     *
     * @param string|null $availableUpdate
     *
     * @return self
     */
    public function setAvailableUpdate(?string $availableUpdate): self
    {
        $this->initialized['availableUpdate'] = true;
        $this->availableUpdate = $availableUpdate;
        return $this;
    }
    /**
     * Who last installed or updated it: the id of the signed-in person, or the name of the API key.
     *
     * @return string
     */
    public function getInstalledBy(): string
    {
        return $this->installedBy;
    }
    /**
     * Who last installed or updated it: the id of the signed-in person, or the name of the API key.
     *
     * @param string $installedBy
     *
     * @return self
     */
    public function setInstalledBy(string $installedBy): self
    {
        $this->initialized['installedBy'] = true;
        $this->installedBy = $installedBy;
        return $this;
    }
    /**
     * When the component was installed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the component was installed, as an ISO 8601 timestamp.
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
     * When the install last changed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When the install last changed, as an ISO 8601 timestamp.
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