<?php

namespace Voidhash\Generated\Core\Model;

class PublishedComponentInstallReviewJsonEncoding
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
     * The id of the registry component, `cmp_pkg_...`.
     *
     * @var string
     */
    protected $registryComponentId;
    /**
     * The version range the review resolved.
     *
     * @var string
     */
    protected $versionRange;
    /**
     * The id of the version the project has installed; null for a new install.
     *
     * @var string|null
     */
    protected $currentVersionId;
    /**
     * The semantic version the project has installed; null for a new install.
     *
     * @var string|null
     */
    protected $currentVersion;
    /**
     * The id of the version installing would move to: the newest ready one in the range.
     *
     * @var string
     */
    protected $targetVersionId;
    /**
     * The semantic version of `targetVersionId`; consent sends it back.
     *
     * @var string
     */
    protected $targetVersion;
    /**
     * Every capability the target version asks for; consent sends them all back.
     *
     * @var list<string>
     */
    protected $targetCapabilities;
    /**
     * The capabilities the target version asks for that the installed version does not; all of them for a new install.
     *
     * @var list<string>
     */
    protected $addedCapabilities;
    /**
     * The capabilities, props and events the target version adds, removes or changes, compared with the installed version.
     *
     * @var list<PublishedComponentChange>
     */
    protected $changes;
    /**
     * Whether installing needs `consent`: the version adds capabilities, or removes or retypes props or events.
     *
     * @var bool
     */
    protected $isConsentRequired;
    /**
     * The id of the registry component, `cmp_pkg_...`.
     *
     * @return string
     */
    public function getRegistryComponentId(): string
    {
        return $this->registryComponentId;
    }
    /**
     * The id of the registry component, `cmp_pkg_...`.
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
     * The version range the review resolved.
     *
     * @return string
     */
    public function getVersionRange(): string
    {
        return $this->versionRange;
    }
    /**
     * The version range the review resolved.
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
     * The id of the version the project has installed; null for a new install.
     *
     * @return string|null
     */
    public function getCurrentVersionId(): ?string
    {
        return $this->currentVersionId;
    }
    /**
     * The id of the version the project has installed; null for a new install.
     *
     * @param string|null $currentVersionId
     *
     * @return self
     */
    public function setCurrentVersionId(?string $currentVersionId): self
    {
        $this->initialized['currentVersionId'] = true;
        $this->currentVersionId = $currentVersionId;
        return $this;
    }
    /**
     * The semantic version the project has installed; null for a new install.
     *
     * @return string|null
     */
    public function getCurrentVersion(): ?string
    {
        return $this->currentVersion;
    }
    /**
     * The semantic version the project has installed; null for a new install.
     *
     * @param string|null $currentVersion
     *
     * @return self
     */
    public function setCurrentVersion(?string $currentVersion): self
    {
        $this->initialized['currentVersion'] = true;
        $this->currentVersion = $currentVersion;
        return $this;
    }
    /**
     * The id of the version installing would move to: the newest ready one in the range.
     *
     * @return string
     */
    public function getTargetVersionId(): string
    {
        return $this->targetVersionId;
    }
    /**
     * The id of the version installing would move to: the newest ready one in the range.
     *
     * @param string $targetVersionId
     *
     * @return self
     */
    public function setTargetVersionId(string $targetVersionId): self
    {
        $this->initialized['targetVersionId'] = true;
        $this->targetVersionId = $targetVersionId;
        return $this;
    }
    /**
     * The semantic version of `targetVersionId`; consent sends it back.
     *
     * @return string
     */
    public function getTargetVersion(): string
    {
        return $this->targetVersion;
    }
    /**
     * The semantic version of `targetVersionId`; consent sends it back.
     *
     * @param string $targetVersion
     *
     * @return self
     */
    public function setTargetVersion(string $targetVersion): self
    {
        $this->initialized['targetVersion'] = true;
        $this->targetVersion = $targetVersion;
        return $this;
    }
    /**
     * Every capability the target version asks for; consent sends them all back.
     *
     * @return list<string>
     */
    public function getTargetCapabilities(): array
    {
        return $this->targetCapabilities;
    }
    /**
     * Every capability the target version asks for; consent sends them all back.
     *
     * @param list<string> $targetCapabilities
     *
     * @return self
     */
    public function setTargetCapabilities(array $targetCapabilities): self
    {
        $this->initialized['targetCapabilities'] = true;
        $this->targetCapabilities = $targetCapabilities;
        return $this;
    }
    /**
     * The capabilities the target version asks for that the installed version does not; all of them for a new install.
     *
     * @return list<string>
     */
    public function getAddedCapabilities(): array
    {
        return $this->addedCapabilities;
    }
    /**
     * The capabilities the target version asks for that the installed version does not; all of them for a new install.
     *
     * @param list<string> $addedCapabilities
     *
     * @return self
     */
    public function setAddedCapabilities(array $addedCapabilities): self
    {
        $this->initialized['addedCapabilities'] = true;
        $this->addedCapabilities = $addedCapabilities;
        return $this;
    }
    /**
     * The capabilities, props and events the target version adds, removes or changes, compared with the installed version.
     *
     * @return list<PublishedComponentChange>
     */
    public function getChanges(): array
    {
        return $this->changes;
    }
    /**
     * The capabilities, props and events the target version adds, removes or changes, compared with the installed version.
     *
     * @param list<PublishedComponentChange> $changes
     *
     * @return self
     */
    public function setChanges(array $changes): self
    {
        $this->initialized['changes'] = true;
        $this->changes = $changes;
        return $this;
    }
    /**
     * Whether installing needs `consent`: the version adds capabilities, or removes or retypes props or events.
     *
     * @return bool
     */
    public function getIsConsentRequired(): bool
    {
        return $this->isConsentRequired;
    }
    /**
     * Whether installing needs `consent`: the version adds capabilities, or removes or retypes props or events.
     *
     * @param bool $isConsentRequired
     *
     * @return self
     */
    public function setIsConsentRequired(bool $isConsentRequired): self
    {
        $this->initialized['isConsentRequired'] = true;
        $this->isConsentRequired = $isConsentRequired;
        return $this;
    }
}